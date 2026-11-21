import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import sharp from "sharp";
import { AdminSuitDetail, ApiError, UploadSignResponse } from "@ff/shared";
import { createAdminCatalogue } from "../src/services/admin-catalogue.ts";
import { memoryRepo, memoryStorage, recorder } from "./admin-fakes.ts";
import { ADMIN_ID, testApp } from "./helpers.ts";

const tokens = { owner: { sub: ADMIN_ID, email: "owner@example.com", aal: "aal1" } };
const AUTH = { Authorization: "Bearer owner" };

async function photo(width = 1200, height = 1600, format: "jpeg" | "png" = "jpeg") {
  return sharp({ create: { width, height, channels: 3, background: "#5b2a6e" } })
    .withMetadata({ exif: { IFD0: { Copyright: "secret-gps-test" } } })
    [format]()
    .toBuffer();
}

let env: ReturnType<typeof setup>;

function setup() {
  const db = memoryRepo();
  const store = memoryStorage();
  const rec = recorder();
  const app = testApp({ tokens, adminCatalogue: createAdminCatalogue({ repo: db.repo, storage: store.storage, audit: rec.audit, revalidate: rec.revalidate }) });
  return { db, store, rec, app };
}

async function uploadPhotos(count = 1, body?: Buffer) {
  const res = await request(env.app)
    .post("/admin/uploads/sign")
    .set(AUTH)
    .send({ files: Array.from({ length: count }, (_, i) => ({ name: `p${i}.jpg`, content_type: "image/jpeg", size: 1000 })) });
  expect(res.status).toBe(200);
  const { uploads } = UploadSignResponse.parse(res.body);
  for (const u of uploads) env.store.files.set(`originals/${u.path}`, body ?? (await photo()));
  return uploads.map((u) => ({ path: u.path }));
}

function suitBody(images: { path: string }[]) {
  return {
    batch: { label: "November 2026, first batch", arrived_on: "2026-11-10" },
    style: "london",
    title: "London style",
    price_kobo: 4_500_000,
    variants: [{ colour: "Navy", colour_hex: "#1d2b4a", sizes: ["10", "12"] }, { colour: "Wine", sizes: ["12"] }],
    images,
  };
}

async function createSuit() {
  const res = await request(env.app).post("/admin/suits").set(AUTH).send(suitBody(await uploadPhotos(2)));
  expect(res.status).toBe(201);
  return AdminSuitDetail.parse(res.body);
}

beforeEach(() => {
  env = setup();
});

describe("admin catalogue", () => {
  it("401 for every admin catalogue route without a token", async () => {
    for (const [method, path] of [["post", "/admin/uploads/sign"], ["get", "/admin/suits"], ["post", "/admin/suits"]] as const) {
      const res = await request(env.app)[method](path).send({});
      expect(res.status, path).toBe(401);
    }
  });

  it("signs uploads into the admin's own incoming folder and rejects bad files", async () => {
    const [img] = await uploadPhotos(1);
    expect(img!.path).toMatch(new RegExp(`^incoming/${ADMIN_ID}/[0-9a-f-]{36}\\.jpg$`));
    const bad = await request(env.app).post("/admin/uploads/sign").set(AUTH).send({ files: [{ name: "x.gif", content_type: "image/gif", size: 10 }] });
    expect(bad.status).toBe(400);
    const big = await request(env.app).post("/admin/uploads/sign").set(AUTH).send({ files: [{ name: "x.jpg", content_type: "image/jpeg", size: 11 * 1024 * 1024 }] });
    expect(big.status).toBe(400);
  });

  it("creates a draft with a ref, one variant per colour and size, and clean WebP originals", async () => {
    const suit = await createSuit();
    expect(suit).toMatchObject({ ref: "LN-01", status: "draft", batch_label: "November 2026, first batch" });
    expect(suit.variants.map((v) => `${v.colour} ${v.size}`).sort()).toEqual(["Navy 10", "Navy 12", "Wine 12"]);
    expect(suit.images).toHaveLength(2);

    const stored = [...env.store.files.entries()].filter(([k]) => k.startsWith(`originals/${suit.id}/`));
    expect(stored).toHaveLength(2);
    const meta = await sharp(stored[0]![1]).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();
    expect([...env.store.files.keys()].some((k) => k.includes("incoming/"))).toBe(false);
    expect(env.rec.audits.map((a) => a.action)).toEqual(["batch.create", "suit.create"]);
  });

  it("403 when a photo path belongs to another admin", async () => {
    const res = await request(env.app)
      .post("/admin/suits")
      .set(AUTH)
      .send(suitBody([{ path: "incoming/99999999-9999-4999-8999-999999999999/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg" }]));
    expect(res.status).toBe(403);
  });

  it("422 rule_failed when an upload is not really an image, and leaves no suit behind", async () => {
    const images = await uploadPhotos(1, Buffer.from("<?php echo 'not an image'; ?>"));
    const res = await request(env.app).post("/admin/suits").set(AUTH).send(suitBody(images));
    expect(res.status).toBe(422);
    expect(ApiError.parse(res.body).error.code).toBe("rule_failed");
    expect(env.db.suits.size).toBe(0);
  });

  it("400 validation_failed with field details for a bad body", async () => {
    const res = await request(env.app).post("/admin/suits").set(AUTH).send({ style: "paris", price_kobo: -5 });
    expect(res.status).toBe(400);
    const err = ApiError.parse(res.body).error;
    expect(err.code).toBe("validation_failed");
    expect(err.details?.map((d) => d.path)).toEqual(expect.arrayContaining(["style", "price_kobo", "title"]));
  });

  it("refuses to publish without a chosen photo, naming the rule", async () => {
    const suit = await createSuit();
    const res = await request(env.app).post(`/admin/suits/${suit.id}/publish`).set(AUTH).send({});
    expect(res.status).toBe(422);
    expect(ApiError.parse(res.body).error.details?.map((d) => d.path)).toContain("cover");
  });

  it("publishes with the owner's own photo: public WebP sizes, final cover row, refresh and audit", async () => {
    const suit = await createSuit();
    const original = suit.images[0]!;
    const sel = await request(env.app)
      .post(`/admin/suits/${suit.id}/select-image`)
      .set(AUTH)
      .send({ original_image_id: original.id, alt_text: "Navy London style suit on a hanger" });
    expect(sel.status).toBe(200);

    const res = await request(env.app).post(`/admin/suits/${suit.id}/publish`).set(AUTH).send({});
    expect(res.status).toBe(200);
    const published = AdminSuitDetail.parse(res.body);
    expect(published.status).toBe("published");
    expect(published.published_at).toBeTruthy();

    const cover = published.images.find((i) => i.is_cover)!;
    expect(cover.kind).toBe("final");
    expect(cover.alt_text).toBe("Navy London style suit on a hanger");
    const publicFiles = [...env.store.files.keys()].filter((k) => k.startsWith(`public-suits/${suit.id}/`));
    expect(publicFiles.map((k) => k.split("-").at(-1))).toEqual(expect.arrayContaining(["480.webp", "768.webp", "1080.webp", "1200.webp"]));
    expect(env.rec.revalidations).toContainEqual(["suits", `suit:${suit.slug}`]);
    expect(env.rec.audits.map((a) => a.action)).toEqual(expect.arrayContaining(["image.select", "suit.publish"]));

    const again = await request(env.app).post(`/admin/suits/${suit.id}/publish`).set(AUTH).send({});
    expect(again.status).toBe(200);
    expect(AdminSuitDetail.parse(again.body).images.filter((i) => i.kind === "final")).toHaveLength(1);
  });

  it("logs a price change on a published suit, refreshes the site, and archives", async () => {
    const suit = await createSuit();
    await request(env.app).post(`/admin/suits/${suit.id}/select-image`).set(AUTH).send({ original_image_id: suit.images[0]!.id, alt_text: "Suit" });
    await request(env.app).post(`/admin/suits/${suit.id}/publish`).set(AUTH).send({});
    env.rec.revalidations.length = 0;

    const patch = await request(env.app).patch(`/admin/suits/${suit.id}`).set(AUTH).send({ price_kobo: 5_000_000 });
    expect(patch.status).toBe(200);
    expect(env.rec.audits.find((a) => a.action === "price.change")?.detail).toEqual({ from: 4_500_000, to: 5_000_000 });
    expect(env.rec.revalidations).toHaveLength(1);

    const arch = await request(env.app).post(`/admin/suits/${suit.id}/archive`).set(AUTH).send({});
    expect(arch.status).toBe(200);
    expect(AdminSuitDetail.parse(arch.body).status).toBe("archived");
    const twice = await request(env.app).post(`/admin/suits/${suit.id}/archive`).set(AUTH).send({});
    expect(twice.status).toBe(409);
  });

  it("replaces variants but keeps a size that has orders, marked out of stock", async () => {
    const suit = await createSuit();
    const navy10 = suit.variants.find((v) => v.colour === "Navy" && v.size === "10")!;
    env.db.usedVariants.add(navy10.id);
    const res = await request(env.app)
      .patch(`/admin/suits/${suit.id}`)
      .set(AUTH)
      .send({ variants: [{ colour: "Wine", sizes: ["12", "14"] }] });
    expect(res.status).toBe(200);
    const after = AdminSuitDetail.parse(res.body).variants;
    expect(after.find((v) => v.id === navy10.id)).toMatchObject({ in_stock: false });
    expect(after.filter((v) => v.colour === "Wine").map((v) => v.size).sort()).toEqual(["12", "14"]);
    expect(after.some((v) => v.colour === "Navy" && v.size === "12")).toBe(false);
  });

  it("404 for an unknown suit id and 400 for a malformed one", async () => {
    expect((await request(env.app).get("/admin/suits/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa").set(AUTH)).status).toBe(404);
    expect((await request(env.app).get("/admin/suits/not-a-uuid").set(AUTH)).status).toBe(400);
  });
});

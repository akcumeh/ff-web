import { describe, expect, it } from "vitest";
import request from "supertest";
import sharp from "sharp";
import { AdminSuitDetail, buildCaption, captionPrice } from "@ff/shared";
import { createAdminCatalogue } from "../src/services/admin-catalogue.ts";
import { createChannels } from "../src/services/channels.ts";
import { createTelegram } from "../src/services/telegram.ts";
import { memoryRepo, memoryStorage, recorder } from "./admin-fakes.ts";
import { fakeTelegram, memoryChannelRepo } from "./channel-fakes.ts";
import { ADMIN_ID, SITE, testApp } from "./helpers.ts";

const tokens = { owner: { sub: ADMIN_ID, email: "owner@example.com", aal: "aal1" } };
const AUTH = { Authorization: "Bearer owner" };

describe("buildCaption", () => {
    const base = { style: "london" as const, ref: "LN-14", slug: "london-style-ln-14", price_kobo: 4_500_000 };

    it("builds the spec caption, in-stock only, with the right source tag", () => {
        const suit = {
            ...base,
            variants: [
                { colour: "Navy", size: "42", in_stock: true },
                { colour: "Navy", size: "44", in_stock: true },
                { colour: "Wine", size: "42", in_stock: true },
                { colour: "Black", size: "46", in_stock: false },
            ],
        };
        expect(buildCaption(suit, "whatsapp_pack", "https://frankiesuits.ng")).toBe(
            [
                "New in: London style, Ref LN-14",
                "Colours: Navy, Wine",
                "Sizes: 42, 44",
                "Price: ₦45,000",
                "See it and order: https://frankiesuits.ng/suits/london-style-ln-14?src=wa",
            ].join("\n"),
        );
        expect(buildCaption(suit, "telegram", "https://frankiesuits.ng")).toContain("?src=tg");
    });

    it("handles a suit with one size", () => {
        const c = buildCaption({ ...base, variants: [{ colour: "Navy", size: "48", in_stock: true }] }, "telegram", SITE);
        expect(c).toContain("Sizes: 48\n");
    });

    it("cuts a long colour list to eight names on Telegram only", () => {
        const variants = Array.from({ length: 20 }, (_, i) => ({ colour: `Very long colour name number ${i + 1} with extra words to fill space`, size: "42", in_stock: true }));
        const tg = buildCaption({ ...base, variants }, "telegram", SITE);
        expect(tg.length).toBeLessThanOrEqual(1024);
        expect(tg).toContain("and more on the page");
        expect(tg.match(/Very long colour/g)).toHaveLength(8);
        expect(buildCaption({ ...base, variants }, "whatsapp_pack", SITE)).not.toContain("and more on the page");
    });

    it("keeps an apostrophe in a colour name as plain text", () => {
        const c = buildCaption({ ...base, variants: [{ colour: "Ladies' wine", size: "42", in_stock: true }] }, "telegram", SITE);
        expect(c).toContain("Colours: Ladies' wine");
    });

    it("shows kobo only when they are not zero", () => {
        expect(captionPrice(4_500_000)).toBe("₦45,000");
        expect(captionPrice(4_500_050)).toBe("₦45,000.50");
    });
});

function setup(script?: ("ok" | "fail")[], withTelegram = true) {
    const db = memoryRepo();
    const store = memoryStorage();
    const rec = recorder();
    const ch = memoryChannelRepo();
    const tg = fakeTelegram(script);
    const channels = createChannels({
        repo: ch.repo,
        storage: store.storage,
        telegram: withTelegram ? tg.telegram : null,
        channelId: withTelegram ? "@frankiesuits_test" : undefined,
        alertChatId: withTelegram ? "999" : undefined,
        siteUrl: SITE,
        audit: rec.audit,
    });
    const app = testApp({
        tokens,
        adminCatalogue: createAdminCatalogue({ repo: db.repo, storage: store.storage, audit: rec.audit, revalidate: rec.revalidate, afterPublish: (s, r) => channels.afterPublish(s, r) }),
        channels,
        suitLookup: db.repo,
    });
    return { db, store, rec, ch, tg, app };
}

async function publishedSuit(env: ReturnType<typeof setup>) {
    const sign = await request(env.app).post("/admin/uploads/sign").set(AUTH).send({ files: [{ name: "a.jpg", content_type: "image/jpeg", size: 100 }] });
    const path = sign.body.uploads[0].path as string;
    env.store.files.set(`originals/${path}`, await sharp({ create: { width: 900, height: 1200, channels: 3, background: "#5b2a6e" } }).jpeg().toBuffer());
    const created = AdminSuitDetail.parse(
        (
            await request(env.app)
                .post("/admin/suits")
                .set(AUTH)
                .send({ batch: { label: "B", arrived_on: "2026-11-20" }, style: "turkey", title: "Turkey style", price_kobo: 4_100_000, variants: [{ colour: "Purple", sizes: ["42", "44"] }], images: [{ path }] })
        ).body,
    );
    await request(env.app).post(`/admin/suits/${created.id}/select-image`).set(AUTH).send({ original_image_id: created.images[0]!.id, alt_text: "Purple suit" });
    const pub = await request(env.app).post(`/admin/suits/${created.id}/publish`).set(AUTH).send({});
    return { suit: created, pub };
}

describe("publish to channels", () => {
    it("posts the JPEG to Telegram with the caption and creates a pending WhatsApp pack", async () => {
        const env = setup();
        const { suit, pub } = await publishedSuit(env);
        expect(pub.status).toBe(200);
        expect(pub.body.channels).toEqual({ telegram: "posted", pack: "pending" });
        expect(env.tg.sent).toHaveLength(1);
        expect(env.tg.sent[0]!.chatId).toBe("@frankiesuits_test");
        expect(env.tg.sent[0]!.caption).toContain("New in: Turkey style, Ref TR-01");
        expect(env.tg.sent[0]!.caption).toContain("?src=tg");
        const posts = [...env.ch.posts.values()];
        expect(posts.find((p) => p.platform === "telegram")).toMatchObject({ status: "posted", external_id: "101" });
        expect(posts.find((p) => p.platform === "whatsapp_pack")).toMatchObject({ status: "pending" });
        expect([...env.store.files.keys()].some((k) => k.startsWith(`public-suits/${suit.id}/`) && k.endsWith("-pack.jpg"))).toBe(true);
    });

    it("keeps the suit published when Telegram fails, alerts the owners, and Retry posts it", async () => {
        const env = setup(["fail", "ok"]);
        const { suit, pub } = await publishedSuit(env);
        expect(pub.status).toBe(200);
        expect(AdminSuitDetail.parse(pub.body).status).toBe("published");
        expect(pub.body.channels.telegram).toBe("failed");
        expect(env.tg.messages[0]?.text).toContain("Telegram post for TR-01 failed");

        const tgPost = [...env.ch.posts.values()].find((p) => p.platform === "telegram")!;
        expect(tgPost.status).toBe("failed");
        const retry = await request(env.app).post(`/admin/posts/${tgPost.id}/retry`).set(AUTH).send({});
        expect(retry.status).toBe(200);
        expect(retry.body.status).toBe("posted");
        const again = await request(env.app).post(`/admin/posts/${tgPost.id}/retry`).set(AUTH).send({});
        expect(again.status).toBe(409);
        void suit;
    });

    it("does not post twice when a published suit is published again", async () => {
        const env = setup();
        const { suit } = await publishedSuit(env);
        await request(env.app).post(`/admin/suits/${suit.id}/publish`).set(AUTH).send({});
        expect(env.tg.sent).toHaveLength(1);
        await request(env.app).post(`/admin/suits/${suit.id}/publish`).set(AUTH).send({ repost: true });
        expect(env.tg.sent).toHaveLength(2);
    });

    it("marks Telegram failed with a reason when the bot is not set up, without crashing publish", async () => {
        const env = setup([], false);
        const { pub } = await publishedSuit(env);
        expect(pub.status).toBe(200);
        expect([...env.ch.posts.values()].find((p) => p.platform === "telegram")?.error).toBe("Telegram is not set up on the server");
    });

    it("lists pending packs and marks one posted, but never a Telegram post", async () => {
        const env = setup();
        await publishedSuit(env);
        const pending = await request(env.app).get("/admin/packs/pending").set(AUTH);
        expect(pending.status).toBe(200);
        expect(pending.body.items).toHaveLength(1);
        expect(pending.body.items[0].caption).toContain("?src=wa");
        expect(pending.body.items[0].image_url).toContain("-pack.jpg");

        const packId = pending.body.items[0].id as string;
        const mark = await request(env.app).post(`/admin/posts/${packId}/mark-posted`).set(AUTH).send({});
        expect(mark.body.status).toBe("posted");
        expect((await request(env.app).get("/admin/packs/pending").set(AUTH)).body.items).toHaveLength(0);

        const tgPost = [...env.ch.posts.values()].find((p) => p.platform === "telegram")!;
        expect((await request(env.app).post(`/admin/posts/${tgPost.id}/mark-posted`).set(AUTH).send({})).status).toBe(409);
        expect(env.rec.audits.map((a) => a.action)).toContain("post.mark_posted");
    });
});

describe("Telegram client", () => {
    it("waits once when Telegram asks for 10 seconds or less", async () => {
        const replies = [
            Response.json({ ok: false, error_code: 429, parameters: { retry_after: 3 } }),
            Response.json({ ok: true, result: { message_id: 55 } }),
        ];
        const slept: number[] = [];
        const tg = createTelegram({ token: "t", fetchImpl: async () => replies.shift()!, sleep: async (ms) => void slept.push(ms) });
        expect(await tg.sendPhoto("@c", Buffer.from("x"), "cap")).toEqual({ messageId: "55" });
        expect(slept).toEqual([3000]);
    });

    it("gives up when Telegram asks for a long wait", async () => {
        const tg = createTelegram({ token: "t", fetchImpl: async () => Response.json({ ok: false, error_code: 429, parameters: { retry_after: 60 } }), sleep: async () => {} });
        await expect(tg.sendPhoto("@c", Buffer.from("x"), "cap")).rejects.toMatchObject({ code: "rate_limited" });
    });

    it("sends the caption as plain text with no parse_mode", async () => {
        let form: FormData | undefined;
        const tg = createTelegram({
            token: "t",
            fetchImpl: async (_url, init) => {
                form = init?.body as FormData;
                return Response.json({ ok: true, result: { message_id: 1 } });
            },
        });
        await tg.sendPhoto("@c", Buffer.from("x"), "Ref <b>LN-01</b>");
        expect(form?.get("caption")).toBe("Ref <b>LN-01</b>");
        expect(form?.has("parse_mode")).toBe(false);
    });
});

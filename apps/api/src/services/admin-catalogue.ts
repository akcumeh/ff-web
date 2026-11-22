import { randomUUID } from "node:crypto";
import type {
  AdminImage,
  AdminSuitDetail,
  AdminSuitSummary,
  Batch,
  SelectImage,
  SuitCreate,
  SuitPatch,
  UploadSignRequest,
  UploadSignResponse,
  VariantInput,
} from "@ff/shared";
import { HttpError } from "../lib/errors.ts";
import sharp from "sharp";
import { makePublicSet, normalizeOriginal } from "../lib/images.ts";

export type SuitStatus = "draft" | "review" | "published" | "archived";

export type VariantRecord = { id: string; colour: string; colour_hex: string | null; size: string; in_stock: boolean };

export type ImageRecord = {
  id: string;
  kind: "original" | "candidate" | "final" | "detail";
  bucket: "originals" | "candidates" | "public-suits";
  storage_path: string;
  widths: number[];
  width: number | null;
  height: number | null;
  blur_data: string | null;
  alt_text: string | null;
  is_cover: boolean;
  generation_id: string | null;
};

export type AdminSuitRow = {
  id: string;
  ref: string;
  slug: string;
  style: "london" | "turkey";
  title: string;
  description: string | null;
  price_kobo: number;
  status: SuitStatus;
  batch_id: string;
  batch_label: string | null;
  published_at: string | null;
  updated_at: string;
  variants: VariantRecord[];
  images: ImageRecord[];
};

export interface AdminCatalogueRepo {
  listBatches(): Promise<Batch[]>;
  createBatch(input: { label: string; arrived_on: string }): Promise<Batch>;
  listSuits(filter: { status?: SuitStatus }): Promise<AdminSuitRow[]>;
  getSuit(id: string): Promise<AdminSuitRow | null>;
  insertSuit(row: { style: "london" | "turkey"; title: string; description: string | null; price_kobo: number; batch_id: string; created_by: string }): Promise<{ id: string }>;
  updateSuit(id: string, patch: Partial<{ title: string; description: string | null; price_kobo: number; batch_id: string; status: SuitStatus; published_at: string }>): Promise<void>;
  deleteSuit(id: string): Promise<void>;
  insertVariants(rows: { suit_id: string; colour: string; colour_hex: string | null; size: string; in_stock: boolean }[]): Promise<void>;
  updateVariant(id: string, patch: { colour_hex?: string | null; in_stock?: boolean }): Promise<void>;
  deleteVariant(id: string): Promise<"deleted" | "in_use">;
  insertImage(suitId: string, row: ImageRecord): Promise<void>;
  updateImage(id: string, patch: { alt_text?: string; is_cover?: boolean }): Promise<void>;
  deleteImages(ids: string[]): Promise<void>;
  clearCover(suitId: string): Promise<void>;
}

export interface StoragePort {
  signUpload(bucket: string, path: string): Promise<{ signedUrl: string; token: string }>;
  download(bucket: string, path: string): Promise<Buffer>;
  upload(bucket: string, path: string, data: Buffer, contentType: string, cacheControl: string): Promise<void>;
  remove(bucket: string, paths: string[]): Promise<void>;
  signedUrl(bucket: string, path: string, seconds: number): Promise<string>;
  publicUrl(bucket: string, path: string): string;
}

export type AuditEntry = { adminId: string; action: string; targetType: string; targetId: string; detail?: Record<string, unknown> };

export type AdminCatalogueDeps = {
  repo: AdminCatalogueRepo;
  storage: StoragePort;
  audit: (e: AuditEntry) => Promise<void>;
  revalidate: (tags: string[]) => Promise<void>;
  afterPublish?: (suit: AdminSuitRow, repost: boolean) => Promise<{ telegram: string; pack: string }>;
};

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const ONE_YEAR = "31536000";

function expandVariants(suitId: string, variants: VariantInput[]) {
  const seen = new Set<string>();
  const rows: { suit_id: string; colour: string; colour_hex: string | null; size: string; in_stock: boolean }[] = [];
  for (const [i, v] of variants.entries()) {
    const colour = v.colour?.trim() || `Colour ${i + 1}`;
    for (const size of v.sizes) {
      const key = `${colour.toLowerCase()}|${size.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ suit_id: suitId, colour, colour_hex: v.colour_hex ?? null, size, in_stock: true });
    }
  }
  return rows;
}

function publicPaths(img: ImageRecord): string[] {
  return [...img.widths.map((w) => `${img.storage_path}-${w}.webp`), `${img.storage_path}-channel.jpg`, `${img.storage_path}-pack.jpg`];
}

export function createAdminCatalogue(deps: AdminCatalogueDeps) {
  const { repo, storage } = deps;

  const toSummary = (s: AdminSuitRow): AdminSuitSummary => ({
    id: s.id,
    ref: s.ref,
    slug: s.slug,
    style: s.style,
    title: s.title,
    status: s.status,
    price_kobo: s.price_kobo,
    batch_label: s.batch_label,
    updated_at: s.updated_at,
  });

  async function toDetail(s: AdminSuitRow): Promise<AdminSuitDetail> {
    const images: AdminImage[] = [];
    for (const img of s.images) {
      const url =
        img.bucket === "public-suits"
          ? storage.publicUrl(img.bucket, `${img.storage_path}-${Math.min(...img.widths)}.webp`)
          : await storage.signedUrl(img.bucket, img.storage_path, 600);
      images.push({ id: img.id, kind: img.kind, url, width: img.width, height: img.height, alt_text: img.alt_text, is_cover: img.is_cover });
    }
    return {
      ...toSummary(s),
      description: s.description,
      batch_id: s.batch_id,
      published_at: s.published_at,
      variants: s.variants,
      images,
    };
  }

  async function mustGet(id: string): Promise<AdminSuitRow> {
    const s = await repo.getSuit(id);
    if (!s) throw new HttpError(404, "not_found", "No suit with that id.");
    return s;
  }

  async function refreshPublic(s: AdminSuitRow) {
    await deps.revalidate(["suits", `suit:${s.slug}`]);
  }

  async function publishCopy(suitId: string, source: ImageRecord, kind: "final" | "detail", isCover: boolean) {
    const data = await storage.download(source.bucket, source.storage_path);
    const set = await makePublicSet(data);
    const id = randomUUID();
    const base = `${suitId}/${id}`;
    for (const f of set.files) {
      await storage.upload("public-suits", `${base}-${f.w}.webp`, f.data, "image/webp", ONE_YEAR);
    }
    if (kind === "final") {
      const jpg = await sharp(data).rotate().resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
      await storage.upload("public-suits", `${base}-channel.jpg`, jpg, "image/jpeg", ONE_YEAR);
      await storage.upload("public-suits", `${base}-pack.jpg`, jpg, "image/jpeg", ONE_YEAR);
    }
    await repo.insertImage(suitId, {
      id,
      kind,
      bucket: "public-suits",
      storage_path: base,
      widths: set.files.map((f) => f.w).sort((a, b) => a - b),
      width: set.width,
      height: set.height,
      blur_data: set.blur,
      alt_text: source.alt_text,
      is_cover: isCover,
      generation_id: kind === "final" ? source.generation_id : null,
    });
  }

  async function createBatch(adminId: string, input: { label: string; arrived_on: string }): Promise<Batch> {
    const batch = await repo.createBatch(input);
    await deps.audit({ adminId, action: "batch.create", targetType: "batch", targetId: batch.id });
    return batch;
  }

  return {
    async signUploads(adminId: string, input: UploadSignRequest): Promise<UploadSignResponse> {
      const uploads = [];
      for (const f of input.files) {
        const path = `incoming/${adminId}/${randomUUID()}.${EXT[f.content_type]}`;
        const signed = await storage.signUpload("originals", path);
        uploads.push({ path, signed_url: signed.signedUrl, token: signed.token });
      }
      return { uploads };
    },

    listBatches: () => repo.listBatches(),

    createBatch,

    async listSuits(filter: { status?: SuitStatus }) {
      return { items: (await repo.listSuits(filter)).map(toSummary) };
    },

    async getSuit(id: string) {
      return toDetail(await mustGet(id));
    },

    async createSuit(adminId: string, input: SuitCreate): Promise<AdminSuitDetail> {
      for (const img of input.images) {
        if (!img.path.startsWith(`incoming/${adminId}/`)) {
          throw new HttpError(403, "forbidden_origin", "One of the photos was not uploaded by you.");
        }
      }

      const processed = [];
      for (const img of input.images) {
        let raw: Buffer;
        try {
          raw = await storage.download("originals", img.path);
        } catch {
          throw new HttpError(422, "rule_failed", "A photo upload did not finish. Add the photos again.", [{ path: "images", message: "missing_upload" }]);
        }
        processed.push(await normalizeOriginal(raw));
      }

      const batchId = "id" in input.batch ? input.batch.id : (await createBatch(adminId, input.batch)).id;

      const { id: suitId } = await repo.insertSuit({
        style: input.style,
        title: input.title,
        description: input.description || null,
        price_kobo: input.price_kobo,
        batch_id: batchId,
        created_by: adminId,
      });

      const written: string[] = [];
      try {
        for (const p of processed) {
          const imageId = randomUUID();
          const path = `${suitId}/${imageId}.webp`;
          await storage.upload("originals", path, p.data, "image/webp", "3600");
          written.push(path);
          await repo.insertImage(suitId, {
            id: imageId,
            kind: "original",
            bucket: "originals",
            storage_path: path,
            widths: [p.width],
            width: p.width,
            height: p.height,
            blur_data: null,
            alt_text: null,
            is_cover: false,
            generation_id: null,
          });
        }
        await repo.insertVariants(expandVariants(suitId, input.variants));
      } catch (err) {
        await repo.deleteSuit(suitId).catch(() => {});
        await storage.remove("originals", written).catch(() => {});
        throw err;
      }

      await storage.remove("originals", input.images.map((i) => i.path)).catch(() => {});
      await deps.audit({ adminId, action: "suit.create", targetType: "suit", targetId: suitId });
      return toDetail(await mustGet(suitId));
    },

    async updateSuit(adminId: string, id: string, patch: SuitPatch): Promise<AdminSuitDetail> {
      const s = await mustGet(id);

      const fields: Parameters<AdminCatalogueRepo["updateSuit"]>[1] = {};
      if (patch.title !== undefined) fields.title = patch.title;
      if (patch.description !== undefined) fields.description = patch.description || null;
      if (patch.price_kobo !== undefined) fields.price_kobo = patch.price_kobo;
      if (patch.batch_id !== undefined) fields.batch_id = patch.batch_id;
      if (Object.keys(fields).length) await repo.updateSuit(id, fields);

      if (patch.variants) {
        const wanted = expandVariants(id, patch.variants);
        const key = (c: string, sz: string) => `${c.toLowerCase()}|${sz.toLowerCase()}`;
        const wantedKeys = new Map(wanted.map((w) => [key(w.colour, w.size), w]));
        for (const v of s.variants) {
          const match = wantedKeys.get(key(v.colour, v.size));
          if (match) {
            if (match.colour_hex !== v.colour_hex) await repo.updateVariant(v.id, { colour_hex: match.colour_hex });
            wantedKeys.delete(key(v.colour, v.size));
          } else if ((await repo.deleteVariant(v.id)) === "in_use") {
            await repo.updateVariant(v.id, { in_stock: false });
          }
        }
        if (wantedKeys.size) await repo.insertVariants([...wantedKeys.values()]);
      }

      for (const u of patch.variant_updates ?? []) {
        if (!s.variants.some((v) => v.id === u.id)) throw new HttpError(404, "not_found", "That size is not part of this suit.");
        await repo.updateVariant(u.id, { in_stock: u.in_stock });
      }

      for (const a of patch.image_alts ?? []) {
        if (!s.images.some((img) => img.id === a.id)) throw new HttpError(404, "not_found", "That photo is not part of this suit.");
        await repo.updateImage(a.id, { alt_text: a.alt_text });
      }

      if (patch.price_kobo !== undefined && patch.price_kobo !== s.price_kobo && s.status === "published") {
        await deps.audit({ adminId, action: "price.change", targetType: "suit", targetId: id, detail: { from: s.price_kobo, to: patch.price_kobo } });
      }
      await deps.audit({ adminId, action: "suit.update", targetType: "suit", targetId: id, detail: { fields: Object.keys(patch) } });
      if (s.status === "published") await refreshPublic(s);
      return toDetail(await mustGet(id));
    },

    async selectImage(adminId: string, id: string, input: SelectImage): Promise<AdminSuitDetail> {
      const s = await mustGet(id);
      const wantedId = input.candidate_image_id ?? input.original_image_id;
      const wantedKind = input.candidate_image_id ? "candidate" : "original";
      const img = s.images.find((i) => i.id === wantedId && i.kind === wantedKind);
      if (!img) throw new HttpError(404, "not_found", "That photo is not part of this suit.");
      await repo.clearCover(id);
      await repo.updateImage(img.id, { alt_text: input.alt_text, is_cover: true });
      await deps.audit({ adminId, action: "image.select", targetType: "suit", targetId: id, detail: { image: img.id } });
      return toDetail(await mustGet(id));
    },

    async publish(adminId: string, id: string, repost = false): Promise<AdminSuitDetail & { channels?: { telegram: string; pack: string } }> {
      let s = await mustGet(id);
      const cover = s.images.find((i) => i.is_cover);
      const failures: { path: string; message: string }[] = [];
      if (!cover) failures.push({ path: "cover", message: "Choose the photo to show on the site" });
      if (!s.variants.some((v) => v.in_stock)) failures.push({ path: "variants", message: "Mark at least one size as in stock" });
      if (!s.title) failures.push({ path: "title", message: "Add a title" });
      if (!(s.price_kobo > 0)) failures.push({ path: "price_kobo", message: "Add a price" });
      if (failures.length || !cover) throw new HttpError(422, "rule_failed", "This suit is not ready to publish.", failures);

      if (cover.kind !== "final") {
        const oldPublic = s.images.filter((i) => i.kind === "final" || i.kind === "detail");
        await repo.clearCover(s.id);
        await publishCopy(s.id, cover, "final", true);

        const firstOriginal = s.images.find((i) => i.kind === "original");
        if (cover.kind === "candidate" && firstOriginal) {
          await publishCopy(s.id, { ...firstOriginal, alt_text: firstOriginal.alt_text ?? `Real photo of the ${s.title}` }, "detail", false);
        }

        if (oldPublic.length) {
          await repo.deleteImages(oldPublic.map((i) => i.id));
          await storage.remove("public-suits", oldPublic.flatMap(publicPaths)).catch(() => {});
        }
        const candidates = s.images.filter((i) => i.kind === "candidate");
        if (candidates.length) {
          await repo.deleteImages(candidates.map((i) => i.id));
          await storage.remove("candidates", candidates.map((i) => i.storage_path)).catch(() => {});
        }
      }

      await repo.updateSuit(s.id, { status: "published", ...(s.published_at ? {} : { published_at: new Date().toISOString() }) });
      s = await mustGet(s.id);
      await refreshPublic(s);
      await deps.audit({ adminId, action: "suit.publish", targetType: "suit", targetId: s.id });
      let channels: { telegram: string; pack: string } | undefined;
      if (deps.afterPublish) {
        channels = await deps.afterPublish(s, repost).catch((err) => {
          console.error(JSON.stringify({ level: "error", msg: "channel posting failed", suit: s.id, error: String(err) }));
          return { telegram: "failed", pack: "pending" };
        });
      }
      return { ...(await toDetail(s)), ...(channels ? { channels } : {}) };
    },

    async archive(adminId: string, id: string): Promise<AdminSuitDetail> {
      const s = await mustGet(id);
      if (s.status !== "published") throw new HttpError(409, "conflict", "Only a published suit can be taken off the site.");
      await repo.updateSuit(id, { status: "archived" });
      await refreshPublic(s);
      await deps.audit({ adminId, action: "suit.archive", targetType: "suit", targetId: id });
      return toDetail(await mustGet(id));
    },
  };
}

export type AdminCatalogue = ReturnType<typeof createAdminCatalogue>;

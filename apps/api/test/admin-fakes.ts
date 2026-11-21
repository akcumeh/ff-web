import { randomUUID } from "node:crypto";
import type { Batch } from "@ff/shared";
import type {
  AdminCatalogueRepo,
  AdminSuitRow,
  AuditEntry,
  ImageRecord,
  StoragePort,
  SuitStatus,
  VariantRecord,
} from "../src/services/admin-catalogue.ts";

type SuitRec = Omit<AdminSuitRow, "batch_label" | "variants" | "images">;

export function memoryRepo() {
  const batches: Batch[] = [];
  const suits = new Map<string, SuitRec>();
  const variants = new Map<string, VariantRecord & { suit_id: string }>();
  const images = new Map<string, ImageRecord & { suit_id: string }>();
  const usedVariants = new Set<string>();
  const counters = { london: 0, turkey: 0 };

  const full = (s: SuitRec): AdminSuitRow => ({
    ...s,
    batch_label: batches.find((b) => b.id === s.batch_id)?.label ?? null,
    variants: [...variants.values()].filter((v) => v.suit_id === s.id).map(({ suit_id: _x, ...v }) => v),
    images: [...images.values()].filter((i) => i.suit_id === s.id).map(({ suit_id: _x, ...i }) => i),
  });

  const repo: AdminCatalogueRepo = {
    async listBatches() {
      return batches;
    },
    async createBatch(input) {
      const b = { id: randomUUID(), ...input };
      batches.push(b);
      return b;
    },
    async listSuits(filter) {
      return [...suits.values()].filter((s) => !filter.status || s.status === filter.status).map(full);
    },
    async getSuit(id) {
      const s = suits.get(id);
      return s ? full(s) : null;
    },
    async insertSuit(row) {
      counters[row.style] += 1;
      const ref = `${row.style === "london" ? "LN" : "TR"}-${String(counters[row.style]).padStart(2, "0")}`;
      const id = randomUUID();
      suits.set(id, {
        id,
        ref,
        slug: `${row.style}-style-${ref.toLowerCase()}`,
        style: row.style,
        title: row.title,
        description: row.description,
        price_kobo: row.price_kobo,
        status: "draft" as SuitStatus,
        batch_id: row.batch_id,
        published_at: null,
        updated_at: new Date().toISOString(),
      });
      return { id };
    },
    async updateSuit(id, patch) {
      const s = suits.get(id)!;
      suits.set(id, { ...s, ...patch, updated_at: new Date().toISOString() });
    },
    async deleteSuit(id) {
      suits.delete(id);
      for (const [k, v] of variants) if (v.suit_id === id) variants.delete(k);
      for (const [k, v] of images) if (v.suit_id === id) images.delete(k);
    },
    async insertVariants(rows) {
      for (const r of rows) {
        const id = randomUUID();
        variants.set(id, { id, ...r });
      }
    },
    async updateVariant(id, patch) {
      variants.set(id, { ...variants.get(id)!, ...patch });
    },
    async deleteVariant(id) {
      if (usedVariants.has(id)) return "in_use";
      variants.delete(id);
      return "deleted";
    },
    async insertImage(suitId, row) {
      images.set(row.id, { ...row, suit_id: suitId });
    },
    async updateImage(id, patch) {
      images.set(id, { ...images.get(id)!, ...patch });
    },
    async deleteImages(ids) {
      for (const id of ids) images.delete(id);
    },
    async clearCover(suitId) {
      for (const [k, v] of images) if (v.suit_id === suitId && v.is_cover) images.set(k, { ...v, is_cover: false });
    },
  };

  return { repo, suits, variants, images, usedVariants };
}

export function memoryStorage() {
  const files = new Map<string, Buffer>();
  const storage: StoragePort = {
    async signUpload(bucket, path) {
      return { signedUrl: `https://storage.test/${bucket}/${path}?token=t`, token: "t" };
    },
    async download(bucket, path) {
      const f = files.get(`${bucket}/${path}`);
      if (!f) throw new Error("not found");
      return f;
    },
    async upload(bucket, path, data) {
      files.set(`${bucket}/${path}`, data);
    },
    async remove(bucket, paths) {
      for (const p of paths) files.delete(`${bucket}/${p}`);
    },
    async signedUrl(bucket, path) {
      return `https://storage.test/signed/${bucket}/${path}`;
    },
    publicUrl(bucket, path) {
      return `https://storage.test/public/${bucket}/${path}`;
    },
  };
  return { storage, files };
}

export function recorder() {
  const audits: AuditEntry[] = [];
  const revalidations: string[][] = [];
  return {
    audits,
    revalidations,
    audit: async (e: AuditEntry) => {
      audits.push(e);
    },
    revalidate: async (tags: string[]) => {
      revalidations.push(tags);
    },
  };
}

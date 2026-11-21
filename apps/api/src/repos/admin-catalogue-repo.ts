import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminCatalogueRepo, AdminSuitRow } from "../services/admin-catalogue.ts";

const SUIT_SELECT =
  "id, ref, slug, style, title, description, price_kobo, status, batch_id, published_at, updated_at, " +
  "batches(label), " +
  "suit_variants(id, colour, colour_hex, size, in_stock), " +
  "suit_images(id, kind, bucket, storage_path, widths, width, height, blur_data, alt_text, is_cover, generation_id, sort, created_at)";

type RawSuit = Omit<AdminSuitRow, "batch_label" | "variants" | "images"> & {
  batches: { label: string } | null;
  suit_variants: AdminSuitRow["variants"];
  suit_images: (AdminSuitRow["images"][number] & { sort: number; created_at: string })[];
};

function toRow(r: RawSuit): AdminSuitRow {
  const { batches, suit_variants, suit_images, ...rest } = r;
  return {
    ...rest,
    batch_label: batches?.label ?? null,
    variants: [...suit_variants].sort((a, b) => a.colour.localeCompare(b.colour) || a.size.localeCompare(b.size, undefined, { numeric: true })),
    images: [...suit_images]
      .sort((a, b) => a.sort - b.sort || a.created_at.localeCompare(b.created_at))
      .map(({ sort: _s, created_at: _c, ...img }) => img),
  };
}

function check(error: { message: string; code?: string } | null, what: string) {
  if (error) throw new Error(`${what} failed: ${error.message}`);
}

export function supabaseAdminCatalogueRepo(db: SupabaseClient): AdminCatalogueRepo {
  return {
    async listBatches() {
      const { data, error } = await db.from("batches").select("id, label, arrived_on").order("arrived_on", { ascending: false }).limit(50);
      check(error, "batch list");
      return data ?? [];
    },
    async createBatch(input) {
      const { data, error } = await db.from("batches").insert(input).select("id, label, arrived_on").single();
      check(error, "batch insert");
      return data!;
    },
    async listSuits(filter) {
      let q = db.from("suits").select(SUIT_SELECT).order("updated_at", { ascending: false }).limit(200);
      if (filter.status) q = q.eq("status", filter.status);
      const { data, error } = await q;
      check(error, "suit list");
      return (data as unknown as RawSuit[]).map(toRow);
    },
    async getSuit(id) {
      const { data, error } = await db.from("suits").select(SUIT_SELECT).eq("id", id).maybeSingle();
      check(error, "suit lookup");
      return data ? toRow(data as unknown as RawSuit) : null;
    },
    async insertSuit(row) {
      const { data, error } = await db.from("suits").insert(row).select("id").single();
      check(error, "suit insert");
      return data!;
    },
    async updateSuit(id, patch) {
      const { error } = await db.from("suits").update(patch).eq("id", id);
      check(error, "suit update");
    },
    async deleteSuit(id) {
      const { error } = await db.from("suits").delete().eq("id", id);
      check(error, "suit delete");
    },
    async insertVariants(rows) {
      if (!rows.length) return;
      const { error } = await db.from("suit_variants").insert(rows);
      check(error, "variant insert");
    },
    async updateVariant(id, patch) {
      const { error } = await db.from("suit_variants").update(patch).eq("id", id);
      check(error, "variant update");
    },
    async deleteVariant(id) {
      const { error } = await db.from("suit_variants").delete().eq("id", id);
      if (error?.code === "23503") return "in_use";
      check(error, "variant delete");
      return "deleted";
    },
    async insertImage(suitId, row) {
      const { error } = await db.from("suit_images").insert({ ...row, suit_id: suitId });
      check(error, "image insert");
    },
    async updateImage(id, patch) {
      const { error } = await db.from("suit_images").update(patch).eq("id", id);
      check(error, "image update");
    },
    async deleteImages(ids) {
      if (!ids.length) return;
      const { error } = await db.from("suit_images").delete().in("id", ids);
      check(error, "image delete");
    },
    async clearCover(suitId) {
      const { error } = await db.from("suit_images").update({ is_cover: false }).eq("suit_id", suitId).eq("is_cover", true);
      check(error, "cover clear");
    },
  };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CatalogueRepo, SuitRow } from "../services/catalogue.ts";

const SELECT =
  "id, ref, slug, style, title, description, price_kobo, batch_id, published_at, updated_at, " +
  "suit_variants(id, colour, colour_hex, size, in_stock), " +
  "suit_images(id, kind, storage_path, widths, width, height, blur_data, alt_text, is_cover, generation_id)";

function sortVariants(row: SuitRow): SuitRow {
  row.suit_variants.sort((a, b) => a.colour.localeCompare(b.colour) || a.size.localeCompare(b.size, undefined, { numeric: true }));
  return row;
}

export function supabaseCatalogueRepo(supabase: SupabaseClient): CatalogueRepo {
  return {
    async latestBatchId() {
      const { data, error } = await supabase
        .from("suits")
        .select("batch_id, batches!inner(arrived_on)")
        .eq("status", "published");
      if (error) throw new Error(`latest batch lookup failed: ${error.message}`);
      let best: { id: string; arrived: string } | null = null;
      for (const row of data as unknown as { batch_id: string; batches: { arrived_on: string } }[]) {
        if (!best || row.batches.arrived_on > best.arrived) best = { id: row.batch_id, arrived: row.batches.arrived_on };
      }
      return best?.id ?? null;
    },

    async listPublished(f) {
      let q = supabase
        .from("suits")
        .select(SELECT)
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(f.limit);
      if (f.style) q = q.eq("style", f.style);
      if (f.since) q = q.gte("published_at", f.since);
      if (f.batchId) q = q.eq("batch_id", f.batchId);
      if (f.excludeSlug) q = q.neq("slug", f.excludeSlug);
      if (f.after) {
        const ts = `"${f.after.publishedAt}"`;
        q = q.or(`published_at.lt.${ts},and(published_at.eq.${ts},id.lt.${f.after.id})`);
      }
      const { data, error } = await q;
      if (error) throw new Error(`suit list failed: ${error.message}`);
      return (data as unknown as SuitRow[]).map(sortVariants);
    },

    async findPublishedBySlug(slug) {
      const { data, error } = await supabase.from("suits").select(SELECT).eq("status", "published").eq("slug", slug).maybeSingle();
      if (error) throw new Error(`suit lookup failed: ${error.message}`);
      return data ? sortVariants(data as unknown as SuitRow) : null;
    },

    async sitemap() {
      const { data, error } = await supabase
        .from("suits")
        .select("slug, updated_at")
        .eq("status", "published")
        .order("published_at", { ascending: false });
      if (error) throw new Error(`sitemap failed: ${error.message}`);
      return data;
    },
  };
}

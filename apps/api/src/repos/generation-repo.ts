import type { SupabaseClient } from "@supabase/supabase-js";
import type { GenRow, GenerationRepo } from "../services/generation.ts";

const GEN_SELECT = "id, kind, suit_id, status, candidate_count, observation, error, cost_usd_micro, started_at, created_at";

function check(error: { message: string } | null, what: string) {
  if (error) throw new Error(`${what} failed: ${error.message}`);
}

export function supabaseGenerationRepo(db: SupabaseClient): GenerationRepo {
  return {
    async setting<T>(key: string) {
      const { data, error } = await db.from("settings").select("value").eq("key", key).maybeSingle();
      check(error, "setting read");
      return (data?.value ?? null) as T | null;
    },
    async setSetting(key, value, adminId) {
      const { error } = await db.from("settings").upsert({ key, value, updated_by: adminId });
      check(error, "setting write");
    },
    async activeTemplate(name) {
      const { data, error } = await db.from("prompt_templates").select("name, version, body").eq("name", name).eq("is_active", true).maybeSingle();
      check(error, "template read");
      return data;
    },
    async activeTemplates() {
      const { data, error } = await db.from("prompt_templates").select("name, version, body").eq("is_active", true).order("name");
      check(error, "template list");
      return data ?? [];
    },
    async saveTemplate(name, body, adminId) {
      const { data: latest, error: e1 } = await db.from("prompt_templates").select("version").eq("name", name).order("version", { ascending: false }).limit(1).maybeSingle();
      check(e1, "template version");
      const version = (latest?.version ?? 0) + 1;
      const { data: created, error: e2 } = await db.from("prompt_templates").insert({ name, version, body, is_active: false, created_by: adminId }).select("id").single();
      check(e2, "template insert");
      const { error: e3 } = await db.from("prompt_templates").update({ is_active: false }).eq("name", name).eq("is_active", true);
      check(e3, "template deactivate");
      const { error: e4 } = await db.from("prompt_templates").update({ is_active: true }).eq("id", created!.id);
      check(e4, "template activate");
      return { version };
    },
    async monthSpend(kind, sinceIso) {
      const { data, error } = await db.from("ai_generations").select("cost_usd_micro").eq("kind", kind).gte("created_at", sinceIso);
      check(error, "month spend");
      return (data ?? []).reduce((sum, r) => sum + Number(r.cost_usd_micro), 0);
    },
    async countForSuitSince(suitId, sinceIso) {
      const { count, error } = await db
        .from("ai_generations")
        .select("id", { count: "exact", head: true })
        .eq("suit_id", suitId)
        .neq("status", "blocked_budget")
        .gte("created_at", sinceIso);
      check(error, "run count");
      return count ?? 0;
    },
    async countTryonSince(requesterHash, sinceIso) {
      const { count, error } = await db
        .from("ai_generations")
        .select("id", { count: "exact", head: true })
        .eq("kind", "tryon")
        .eq("requester_hash", requesterHash)
        .neq("status", "blocked_budget")
        .gte("created_at", sinceIso);
      check(error, "tryon count");
      return count ?? 0;
    },
    async hasActiveJob(suitId) {
      const { count, error } = await db.from("ai_generations").select("id", { count: "exact", head: true }).eq("suit_id", suitId).in("status", ["queued", "running"]);
      check(error, "active job");
      return (count ?? 0) > 0;
    },
    async insert(row) {
      const { data, error } = await db.from("ai_generations").insert(row).select("id").single();
      check(error, "generation insert");
      return data!;
    },
    async claim(id) {
      const { data, error } = await db
        .from("ai_generations")
        .update({ status: "running", started_at: new Date().toISOString() })
        .eq("id", id)
        .eq("status", "queued")
        .select(GEN_SELECT)
        .maybeSingle();
      check(error, "generation claim");
      return data as GenRow | null;
    },
    async get(id) {
      const { data, error } = await db.from("ai_generations").select(GEN_SELECT).eq("id", id).maybeSingle();
      check(error, "generation read");
      return data as GenRow | null;
    },
    async update(id, patch) {
      const { error } = await db.from("ai_generations").update(patch).eq("id", id);
      check(error, "generation update");
    },
    async failIfStuck(id, olderThanIso) {
      const { error } = await db
        .from("ai_generations")
        .update({ status: "failed", error: "timeout", finished_at: new Date().toISOString() })
        .eq("id", id)
        .eq("status", "running")
        .lt("started_at", olderThanIso);
      check(error, "stuck sweep");
    },
  };
}

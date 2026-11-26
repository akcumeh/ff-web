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

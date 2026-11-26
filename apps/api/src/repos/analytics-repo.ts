import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnalyticsRepo, DailyRow } from "../services/analytics.ts";

function check(error: { message: string; code?: string } | null, what: string) {
    if (error) throw new Error(`${what} failed: ${error.message}`);
}

export function supabaseAnalyticsRepo(db: SupabaseClient): AnalyticsRepo {
    return {
        async suitIdBySlug(slug) {
            const { data, error } = await db.from("suits").select("id").eq("slug", slug).eq("status", "published").maybeSingle();
            check(error, "suit lookup");
            return data?.id ?? null;
        },
        async insertEnquiry(code, suitId) {
            const { error } = await db.from("enquiries").upsert({ code, suit_id: suitId }, { onConflict: "code,suit_id", ignoreDuplicates: true });
            check(error, "enquiry insert");
        },
        async countAnon(suitId, metric, source) {
            const { error } = await db.rpc("count_anon_event", { p_suit_id: suitId, p_metric: metric, p_source: source });
            check(error, "anon count");
        },
        async visitorByCookie(hash) {
            const { data, error } = await db.from("visitors").select("id, fp_hash").eq("cookie_hash", hash).maybeSingle();
            check(error, "visitor lookup");
            return data;
        },
        async visitorsByFp(fpHash, sinceIso) {
            const { data, error } = await db.from("visitors").select("id").eq("fp_hash", fpHash).gte("last_seen", sinceIso).limit(2);
            check(error, "fingerprint lookup");
            return (data ?? []).map((r) => r.id);
        },
        async updateVisitor(id, patch) {
            const { error } = await db.from("visitors").update(patch).eq("id", id);
            check(error, "visitor update");
        },
        async createVisitor(row) {
            const { data, error } = await db
                .from("visitors")
                .insert({ ...row, consent_at: new Date().toISOString() })
                .select("id")
                .single();
            check(error, "visitor insert");
            return data!.id;
        },
        async insertEvent(row) {
            const { error } = await db.from("events").insert(row);
            if (error?.code === "23505") return;
            check(error, "event insert");
        },
        async forgetVisitor(cookieHash) {
            const { error } = await db.from("visitors").delete().eq("cookie_hash", cookieHash);
            check(error, "visitor delete");
        },
        async rateLimit(key, windowSeconds, max) {
            const { data, error } = await db.rpc("rate_limit_hit", { p_key: key, p_window_seconds: windowSeconds, p_max: max });
            check(error, "rate limit");
            return data !== false;
        },
        async rollup(day) {
            const { error } = await db.rpc("rollup_day", { p_day: day });
            check(error, "rollup");
        },
        async dailyRows(fromDay, toDay) {
            const { data, error } = await db
                .from("daily_counts")
                .select("day, suit_id, metric, source, anon_count, consented_count")
                .gte("day", fromDay)
                .lte("day", toDay)
                .limit(20000);
            check(error, "daily counts");
            return (data ?? []) as DailyRow[];
        },
        async approxUniques(fromIso, toIso) {
            const { data, error } = await db.rpc("approx_uniques", { p_from: fromIso, p_to: toIso });
            check(error, "uniques");
            return Number(data ?? 0);
        },
        async chatsStarted(fromIso, toIso) {
            const { count, error } = await db
                .from("enquiries")
                .select("id", { count: "exact", head: true })
                .not("chat_started_at", "is", null)
                .gte("created_at", fromIso)
                .lt("created_at", toIso);
            check(error, "chats");
            return count ?? 0;
        },
        async suitRefs(ids) {
            if (!ids.length) return [];
            const { data, error } = await db.from("suits").select("id, ref, title").in("id", ids);
            check(error, "suit refs");
            return data ?? [];
        },
        async latestSnapshot(platform) {
            const { data, error } = await db
                .from("channel_snapshots")
                .select("followers, taken_on")
                .eq("platform", platform)
                .order("taken_on", { ascending: false })
                .limit(1)
                .maybeSingle();
            check(error, "snapshot");
            return data;
        },
        async pendingPacks(olderThanIso) {
            let q = db.from("channel_posts").select("id", { count: "exact", head: true }).eq("platform", "whatsapp_pack").eq("status", "pending");
            if (olderThanIso) q = q.lt("created_at", olderThanIso);
            const { count, error } = await q;
            check(error, "pending packs");
            return count ?? 0;
        },
        async aiBudget(sinceIso) {
            const [{ data: spend, error: e1 }, { data: cap, error: e2 }] = await Promise.all([
                db.from("ai_generations").select("cost_usd_micro").eq("kind", "catalogue").gte("created_at", sinceIso),
                db.from("settings").select("value").eq("key", "ai_monthly_cap_usd_micro").maybeSingle(),
            ]);
            check(e1, "ai spend");
            check(e2, "ai cap");
            return { spent: (spend ?? []).reduce((s, r) => s + Number(r.cost_usd_micro), 0), cap: Number(cap?.value ?? 9_000_000) };
        },
    };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TelegramPort } from "./telegram.ts";

export type NightlyDeps = {
    db: SupabaseClient;
    telegram: TelegramPort | null;
    channelId: string | undefined;
    alertChatId: string | undefined;
    now?: () => Date;
};

type Step = { step: string; ok: boolean; detail?: string };

export function createNightly(deps: NightlyDeps) {
    const now = deps.now ?? (() => new Date());
    const lagosDay = (d: Date) => new Date(d.getTime() + 3600_000).toISOString().slice(0, 10);

    async function step(results: Step[], name: string, fn: () => Promise<string | void>) {
        try {
            const detail = await fn();
            results.push({ step: name, ok: true, ...(detail ? { detail } : {}) });
        } catch (err) {
            results.push({ step: name, ok: false, detail: String(err instanceof Error ? err.message : err).slice(0, 200) });
        }
    }

    const ago = (days: number) => new Date(now().getTime() - days * 86400_000).toISOString();

    return {
        async run(): Promise<Step[]> {
            const results: Step[] = [];
            const { db } = deps;

            await step(results, "rollup", async () => {
                for (const offset of [1, 2]) {
                    const { error } = await db.rpc("rollup_day", { p_day: lagosDay(new Date(now().getTime() - offset * 86400_000)) });
                    if (error) throw new Error(error.message);
                }
            });

            await step(results, "delete_old_data", async () => {
                const e1 = await db.from("events").delete().lt("created_at", ago(90));
                if (e1.error) throw new Error(e1.error.message);
                const e2 = await db.from("visitors").delete().lt("last_seen", ago(365));
                if (e2.error) throw new Error(e2.error.message);
            });

            await step(results, "telegram_followers", async () => {
                if (!deps.telegram || !deps.channelId) return "skipped: telegram not set up";
                const count = await deps.telegram.memberCount(deps.channelId);
                const { error } = await db
                    .from("channel_snapshots")
                    .upsert({ platform: "telegram", taken_on: lagosDay(now()), followers: count, source: "api" }, { onConflict: "platform,taken_on" });
                if (error) throw new Error(error.message);
                return `${count} followers`;
            });

            await step(results, "sweep_stuck_jobs", async () => {
                const { error } = await db
                    .from("ai_generations")
                    .update({ status: "failed", error: "timeout", finished_at: now().toISOString() })
                    .eq("status", "running")
                    .lt("started_at", new Date(now().getTime() - 10 * 60_000).toISOString());
                if (error) throw new Error(error.message);
            });

            await step(results, "clean_rate_limits", async () => {
                const { error } = await db.from("rate_limits").delete().lt("window_start", ago(2));
                if (error) throw new Error(error.message);
            });

            await step(results, "nudge_packs", async () => {
                const { count, error } = await db
                    .from("channel_posts")
                    .select("id", { count: "exact", head: true })
                    .eq("platform", "whatsapp_pack")
                    .eq("status", "pending")
                    .lt("created_at", ago(1));
                if (error) throw new Error(error.message);
                if (count && deps.telegram && deps.alertChatId) {
                    await deps.telegram.sendMessage(deps.alertChatId, `${count} suit${count === 1 ? " is" : "s are"} waiting to be posted on the WhatsApp channel. Open the admin, To post.`);
                }
                return `${count ?? 0} waiting`;
            });

            const failed = results.filter((r) => !r.ok);
            if (failed.length && deps.telegram && deps.alertChatId) {
                await deps.telegram.sendMessage(deps.alertChatId, `Nightly job: ${failed.map((f) => f.step).join(", ")} failed.`).catch(() => {});
            }
            return results;
        },
    };
}

export type Nightly = ReturnType<typeof createNightly>;

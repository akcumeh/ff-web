import { createHmac } from "node:crypto";
import { CONSENT_VERSION, type Stats, type StatsRange, type TrackEvent } from "@ff/shared";
import { HttpError } from "../lib/errors.ts";
import { lagosDayStart, lagosMonthStart } from "./generation.ts";

export const BOT_RE = /bot|crawl|spider|headless|lighthouse|preview|monitor/i;

export type DailyRow = { day: string; suit_id: string | null; metric: string; source: string; anon_count: number; consented_count: number };

export interface AnalyticsRepo {
    suitIdBySlug(slug: string): Promise<string | null>;
    insertEnquiry(code: string, suitId: string): Promise<void>;
    countAnon(suitId: string | null, metric: string, source: string): Promise<void>;
    visitorByCookie(hash: string): Promise<{ id: string; fp_hash: string | null } | null>;
    visitorsByFp(fpHash: string, sinceIso: string): Promise<string[]>;
    updateVisitor(id: string, patch: Record<string, unknown>): Promise<void>;
    createVisitor(row: { cookie_hash: string; fp_hash: string | null; consent_version: string }): Promise<string>;
    insertEvent(row: { visitor_id: string; type: string; suit_id: string | null; source: string; meta?: Record<string, unknown> | null }): Promise<void>;
    forgetVisitor(cookieHash: string): Promise<void>;
    rateLimit(key: string, windowSeconds: number, max: number): Promise<boolean>;
    rollup(day: string): Promise<void>;
    dailyRows(fromDay: string, toDay: string): Promise<DailyRow[]>;
    approxUniques(fromIso: string, toIso: string): Promise<number>;
    chatsStarted(fromIso: string, toIso: string): Promise<number>;
    suitRefs(ids: string[]): Promise<{ id: string; ref: string; title: string }[]>;
    latestSnapshot(platform: "telegram" | "whatsapp"): Promise<{ followers: number; taken_on: string } | null>;
    pendingPacks(olderThanIso?: string): Promise<number>;
    aiBudget(sinceIso: string): Promise<{ spent: number; cap: number }>;
}

export type AnalyticsDeps = {
    repo: AnalyticsRepo;
    visitorSecret: string | undefined;
    ipSecret: string | undefined;
    now?: () => Date;
};

const hmac = (secret: string, value: string) => createHmac("sha256", secret).update(value).digest("hex");
const ratio = (a: number, b: number) => (b > 0 ? a / b : null);
const isoDay = (d: Date) => new Date(d.getTime() + 3600_000).toISOString().slice(0, 10);

export function createAnalytics(deps: AnalyticsDeps) {
    const now = deps.now ?? (() => new Date());

    function addressKey(ip: string | undefined): string {
        const day = now().toISOString().slice(0, 10);
        return deps.ipSecret ? hmac(deps.ipSecret, `${ip ?? "unknown"}|${day}`).slice(0, 32) : "no-ip-secret";
    }

    async function limit(route: string, ip: string | undefined, max: number, windowSeconds = 60) {
        if (!(await deps.repo.rateLimit(`${route}:${addressKey(ip)}`, windowSeconds, max))) {
            throw new HttpError(429, "rate_limited", "Too many requests. Wait a minute.");
        }
    }

    async function resolveVisitor(v: NonNullable<TrackEvent["visitor"]>): Promise<string | null> {
        if (!deps.visitorSecret || v.consent_version !== CONSENT_VERSION) return null;
        const cookieHash = hmac(deps.visitorSecret, v.cookie);
        const fpHash = v.fp ? hmac(deps.visitorSecret, v.fp) : null;
        const seenAt = now().toISOString();

        const byCookie = await deps.repo.visitorByCookie(cookieHash);
        if (byCookie) {
            await deps.repo.updateVisitor(byCookie.id, { last_seen: seenAt, ...(fpHash && fpHash !== byCookie.fp_hash ? { fp_hash: fpHash } : {}) });
            return byCookie.id;
        }
        if (fpHash) {
            const matches = await deps.repo.visitorsByFp(fpHash, new Date(now().getTime() - 30 * 86400_000).toISOString());
            if (matches.length === 1) {
                await deps.repo.updateVisitor(matches[0]!, { cookie_hash: cookieHash, last_seen: seenAt });
                return matches[0]!;
            }
        }
        return deps.repo.createVisitor({ cookie_hash: cookieHash, fp_hash: fpHash, consent_version: v.consent_version });
    }

    async function record(type: string, suitId: string | null, source: string, visitorId: string | null, meta?: Record<string, unknown>) {
        if (visitorId) await deps.repo.insertEvent({ visitor_id: visitorId, type, suit_id: suitId, source, meta: meta ?? null });
        else await deps.repo.countAnon(suitId, type, source);
    }

    return {
        limit,

        async visitorIdForCookie(cookie: string): Promise<string | null> {
            if (!deps.visitorSecret) return null;
            return (await deps.repo.visitorByCookie(hmac(deps.visitorSecret, cookie)))?.id ?? null;
        },

        async track(input: TrackEvent, ctx: { ip: string | undefined; userAgent: string | undefined }) {
            if (BOT_RE.test(ctx.userAgent ?? "")) return;
            await limit("events", ctx.ip, 60);

            let suitId: string | null = null;
            if (input.suit_slug) {
                suitId = await deps.repo.suitIdBySlug(input.suit_slug);
                if (!suitId) return;
            } else if (input.type === "suit_view" || input.type === "enquire_click") {
                return;
            }

            if (input.type === "enquire_click" && input.code && suitId) await deps.repo.insertEnquiry(input.code, suitId);

            const visitorId = input.visitor ? await resolveVisitor(input.visitor) : null;
            await record(input.type, suitId, input.source, visitorId, input.order_ref ? { order_ref: input.order_ref } : undefined);
        },

        async forget(cookie: string, ip: string | undefined) {
            await limit("forget", ip, 60);
            if (!deps.visitorSecret) return;
            await deps.repo.forgetVisitor(hmac(deps.visitorSecret, cookie));
        },

        async serverEvent(type: "checkout_start" | "payment_success", suitId: string, visitorId: string | null) {
            await record(type, suitId, "other", visitorId);
        },

        async stats(key: StatsRange): Promise<Stats> {
            const end = now();
            const days = { "7d": 7, "30d": 30, "12w": 84, "12m": 365 }[key];
            const fromIso = new Date(new Date(lagosDayStart(end)).getTime() - (days - 1) * 86400_000).toISOString();
            const fromDay = isoDay(new Date(fromIso));
            const toDay = isoDay(end);

            await deps.repo.rollup(toDay);
            await deps.repo.rollup(isoDay(new Date(end.getTime() - 86400_000)));

            const rows = await deps.repo.dailyRows(fromDay, toDay);
            const site = rows.filter((r) => r.suit_id === null);
            const sum = (metric: string, field: "all" | "consented" = "all") =>
                site.filter((r) => r.metric === metric).reduce((s, r) => s + r.consented_count + (field === "all" ? r.anon_count : 0), 0);

            const views = sum("suit_view");
            const accepted = sum("suit_view", "consented");
            const enquiries = sum("enquire_click");
            const checkouts = sum("checkout_start");
            const payments = sum("payment_success");
            const deliveries = sum("delivery_click");
            const chats = await deps.repo.chatsStarted(fromIso, end.toISOString());

            const perSuit = new Map<string, { views: number; enquire_clicks: number; payments: number }>();
            for (const r of rows) {
                if (!r.suit_id) continue;
                const e = perSuit.get(r.suit_id) ?? { views: 0, enquire_clicks: 0, payments: 0 };
                const n = r.anon_count + r.consented_count;
                if (r.metric === "suit_view") e.views += n;
                if (r.metric === "enquire_click") e.enquire_clicks += n;
                if (r.metric === "payment_success") e.payments += n;
                perSuit.set(r.suit_id, e);
            }
            const refs = await deps.repo.suitRefs([...perSuit.keys()]);
            const joins = new Map<string, number>();
            for (const r of site.filter((x) => x.metric === "join_channel_click")) joins.set(r.source, (joins.get(r.source) ?? 0) + r.anon_count + r.consented_count);

            const tg = await deps.repo.latestSnapshot("telegram");
            const wa = await deps.repo.latestSnapshot("whatsapp");
            const ai = await deps.repo.aiBudget(lagosMonthStart(end));

            return {
                range: { from: fromIso, to: end.toISOString(), key },
                traffic: {
                    suit_views_all: views,
                    suit_views_accepted: accepted,
                    approx_unique_visitors: days <= 90 ? await deps.repo.approxUniques(fromIso, end.toISOString()) : null,
                    consent_rate: ratio(accepted, views),
                },
                funnel: { suit_views: views, enquire_clicks: enquiries, chats_started: chats, checkout_starts: checkouts, payments, delivery_clicks: deliveries },
                rates: {
                    enquiry_rate: ratio(enquiries, views),
                    chat_started_rate: ratio(chats, enquiries),
                    checkout_rate: ratio(checkouts, views),
                    pay_rate: ratio(payments, views),
                    checkout_to_paid: ratio(payments, checkouts),
                    delivery_followup: ratio(deliveries, payments),
                },
                by_suit: refs
                    .map((s) => ({ ref: s.ref, title: s.title, ...perSuit.get(s.id)! }))
                    .sort((a, b) => b.views - a.views),
                channels: {
                    telegram: { followers: tg?.followers ?? null, as_of: tg?.taken_on ?? null },
                    whatsapp: {
                        followers: wa?.followers ?? null,
                        as_of: wa?.taken_on ?? null,
                        stale: !wa || end.getTime() - Date.parse(wa.taken_on) > 8 * 86400_000,
                    },
                    join_clicks_by_source: [...joins.entries()].map(([source, clicks]) => ({ source, clicks })),
                },
                pending_packs: await deps.repo.pendingPacks(),
                ai: { month_spend_usd_micro: ai.spent, cap_usd_micro: ai.cap },
            };
        },
    };
}

export type Analytics = ReturnType<typeof createAnalytics>;

import { z } from "zod";

export const CONSENT_VERSION = "v1";
export const ENQUIRY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const EventSource = z.enum(["direct", "wa", "tg", "search", "other"]);
export type EventSource = z.infer<typeof EventSource>;

export const TrackEvent = z.strictObject({
    type: z.enum(["suit_view", "enquire_click", "delivery_click", "join_channel_click"]),
    suit_slug: z.string().max(80).optional(),
    source: EventSource,
    code: z.string().regex(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/).optional(),
    order_ref: z.string().max(20).optional(),
    visitor: z
        .strictObject({
            cookie: z.string().regex(/^[a-f0-9]{32}$/),
            fp: z.string().regex(/^[A-Za-z0-9]{16,64}$/).optional(),
            consent_version: z.string().max(20),
        })
        .optional(),
});
export type TrackEvent = z.infer<typeof TrackEvent>;

export const ForgetRequest = z.strictObject({ cookie: z.string().regex(/^[a-f0-9]{32}$/) });

export const StatsRange = z.enum(["7d", "30d", "12w", "12m"]);
export type StatsRange = z.infer<typeof StatsRange>;

export const Stats = z.object({
    range: z.object({ from: z.string(), to: z.string(), key: StatsRange }),
    traffic: z.object({
        suit_views_all: z.number(),
        suit_views_accepted: z.number(),
        approx_unique_visitors: z.number().nullable(),
        consent_rate: z.number().nullable(),
    }),
    funnel: z.object({
        suit_views: z.number(),
        enquire_clicks: z.number(),
        chats_started: z.number(),
        checkout_starts: z.number(),
        payments: z.number(),
        delivery_clicks: z.number(),
    }),
    rates: z.object({
        enquiry_rate: z.number().nullable(),
        chat_started_rate: z.number().nullable(),
        checkout_rate: z.number().nullable(),
        pay_rate: z.number().nullable(),
        checkout_to_paid: z.number().nullable(),
        delivery_followup: z.number().nullable(),
    }),
    by_suit: z.array(z.object({ ref: z.string(), title: z.string(), views: z.number(), enquire_clicks: z.number(), payments: z.number() })),
    channels: z.object({
        telegram: z.object({ followers: z.number().nullable(), as_of: z.string().nullable() }),
        whatsapp: z.object({ followers: z.number().nullable(), as_of: z.string().nullable(), stale: z.boolean() }),
        join_clicks_by_source: z.array(z.object({ source: z.string(), clicks: z.number() })),
    }),
    pending_packs: z.number(),
    ai: z.object({ month_spend_usd_micro: z.number(), cap_usd_micro: z.number() }),
});
export type Stats = z.infer<typeof Stats>;

export const Enquiry = z.object({
    id: z.uuid(),
    code: z.string(),
    suit_ref: z.string(),
    created_at: z.string(),
    chat_started_at: z.string().nullable(),
});
export const EnquiryList = z.object({ items: z.array(Enquiry) });
export const EnquiryPatch = z.strictObject({ chat_started: z.boolean() });
export const SnapshotInput = z.strictObject({
    platform: z.literal("whatsapp"),
    taken_on: z.iso.date(),
    followers: z.number().int().min(0).max(10_000_000),
});

import { createApp } from "../src/create-app.ts";
import type { AuthDeps, TokenClaims } from "../src/lib/auth.ts";
import { createCatalogue, type CatalogueRepo, type SuitRow } from "../src/services/catalogue.ts";
import { createAdminCatalogue, type AdminCatalogue } from "../src/services/admin-catalogue.ts";
import { memoryRepo, memoryStorage, recorder } from "./admin-fakes.ts";
import { createGeneration, type Generation } from "../src/services/generation.ts";
import { memoryGenRepo, scriptedGemini } from "./ai-fakes.ts";
import { createChannels, type Channels } from "../src/services/channels.ts";
import { memoryChannelRepo } from "./channel-fakes.ts";

export const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
export const STRANGER_ID = "22222222-2222-4222-8222-222222222222";
export const SITE = "http://localhost:3000";
export const IMG_BASE = "https://example.supabase.co/storage/v1/object/public/public-suits/";

export const OLD_BATCH = "b0000000-0000-4000-8000-000000000001";
export const NEW_BATCH = "b0000000-0000-4000-8000-000000000002";

function suit(n: number, style: "london" | "turkey", batch: string, publishedAt: string, inStock = true): SuitRow {
    const id = `a0000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`;
    const ref = `${style === "london" ? "LN" : "TR"}-${String(n).padStart(2, "0")}`;
    return {
        id,
        ref,
        slug: `${style}-style-${ref.toLowerCase()}`,
        style,
        title: style === "london" ? "London style" : "Turkey style",
        description: "Sample",
        price_kobo: 4_500_000,
        batch_id: batch,
        published_at: publishedAt,
        updated_at: publishedAt,
        suit_variants: [
            { id: `c0000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`, colour: "Cream", colour_hex: "#efe3c8", size: "12", in_stock: inStock },
        ],
        suit_images: [
            { id: `d0000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`, kind: "final", storage_path: `${id}/img`, widths: [480, 320], width: 480, height: 960, blur_data: null, alt_text: "Model in a cream suit", is_cover: true, generation_id: null },
            { id: `e0000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`, kind: "original", storage_path: `${id}/orig`, widths: [1080], width: 1080, height: 1440, blur_data: null, alt_text: null, is_cover: false, generation_id: null },
        ],
    };
}

export const SUITS: SuitRow[] = [
    suit(5, "london", NEW_BATCH, "2026-11-15T08:00:00.000Z"),
    suit(4, "turkey", NEW_BATCH, "2026-11-14T08:00:00.000Z"),
    suit(3, "london", NEW_BATCH, "2026-11-13T08:00:00.000Z"),
    suit(2, "turkey", OLD_BATCH, "2026-09-18T08:00:00.000Z", false),
    suit(1, "london", OLD_BATCH, "2026-09-17T08:00:00.000Z"),
];

export function fakeCatalogueRepo(rows: SuitRow[] = SUITS): CatalogueRepo {
    const sorted = [...rows].sort((a, b) => b.published_at.localeCompare(a.published_at) || b.id.localeCompare(a.id));
    return {
        async latestBatchId() {
            return rows.some((r) => r.batch_id === NEW_BATCH) ? NEW_BATCH : rows[0]?.batch_id ?? null;
        },
        async listPublished(f) {
            return sorted
                .filter((r) => !f.style || r.style === f.style)
                .filter((r) => !f.since || r.published_at >= f.since)
                .filter((r) => !f.batchId || r.batch_id === f.batchId)
                .filter((r) => !f.excludeSlug || r.slug !== f.excludeSlug)
                .filter((r) => !f.after || r.published_at < f.after.publishedAt || (r.published_at === f.after.publishedAt && r.id < f.after.id))
                .slice(0, f.limit);
        },
        async findPublishedBySlug(slug) {
            return rows.find((r) => r.slug === slug) ?? null;
        },
        async sitemap() {
            return sorted.map((r) => ({ slug: r.slug, updated_at: r.updated_at }));
        },
    };
}

export type FakeOptions = {
    rawBodyRouters?: import("express").Router[];
    publicRouters?: import("express").Router[];
    adminRouters?: import("express").Router[];
    tokens?: Record<string, TokenClaims>;
    totpUsers?: string[];
    now?: Date;
    adminCatalogue?: AdminCatalogue;
    generation?: Generation;
    channels?: Channels;
    suitLookup?: { getSuit: ReturnType<typeof memoryRepo>["repo"]["getSuit"] };
    background?: (p: Promise<unknown>) => void;
};

export function fakeAuth(opts: FakeOptions = {}): AuthDeps {
    const tokens = opts.tokens ?? {};
    const totp = new Set(opts.totpUsers ?? []);
    return {
        async verifyToken(token) {
            return tokens[token] ?? null;
        },
        async findAdmin(userId) {
            return userId === ADMIN_ID ? { user_id: ADMIN_ID, email: "owner@example.com" } : null;
        },
        async hasVerifiedTotp(userId) {
            return totp.has(userId);
        },
    };
}

export function testApp(opts: FakeOptions = {}) {
    const now = opts.now ?? new Date("2026-11-20T12:00:00.000Z");
    return createApp({
        allowedOrigins: [SITE],
        auth: fakeAuth(opts),
        catalogue: createCatalogue(fakeCatalogueRepo(), IMG_BASE, () => now),
        adminCatalogue:
            opts.adminCatalogue ??
            createAdminCatalogue({ repo: memoryRepo().repo, storage: memoryStorage().storage, ...recorder() }),
        generation:
            opts.generation ??
            createGeneration({ gen: memoryGenRepo().repo, catalogue: memoryRepo().repo, storage: memoryStorage().storage, gemini: scriptedGemini().gemini, audit: recorder().audit, monthlyCapUsdMicro: 9_000_000 }),
        background: opts.background ?? (() => {}),
        channels:
            opts.channels ??
            createChannels({ repo: memoryChannelRepo().repo, storage: memoryStorage().storage, telegram: null, channelId: undefined, alertChatId: undefined, siteUrl: SITE, audit: recorder().audit }),
        suitLookup: opts.suitLookup ?? memoryRepo().repo,
        rawBodyRouters: opts.rawBodyRouters,
        publicRouters: opts.publicRouters,
        adminRouters: opts.adminRouters,
    });
}

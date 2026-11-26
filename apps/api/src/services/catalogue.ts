import type { Img, SitemapEntry, SuitCard, SuitDetail, SuitList, SuitListQuery } from "@ff/shared";
import { anatomyFromColumns, type AnatomyColumns } from "@ff/shared";
import { HttpError } from "../lib/errors.ts";

export type VariantRow = { id: string; colour: string; colour_hex: string | null; size: string; in_stock: boolean };

export type ImageRow = {
    id: string;
    kind: "original" | "candidate" | "final" | "detail";
    storage_path: string;
    widths: number[];
    width: number | null;
    height: number | null;
    blur_data: string | null;
    alt_text: string | null;
    is_cover: boolean;
    generation_id: string | null;
};

export type SuitRow = {
    id: string;
    ref: string;
    slug: string;
    style: "london" | "turkey";
    title: string;
    description: string | null;
    price_kobo: number;
    batch_id: string;
    published_at: string;
    updated_at: string;
    suit_variants: VariantRow[];
} & Partial<AnatomyColumns> & {
    suit_images: ImageRow[];
};

export type ListFilter = {
    style?: "london" | "turkey";
    since?: string;
    batchId?: string;
    excludeSlug?: string;
    limit: number;
    after?: { publishedAt: string; id: string };
};

export interface CatalogueRepo {
    latestBatchId(): Promise<string | null>;
    listPublished(filter: ListFilter): Promise<SuitRow[]>;
    findPublishedBySlug(slug: string): Promise<SuitRow | null>;
    sitemap(): Promise<SitemapEntry[]>;
}

export function encodeCursor(row: { published_at: string; id: string }): string {
    return Buffer.from(`${new Date(row.published_at).toISOString()}|${row.id}`).toString("base64url");
}

export function decodeCursor(cursor: string): { publishedAt: string; id: string } {
    const [ts, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
    const valid = ts && id && !Number.isNaN(Date.parse(ts)) && /^[0-9a-f-]{36}$/.test(id);
    if (!valid) throw new HttpError(400, "validation_failed", "The cursor is not valid.", [{ path: "cursor", message: "Not valid" }]);
    return { publishedAt: ts, id };
}

export function createCatalogue(repo: CatalogueRepo, publicImageBase: string, now: () => Date = () => new Date()) {
    const toImg = (row: ImageRow): Img | null => {
        if (!row.width || !row.height || row.widths.length === 0) return null;
        return {
            srcset: [...row.widths].sort((a, b) => a - b).map((w) => ({ w, url: `${publicImageBase}${row.storage_path}-${w}.webp` })),
            width: row.width,
            height: row.height,
            blur: row.blur_data,
            alt: row.alt_text ?? "",
        };
    };

    const toCard = (row: SuitRow, latestBatchId: string | null): SuitCard => {
        const publicImages = row.suit_images.filter((i) => i.kind === "final" || i.kind === "detail");
        const coverRow = publicImages.find((i) => i.is_cover) ?? publicImages.find((i) => i.kind === "final") ?? null;
        const colours = new Map<string, { name: string; hex: string | null; in_stock: boolean }>();
        for (const v of row.suit_variants) {
            const c = colours.get(v.colour) ?? { name: v.colour, hex: v.colour_hex, in_stock: false };
            c.in_stock ||= v.in_stock;
            colours.set(v.colour, c);
        }
        const isLatest = latestBatchId !== null && row.batch_id === latestBatchId;
        return {
            id: row.id,
            ref: row.ref,
            slug: row.slug,
            style: row.style,
            title: row.title,
            price_kobo: row.price_kobo,
            is_latest: isLatest,
            is_past: !isLatest,
            sold_out: row.suit_variants.length === 0 || row.suit_variants.every((v) => !v.in_stock),
            cover: coverRow ? toImg(coverRow) : null,
            cover_is_ai: coverRow?.generation_id != null,
            colours: [...colours.values()],
        };
    };

    return {
        async list(query: SuitListQuery): Promise<SuitList> {
            const latestBatchId = await repo.latestBatchId();
            if (query.latest && !latestBatchId) return { items: [], next_cursor: null };
            const since = query.months ? new Date(now().getTime() - query.months * 30 * 24 * 3600 * 1000).toISOString() : undefined;
            const rows = await repo.listPublished({
                style: query.style,
                since,
                batchId: query.latest ? (latestBatchId ?? undefined) : undefined,
                excludeSlug: query.exclude,
                limit: query.limit + 1,
                after: query.cursor ? decodeCursor(query.cursor) : undefined,
            });
            const page = rows.slice(0, query.limit);
            const last = page.at(-1);
            return {
                items: page.map((r) => toCard(r, latestBatchId)),
                next_cursor: rows.length > query.limit && last ? encodeCursor(last) : null,
            };
        },

        async bySlug(slug: string): Promise<SuitDetail> {
            const row = await repo.findPublishedBySlug(slug);
            if (!row) throw new HttpError(404, "not_found", "That design is not on the site.");
            const latestBatchId = await repo.latestBatchId();
            const card = toCard(row, latestBatchId);
            const detailRow = row.suit_images.find((i) => i.kind === "detail");
            const related = await repo.listPublished({ style: row.style, excludeSlug: row.slug, limit: 4 });
            return {
                ...card,
                description: row.description,
                real_photo: card.cover_is_ai && detailRow ? toImg(detailRow) : null,
                variants: row.suit_variants.map((v) => ({ id: v.id, colour: v.colour, hex: v.colour_hex, size: v.size, in_stock: v.in_stock })),
                published_at: new Date(row.published_at).toISOString(),
                anatomy: anatomyFromColumns(row),
                related: related.map((r) => toCard(r, latestBatchId)),
            };
        },

        sitemap: () => repo.sitemap(),
    };
}

export type Catalogue = ReturnType<typeof createCatalogue>;

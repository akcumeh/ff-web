import { z } from "zod";
import { SuitStyle } from "./enums.ts";
import { SuitAnatomy } from "./ai.ts";

export const SLUG_RE = /^(london|turkey)-style-(ln|tr)-[0-9]{2,}$/;

export const Img = z.object({
    srcset: z.array(z.object({ w: z.number().int().positive(), url: z.url() })),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    blur: z.string().nullable(),
    alt: z.string(),
});
export type Img = z.infer<typeof Img>;

export const SuitColour = z.object({
    name: z.string(),
    hex: z.string().nullable(),
    in_stock: z.boolean(),
});

export const SuitCard = z.object({
    id: z.uuid(),
    ref: z.string(),
    slug: z.string(),
    style: SuitStyle,
    title: z.string(),
    price_kobo: z.number().int().positive(),
    is_latest: z.boolean(),
    is_past: z.boolean(),
    sold_out: z.boolean(),
    cover: Img.nullable(),
    cover_is_ai: z.boolean(),
    colours: z.array(SuitColour),
});
export type SuitCard = z.infer<typeof SuitCard>;

export const SuitDetail = SuitCard.extend({
    description: z.string().nullable(),
    real_photo: Img.nullable(),
    variants: z.array(
        z.object({ id: z.uuid(), colour: z.string(), hex: z.string().nullable(), size: z.string(), in_stock: z.boolean() }),
    ),
    published_at: z.iso.datetime({ offset: true }),
    anatomy: SuitAnatomy,
    related: z.array(SuitCard),
});
export type SuitDetail = z.infer<typeof SuitDetail>;

const boolParam = z.enum(["true", "false"]).transform((v) => v === "true");

export const SuitListQuery = z.strictObject({
    style: SuitStyle.optional(),
    months: z.coerce.number().int().min(1).max(24).optional(),
    latest: boolParam.optional(),
    exclude: z.string().regex(SLUG_RE).optional(),
    limit: z.coerce.number().int().min(1).max(60).default(24),
    cursor: z.string().max(200).optional(),
});
export type SuitListQuery = z.infer<typeof SuitListQuery>;

export const SuitList = z.object({
    items: z.array(SuitCard),
    next_cursor: z.string().nullable(),
});
export type SuitList = z.infer<typeof SuitList>;

export const SitemapEntry = z.object({ slug: z.string(), updated_at: z.string() });
export type SitemapEntry = z.infer<typeof SitemapEntry>;

import { z } from "zod";
import { SuitStatus, SuitStyle } from "./enums.ts";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const INCOMING_PATH_RE = /^incoming\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

export const PriceKobo = z.number().int().min(100, "Enter a price").max(500_000_000, "That price is too high");

export const UploadSignRequest = z.strictObject({
  files: z
    .array(
      z.strictObject({
        name: z.string().min(1).max(200),
        content_type: z.enum(IMAGE_TYPES, "Use a JPEG, PNG or WebP photo"),
        size: z.number().int().positive().max(MAX_UPLOAD_BYTES, "Each photo must be 10 MB or less"),
      }),
    )
    .min(1, "Add at least one photo")
    .max(8, "Add 8 photos or fewer"),
});
export type UploadSignRequest = z.infer<typeof UploadSignRequest>;

export const UploadSignResponse = z.object({
  uploads: z.array(z.object({ path: z.string(), signed_url: z.url(), token: z.string() })),
});
export type UploadSignResponse = z.infer<typeof UploadSignResponse>;

export const Batch = z.object({ id: z.uuid(), label: z.string(), arrived_on: z.string() });
export type Batch = z.infer<typeof Batch>;

export const BatchCreate = z.strictObject({
  label: z.string().trim().min(1, "Name the batch").max(80),
  arrived_on: z.iso.date("Pick the date the batch arrived"),
});

export const VariantInput = z.strictObject({
  colour: z.string().trim().max(30).optional(),
  colour_hex: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a colour like #1d2b4a")
    .optional(),
  sizes: z.array(z.string().trim().min(1).max(10)).min(1, "Add at least one size").max(12),
});
export type VariantInput = z.infer<typeof VariantInput>;

export const SuitCreate = z.strictObject({
  batch: z.union([z.strictObject({ id: z.uuid() }), BatchCreate]),
  style: SuitStyle,
  title: z.string().trim().min(3, "Title needs 3 or more characters").max(80),
  description: z.string().trim().max(600).optional(),
  price_kobo: PriceKobo,
  variants: z.array(VariantInput).min(1, "Add at least one colour").max(12),
  images: z.array(z.strictObject({ path: z.string().regex(INCOMING_PATH_RE) })).min(1, "Add at least one photo").max(8),
});
export type SuitCreate = z.infer<typeof SuitCreate>;

export const SuitPatch = z.strictObject({
  title: z.string().trim().min(3).max(80).optional(),
  description: z.string().trim().max(600).nullable().optional(),
  price_kobo: PriceKobo.optional(),
  batch_id: z.uuid().optional(),
  variants: z.array(VariantInput).min(1).max(12).optional(),
  variant_updates: z.array(z.strictObject({ id: z.uuid(), in_stock: z.boolean() })).max(200).optional(),
  image_alts: z.array(z.strictObject({ id: z.uuid(), alt_text: z.string().trim().max(125) })).max(20).optional(),
});
export type SuitPatch = z.infer<typeof SuitPatch>;

export const SelectImage = z.strictObject({
  original_image_id: z.uuid().optional(),
  candidate_image_id: z.uuid().optional(),
  alt_text: z.string().trim().min(1, "Describe the photo").max(125, "Keep it to 125 characters"),
});
export type SelectImage = z.infer<typeof SelectImage>;
export const SelectImageChecked = SelectImage.refine((v) => Boolean(v.original_image_id) !== Boolean(v.candidate_image_id), { message: "Pick one photo", path: ["image"] });

export const PublishInput = z.strictObject({ repost: z.boolean().optional() });

export const AdminImage = z.object({
  id: z.uuid(),
  kind: z.enum(["original", "candidate", "final", "detail"]),
  url: z.string(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  alt_text: z.string().nullable(),
  is_cover: z.boolean(),
});
export type AdminImage = z.infer<typeof AdminImage>;

export const AdminVariant = z.object({
  id: z.uuid(),
  colour: z.string(),
  colour_hex: z.string().nullable(),
  size: z.string(),
  in_stock: z.boolean(),
});

export const AdminSuitSummary = z.object({
  id: z.uuid(),
  ref: z.string(),
  slug: z.string(),
  style: SuitStyle,
  title: z.string(),
  status: SuitStatus,
  price_kobo: z.number(),
  batch_label: z.string().nullable(),
  updated_at: z.string(),
});
export type AdminSuitSummary = z.infer<typeof AdminSuitSummary>;

export const AdminSuitDetail = AdminSuitSummary.extend({
  description: z.string().nullable(),
  batch_id: z.uuid(),
  published_at: z.string().nullable(),
  variants: z.array(AdminVariant),
  images: z.array(AdminImage),
});
export type AdminSuitDetail = z.infer<typeof AdminSuitDetail>;

export const AdminSuitList = z.object({ items: z.array(AdminSuitSummary) });
export const BatchList = z.object({ items: z.array(Batch) });

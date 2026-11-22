import { z } from "zod";

export const GenStatus = z.enum(["queued", "running", "succeeded", "failed", "failed_safety", "blocked_budget", "cancelled"]);
export type GenStatus = z.infer<typeof GenStatus>;

export const Observation = z.object({
  is_garment: z.boolean(),
  garment: z.string(),
  colour_seen: z.string(),
  fabric_look: z.string(),
  neckline: z.string(),
  sleeves: z.string(),
  length: z.string(),
  trim: z.string(),
  pattern: z.string(),
  notes_for_drawer: z.string(),
  alt_text: z.string().max(200),
  problems: z.array(z.string()),
});
export type Observation = z.infer<typeof Observation>;

export const GenerateRequest = z.strictObject({
  candidates: z.union([z.literal(1), z.literal(2)]).default(2),
  source_image_ids: z.array(z.uuid()).min(1).max(4).optional(),
  redo_of: z.uuid().optional(),
  extra_instructions: z.string().trim().max(500).optional(),
});
export type GenerateRequest = z.infer<typeof GenerateRequest>;

export const GenerationView = z.object({
  id: z.uuid(),
  status: GenStatus,
  error: z.string().nullable(),
  problems: z.array(z.string()),
  alt_text: z.string().nullable(),
  candidates: z.array(z.object({ image_id: z.uuid(), url: z.string(), width: z.number().nullable(), height: z.number().nullable() })),
  cost_usd_micro: z.number(),
});
export type GenerationView = z.infer<typeof GenerationView>;

export const PromptName = z.enum(["observe", "direct", "tryon"]);
export type PromptName = z.infer<typeof PromptName>;

export const PromptTemplate = z.object({ name: PromptName, version: z.number(), body: z.string() });
export const PromptList = z.object({ items: z.array(PromptTemplate) });
export const PromptUpdate = z.strictObject({ body: z.string().trim().min(20, "Write at least a sentence").max(4000) });

export const AiSettings = z.object({
  style_notes: z.object({ london: z.string(), turkey: z.string() }),
  ai_kill_switch: z.boolean(),
  ai_monthly_cap_usd_micro: z.number(),
  month_spend_usd_micro: z.number(),
  tryon_enabled: z.boolean(),
  tryon_monthly_cap_usd_micro: z.number(),
  tryon_month_spend_usd_micro: z.number(),
});
export type AiSettings = z.infer<typeof AiSettings>;

export const AiSettingsUpdate = z.strictObject({
  style_notes: z.strictObject({ london: z.string().trim().min(1).max(300), turkey: z.string().trim().min(1).max(300) }).optional(),
  ai_kill_switch: z.boolean().optional(),
  ai_monthly_cap_usd_micro: z.number().int().min(0).max(100_000_000).optional(),
  tryon_enabled: z.boolean().optional(),
  tryon_monthly_cap_usd_micro: z.number().int().min(0).max(100_000_000).optional(),
});

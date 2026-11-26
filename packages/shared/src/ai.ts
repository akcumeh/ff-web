import { z } from "zod";

export const GenStatus = z.enum(["queued", "running", "succeeded", "failed", "failed_safety", "blocked_budget", "cancelled"]);
export type GenStatus = z.infer<typeof GenStatus>;

export const SuitType = z.enum(["skirt-suit", "gown-suit"]);
export const SkirtLength = z.enum(["knee", "3/4", "full"]);
export const GownLength = z.enum(["3/4", "full"]);
export const SleeveLength = z.enum(["3/4", "full"]);

export const SuitAnatomy = z.object({
    type: SuitType.nullable(),
    skirt_length: SkirtLength.nullable(),
    gown_length: GownLength.nullable(),
    sleeve_length: SleeveLength.nullable(),
    has_camisole: z.boolean().nullable(),
    has_belt: z.boolean().nullable(),
    has_no_jacket: z.boolean().nullable(),
});
export type SuitAnatomy = z.infer<typeof SuitAnatomy>;

export const EMPTY_ANATOMY: SuitAnatomy = {
    type: null,
    skirt_length: null,
    gown_length: null,
    sleeve_length: null,
    has_camisole: null,
    has_belt: null,
    has_no_jacket: null,
};

export const SuitAnatomyInput = SuitAnatomy.partial().strict();
export type SuitAnatomyInput = z.infer<typeof SuitAnatomyInput>;

export type AnatomyColumns = {
    suit_type: SuitAnatomy["type"];
    skirt_length: SuitAnatomy["skirt_length"];
    gown_length: SuitAnatomy["gown_length"];
    sleeve_length: SuitAnatomy["sleeve_length"];
    has_camisole: boolean | null;
    has_belt: boolean | null;
    has_no_jacket: boolean | null;
};

export const ANATOMY_SELECT = "suit_type, skirt_length, gown_length, sleeve_length, has_camisole, has_belt, has_no_jacket";

export function anatomyFromColumns(c: Partial<AnatomyColumns>): SuitAnatomy {
    return {
        type: c.suit_type ?? null,
        skirt_length: c.skirt_length ?? null,
        gown_length: c.gown_length ?? null,
        sleeve_length: c.sleeve_length ?? null,
        has_camisole: c.has_camisole ?? null,
        has_belt: c.has_belt ?? null,
        has_no_jacket: c.has_no_jacket ?? null,
    };
}

export function anatomyToColumns(a: SuitAnatomyInput): Partial<AnatomyColumns> {
    const out: Partial<AnatomyColumns> = {};
    if (a.type !== undefined) out.suit_type = a.type;
    if (a.skirt_length !== undefined) out.skirt_length = a.skirt_length;
    if (a.gown_length !== undefined) out.gown_length = a.gown_length;
    if (a.sleeve_length !== undefined) out.sleeve_length = a.sleeve_length;
    if (a.has_camisole !== undefined) out.has_camisole = a.has_camisole;
    if (a.has_belt !== undefined) out.has_belt = a.has_belt;
    if (a.has_no_jacket !== undefined) out.has_no_jacket = a.has_no_jacket;
    return out;
}

export const Observation = SuitAnatomy.extend({
    is_garment: z.boolean(),
    color: z.string(),
    pattern: z.string(),
    texture: z.string(),
    notes: z.string(),
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

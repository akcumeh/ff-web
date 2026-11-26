import type { Observation, SuitAnatomy } from "@ff/shared";

export const PROMPT_VERSION = 2;

export const SUIT_ANATOMY = {
    skirt_length: {
        knee: "hem falls just at the knee",
        "3/4": "hem falls between the knee and ankle, around or just above the mid-calf",
        full: "hem falls at or just above the ankle",
    },
    gown_length: {
        "3/4": "hem falls between the knee and ankle, around or just above the mid-calf",
        full: "hem falls at or just above the ankle",
    },
    sleeve_length: {
        "3/4": "sleeve ends between the elbow and wrist, closer to the wrist",
        full: "sleeve ends at the wrist: a watch or bangle should be partially-fully visible",
    },
    has_camisole: "this skirt suit is a 3 piece suit: take note of the camisole",
    has_belt: "gown suit features a belt",
    has_no_jacket: "Turkey-style gown with no jacket; the gown alone is the full outfit",
} as const;

export const STYLE_VARIANTS = {
    headwear: {
        corporate: ["none"],
        professional: ["none"],
        "sunday-wear": ["church hat", "wide-brim fascinator", "decorative headpiece"],
        muslim: ["hijab", "matching turban", "matching headscarf", "draped headscarf coordinated with the suit"],
        upscale: ["none", "small elegant hat"],
        nigerian: [
            "matching color aso-oke gele",
            "Igbo-style headtie in a complementary fabric, folded and pinned neatly",
            "aso-ebi gele in a matching or tonal color, structured and formal",
        ],
    },
    hair: ["low-cut natural hair", "styled bob wig", "neat box braids", "twisted updo", "short locs"],
    skinTone: ["fair", "medium brown", "dark brown", "deep ebony"],
    background: [
        "neutral white studio background",
        "bright church interior",
        "modern corporate office with large windows",
        "luxury home interior with fireplace",
        "elegant marble stairwell",
        "near-white minimal indoor setting",
    ],
    accessories: [
        "small gold or silver stud earrings",
        "pearl necklace",
        "no visible accessories",
        "small brooch on lapel",
        "simple silver bracelet",
        "black leather wristwatch",
    ],
} as const;

export const STYLE_WEIGHTS = {
    fashion: {
        freeform: { corporate: 23, "sunday-wear": 23, upscale: 24, muslim: 20, nigerian: 10 },
        withCaption: { corporate: 25, professional: 10, "sunday-wear": 25, upscale: 22, muslim: 18 },
    },
    age: { "late 20s": 15, "30s": 30, "40s": 30, "50s": 15, "60s": 10 },
} as const;

export type Fashion = keyof typeof STYLE_VARIANTS.headwear;
export type Variant = { fashion: Fashion; headwear: string; hair: string; skinTone: string; age: string; background: string; accessories: string };

function pick<T>(arr: readonly T[], random: () => number): T {
    return arr[Math.floor(random() * arr.length)]!;
}

function weighted<K extends string>(weights: Record<K, number>, random: () => number): K {
    const entries = Object.entries(weights) as [K, number][];
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    let roll = random() * total;
    for (const [key, w] of entries) {
        if (roll < w) return key;
        roll -= w;
    }
    return entries[entries.length - 1]![0];
}

export function pickVariant(hasCaption: boolean, random: () => number = Math.random): Variant {
    const weights: Partial<Record<Fashion, number>> = hasCaption ? STYLE_WEIGHTS.fashion.withCaption : STYLE_WEIGHTS.fashion.freeform;
    const fashion = weighted(weights as Record<Fashion, number>, random);
    return {
        fashion,
        headwear: pick(STYLE_VARIANTS.headwear[fashion], random),
        hair: pick(STYLE_VARIANTS.hair, random),
        skinTone: pick(STYLE_VARIANTS.skinTone, random),
        age: weighted(STYLE_WEIGHTS.age, random),
        background: pick(STYLE_VARIANTS.background, random),
        accessories: pick(STYLE_VARIANTS.accessories, random),
    };
}

export const OBSERVE_PROMPT = `Analyze this suit garment carefully. The photos show one ladies' suit from a shop in Lagos.

SUIT TYPES:
- "skirt-suit": jacket + separate skirt
- "gown-suit": jacket + attached full-length dress panel

SKIRT LENGTH (skirt-suit only, else null):
- "knee": hem at or just above the knee
- "3/4": hem between knee and ankle, closer to mid-calf
- "full": hem at or near the ankle

GOWN LENGTH (gown-suit only, else null):
- "3/4": hem between knee and ankle, closer to mid-calf
- "full": hem at or near the ankle

SLEEVE LENGTH:
- "3/4": sleeve ends between elbow and wrist, closer to the wrist
- "full": sleeve ends at the wrist; a watch or bangle would be partially visible

has_camisole is for skirt suits only. has_belt and has_no_jacket are for gown suits only. Use null when a field does not apply.
pattern examples: "solid", "striped", "lace overlay". texture examples: "satin", "crepe", "brocade".
alt_text: one plain sentence describing the suit for a blind reader, 125 characters or fewer.
problems: list any of blur, cropped, dark, folded that apply to the photos.
If you cannot clearly see a suit, set is_garment to false.`;

export function mergeAnatomy(seen: Observation, owner: SuitAnatomy): Observation {
    const pickOwner = <K extends keyof SuitAnatomy>(k: K) => (owner[k] ?? seen[k]) as Observation[K];
    return {
        ...seen,
        type: pickOwner("type"),
        skirt_length: pickOwner("skirt_length"),
        gown_length: pickOwner("gown_length"),
        sleeve_length: pickOwner("sleeve_length"),
        has_camisole: pickOwner("has_camisole"),
        has_belt: pickOwner("has_belt"),
        has_no_jacket: pickOwner("has_no_jacket"),
    };
}

export function directorPrompt(suit: Observation, caption: string, variant: Variant): string {
    const lengthDesc =
        suit.type === "gown-suit"
            ? `gown: ${suit.gown_length ? SUIT_ANATOMY.gown_length[suit.gown_length] : "unknown"}`
            : `skirt: ${suit.skirt_length ? SUIT_ANATOMY.skirt_length[suit.skirt_length] : "unknown"}`;
    const sleeveDesc = suit.sleeve_length ? SUIT_ANATOMY.sleeve_length[suit.sleeve_length] : "unknown";
    const structure: string[] = [];
    if (suit.has_camisole) structure.push(SUIT_ANATOMY.has_camisole);
    if (suit.has_belt) structure.push(SUIT_ANATOMY.has_belt);
    if (suit.has_no_jacket) structure.push(SUIT_ANATOMY.has_no_jacket);

    return `You are a fashion photography art director.
Write a single, dense, photorealistic image generation prompt.

SUIT ANALYSIS (from vision model):
- Color: ${suit.color}
- Pattern: ${suit.pattern}
- Texture: ${suit.texture}
- Type: ${suit.type}
- Length: ${lengthDesc}
- Sleeve: ${sleeveDesc}
${structure.length > 0 ? `- Structure: ${structure.join("; ")}` : ""}
${suit.notes ? `- Additional details: ${suit.notes}` : ""}

USER INSTRUCTION (overrides the analysis on any conflict):
"${caption || "No caption provided."}"

STYLE VARIANT FOR THIS GENERATION:
- Fashion context: ${variant.fashion}
- Headwear: ${variant.headwear}
- Hair: ${variant.hair}
- Skin tone: ${variant.skinTone}
- Age: ${variant.age}
- Background: ${variant.background}
- Accessories: ${variant.accessories}

RULES:
1. The model is ALWAYS plus-sized (XL-4XL body type). Non-negotiable. Do not soften it.
2. If fashion context is "muslim", describe the headwear coordinating with the suit without altering its cut.
3. If fashion context is "nigerian", describe the gele or headtie coordinating with the suit in color and formality. Do not alter the suit's cut.
4. If age is "50s" or "60s", the model should appear dignified and polished, not exaggerated or frail.
5. Shot style: editorial fashion photography, DSLR, 85mm lens, soft natural shadows, no overprocessing.
6. The suit's color, pattern, and texture must be preserved exactly as described.
7. The user's caption overrides the suit analysis on any conflicting point.

NEGATIVES: No flared or puffed skirts. No cartoonish rendering. No plastic or oversmoothed skin. No warped hands or face. No unrealistic body shaping.

Output only the prompt text, nothing else.`;
}

export const DRAW_PREFIX =
    "The reference photos show the exact suit to draw. Match its colour, cut, buttons, fabric texture and trim exactly. No text in the image.";

export const TRYON_PROMPT =
    "The first image is a photo of a person. The second image is a suit. Show the same person wearing this suit. Keep the face, skin tone, body shape and pose unchanged. Keep the suit exactly as shown. Plain background is fine.";

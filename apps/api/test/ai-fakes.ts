import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { GenRow, GenerationRepo } from "../src/services/generation.ts";
import { GeminiFailure, type GeminiPort } from "../src/services/gemini.ts";

export const GOOD_OBSERVATION = {
    is_garment: true,
    color: "emerald green",
    pattern: "solid",
    texture: "crepe",
    type: "skirt-suit",
    skirt_length: "knee",
    gown_length: null,
    sleeve_length: "full",
    has_camisole: false,
    has_belt: null,
    has_no_jacket: null,
    notes: "two buttons",
    alt_text: "Emerald green skirt suit with a round neck and long sleeves",
    problems: ["blur"],
};

export function memoryGenRepo(overrides: Record<string, unknown> = {}) {
    const settings = new Map<string, unknown>(
        Object.entries({
            gen_per_suit_per_day: 6,
            price_rates: { observe_input_per_mtok_usd_micro: 250_000, observe_output_per_mtok_usd_micro: 1_500_000, image_1k_usd_micro: 34_000 },
            ...overrides,
        }),
    );
    const rows = new Map<string, GenRow & Record<string, unknown>>();
    let claims = 0;

    const repo: GenerationRepo = {
        async setting<T>(key: string) {
            return (settings.has(key) ? settings.get(key) : null) as T | null;
        },
        async monthSpend(kind, since) {
            return [...rows.values()].filter((r) => r.kind === kind && r.created_at >= since).reduce((s, r) => s + r.cost_usd_micro, 0);
        },
        async countForSuitSince(suitId, since) {
            return [...rows.values()].filter((r) => r.suit_id === suitId && r.created_at >= since && r.status !== "blocked_budget").length;
        },
        async countTryonSince(hash, since) {
            return [...rows.values()].filter((r) => r.kind === "tryon" && (r as Record<string, unknown>).requester_hash === hash && r.created_at >= since && r.status !== "blocked_budget").length;
        },
        async hasActiveJob(suitId) {
            return [...rows.values()].some((r) => r.suit_id === suitId && (r.status === "queued" || r.status === "running"));
        },
        async insert(row) {
            const id = randomUUID();
            rows.set(id, { observation: null, error: null, cost_usd_micro: 0, started_at: null, created_at: new Date().toISOString(), ...row, id } as GenRow & Record<string, unknown>);
            return { id };
        },
        async claim(id) {
            const r = rows.get(id);
            if (!r || r.status !== "queued") return null;
            claims += 1;
            r.status = "running";
            r.started_at = new Date().toISOString();
            return { ...r };
        },
        async get(id) {
            const r = rows.get(id);
            return r ? { ...r } : null;
        },
        async update(id, patch) {
            Object.assign(rows.get(id)!, patch);
        },
        async failIfStuck(id, older) {
            const r = rows.get(id);
            if (r && r.status === "running" && r.started_at && r.started_at < older) Object.assign(r, { status: "failed", error: "timeout" });
        },
    };
    return { repo, rows, settings, claims: () => claims };
}

export type DrawStep = "ok" | "safety" | "no_image" | "error";

export async function fakeImage() {
    return sharp({ create: { width: 768, height: 1024, channels: 3, background: "#0f6b4f" } }).png().toBuffer();
}

export function scriptedGemini(opts: { observation?: unknown; draws?: DrawStep[]; observeFails?: GeminiFailure } = {}) {
    const draws = [...(opts.draws ?? ["ok", "ok"])];
    const calls = { observe: 0, write: 0, draw: 0, prompts: [] as string[], briefs: [] as string[] };
    const gemini: GeminiPort = {
        async observe() {
            calls.observe += 1;
            if (opts.observeFails) throw opts.observeFails;
            return { json: opts.observation ?? GOOD_OBSERVATION, inputTokens: 4000, outputTokens: 400 };
        },
        async write(prompt) {
            calls.write += 1;
            calls.briefs.push(prompt);
            return { text: "Editorial photo of a plus-sized woman in the emerald suit.", inputTokens: 300, outputTokens: 200 };
        },
        async draw(prompt) {
            calls.draw += 1;
            calls.prompts.push(prompt);
            const step = draws.shift() ?? "ok";
            if (step === "safety") throw new GeminiFailure("safety", "IMAGE_SAFETY");
            if (step === "no_image") throw new GeminiFailure("no_image", "no_image");
            if (step === "error") throw new GeminiFailure("failed", "http_503");
            return { image: { mime: "image/png", data: await fakeImage() }, inputTokens: 1500, outputTokens: 1300 };
        },
    };
    return { gemini, calls };
}

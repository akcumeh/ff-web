import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { EMPTY_ANATOMY, Observation, type GenerateRequest, type GenerationView, type GenStatus } from "@ff/shared";
import { HttpError } from "../lib/errors.ts";
import type { AdminCatalogueRepo, AuditEntry, StoragePort } from "./admin-catalogue.ts";
import { DRAW_PREFIX, OBSERVE_PROMPT, PROMPT_VERSION, directorPrompt, mergeAnatomy, pickVariant } from "../prompts.ts";
import { DRAW_MODEL, GeminiFailure, OBSERVATION_SCHEMA, OBSERVE_MODEL, type GeminiPort, type ImagePart } from "./gemini.ts";

export type GenRow = {
  id: string;
  kind: "catalogue" | "tryon";
  suit_id: string | null;
  status: GenStatus;
  candidate_count: number;
  observation: unknown;
  error: string | null;
  cost_usd_micro: number;
  started_at: string | null;
  created_at: string;
};

export type PriceRates = { observe_input_per_mtok_usd_micro: number; observe_output_per_mtok_usd_micro: number; image_1k_usd_micro: number };

export interface GenerationRepo {
  setting<T>(key: string): Promise<T | null>;
  monthSpend(kind: "catalogue" | "tryon", sinceIso: string): Promise<number>;
  countForSuitSince(suitId: string, sinceIso: string): Promise<number>;
  hasActiveJob(suitId: string): Promise<boolean>;
  insert(row: Partial<GenRow> & { kind: "catalogue" | "tryon"; suit_id: string | null; status: GenStatus; candidate_count: number; created_by?: string; redo_of?: string | null; requester_hash?: string; started_at?: string }): Promise<{ id: string }>;
  countTryonSince(requesterHash: string, sinceIso: string): Promise<number>;
  claim(id: string): Promise<GenRow | null>;
  get(id: string): Promise<GenRow | null>;
  update(id: string, patch: Record<string, unknown>): Promise<void>;
  failIfStuck(id: string, olderThanIso: string): Promise<void>;
}

export type GenerationDeps = {
  gen: GenerationRepo;
  catalogue: AdminCatalogueRepo;
  storage: StoragePort;
  gemini: GeminiPort;
  audit: (e: AuditEntry) => Promise<void>;
  monthlyCapUsdMicro: number;
  random?: () => number;
  now?: () => Date;
};

export function lagosMonthStart(now: Date): string {
  const lagos = new Date(now.getTime() + 60 * 60 * 1000);
  return new Date(Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), 1) - 60 * 60 * 1000).toISOString();
}

export function lagosDayStart(now: Date): string {
  const lagos = new Date(now.getTime() + 60 * 60 * 1000);
  return new Date(Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), lagos.getUTCDate()) - 60 * 60 * 1000).toISOString();
}

export function createGeneration(deps: GenerationDeps) {
  const now = deps.now ?? (() => new Date());

  async function rates(): Promise<PriceRates> {
    return (
      (await deps.gen.setting<PriceRates>("price_rates")) ?? {
        observe_input_per_mtok_usd_micro: 250_000,
        observe_output_per_mtok_usd_micro: 1_500_000,
        image_1k_usd_micro: 34_000,
      }
    );
  }

  function costOf(r: PriceRates, observeIn: number, observeOut: number, images: number): number {
    return Math.round((observeIn * r.observe_input_per_mtok_usd_micro + observeOut * r.observe_output_per_mtok_usd_micro) / 1_000_000) + images * r.image_1k_usd_micro;
  }

  async function view(row: GenRow): Promise<GenerationView> {
    const candidates = [];
    if (row.suit_id) {
      const suit = await deps.catalogue.getSuit(row.suit_id);
      for (const img of suit?.images ?? []) {
        if (img.kind === "candidate" && img.generation_id === row.id) {
          candidates.push({ image_id: img.id, url: await deps.storage.signedUrl(img.bucket, img.storage_path, 600), width: img.width, height: img.height });
        }
      }
    }
    const obs = Observation.safeParse(row.observation);
    return {
      id: row.id,
      status: row.status,
      error: row.error,
      problems: obs.success ? obs.data.problems : [],
      alt_text: obs.success ? obs.data.alt_text.slice(0, 125) : null,
      candidates,
      cost_usd_micro: row.cost_usd_micro,
    };
  }

  async function start(adminId: string, suitId: string, input: GenerateRequest): Promise<{ id: string; sourceIds: string[] }> {
    const suit = await deps.catalogue.getSuit(suitId);
    if (!suit) throw new HttpError(404, "not_found", "No suit with that id.");

    const originals = suit.images.filter((i) => i.kind === "original");
    const sourceIds = input.source_image_ids ?? originals.slice(0, 4).map((i) => i.id);
    if (sourceIds.length === 0 || !sourceIds.every((id) => originals.some((o) => o.id === id))) {
      throw new HttpError(422, "rule_failed", "Choose at least one of this suit's own photos.", [{ path: "source_image_ids", message: "Pick a photo" }]);
    }

    if (await deps.gen.hasActiveJob(suitId)) throw new HttpError(409, "conflict", "AI photos for this suit are already being made.");

    const perDay = (await deps.gen.setting<number>("gen_per_suit_per_day")) ?? 6;
    if ((await deps.gen.countForSuitSince(suitId, lagosDayStart(now()))) >= perDay) {
      throw new HttpError(429, "rate_limited", `This suit already had ${perDay} AI runs today. Try again tomorrow.`);
    }

    const cap = deps.monthlyCapUsdMicro;
    const spent = await deps.gen.monthSpend("catalogue", lagosMonthStart(now()));
    const r = await rates();
    const estimate = costOf(r, 6000, 1000, input.candidates);
    const base = { kind: "catalogue" as const, suit_id: suitId, candidate_count: input.candidates, created_by: adminId, redo_of: input.redo_of ?? null };

    if (spent + estimate > cap) {
      await deps.gen.insert({ ...base, status: "blocked_budget", error: "budget" });
      throw new HttpError(503, "budget_blocked", "AI photos are not available right now. You can still publish with your own photo.");
    }

    const { id } = await deps.gen.insert({ ...base, status: "queued" });
    await deps.audit({ adminId, action: "generation.start", targetType: "suit", targetId: suitId, detail: { generation: id } });
    return { id, sourceIds };
  }

  async function toModelImage(buf: Buffer): Promise<ImagePart> {
    const data = await sharp(buf).rotate().resize({ width: 1568, height: 1568, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    return { mime: "image/jpeg", data };
  }

  async function run(id: string, sourceIds: string[], extra?: string): Promise<void> {
    const job = await deps.gen.claim(id);
    if (!job || !job.suit_id) return;

    let observeIn = 0;
    let observeOut = 0;
    let images = 0;
    const r = await rates();

    const finish = async (status: GenStatus, error: string | null, extraPatch: Record<string, unknown> = {}) => {
      await deps.gen.update(id, {
        status,
        error,
        input_tokens: observeIn,
        output_tokens: observeOut,
        image_count: images,
        cost_usd_micro: costOf(r, observeIn, observeOut, images),
        finished_at: now().toISOString(),
        ...extraPatch,
      });
    };

    try {
      const suit = await deps.catalogue.getSuit(job.suit_id);
      if (!suit) return finish("failed", "suit_missing");
      const sources = suit.images.filter((i) => sourceIds.includes(i.id));
      const refs = await Promise.all(sources.map(async (s) => toModelImage(await deps.storage.download(s.bucket, s.storage_path))));

      const seen = await deps.gemini.observe(OBSERVE_PROMPT, refs, OBSERVATION_SCHEMA);
      observeIn += seen.inputTokens;
      observeOut += seen.outputTokens;
      const parsed = Observation.safeParse(seen.json);
      if (!parsed.success) return finish("failed", "bad_observation");
      if (!parsed.data.is_garment) return finish("failed", "not_a_garment", { observation: parsed.data });
      const observation = mergeAnatomy(parsed.data, suit.anatomy ?? EMPTY_ANATOMY);

      const caption = extra?.trim() ?? "";
      const variant = pickVariant(caption.length > 0, deps.random);
      const directed = await deps.gemini.write(directorPrompt(observation, caption, variant));
      observeIn += directed.inputTokens;
      observeOut += directed.outputTokens;
      const finalPrompt = `${DRAW_PREFIX}\n\n${directed.text}`;
      await deps.gen.update(id, {
        observation,
        final_prompt: finalPrompt,
        observe_model: OBSERVE_MODEL,
        draw_model: DRAW_MODEL,
        prompt_name: "direct",
        prompt_version: PROMPT_VERSION,
      });

      let safety = false;
      let lastError = "no_image";
      for (let n = 0; n < job.candidate_count; n++) {
        try {
          const drawn = await deps.gemini.draw(finalPrompt, refs);
          const { data, info } = await sharp(drawn.image.data).rotate().webp({ quality: 85 }).toBuffer({ resolveWithObject: true });
          const imageId = randomUUID();
          const path = `${suit.id}/${imageId}.webp`;
          await deps.storage.upload("candidates", path, data, "image/webp", "3600");
          await deps.catalogue.insertImage(suit.id, {
            id: imageId,
            kind: "candidate",
            bucket: "candidates",
            storage_path: path,
            widths: [info.width],
            width: info.width,
            height: info.height,
            blur_data: null,
            alt_text: observation.alt_text.slice(0, 125),
            is_cover: false,
            generation_id: id,
          });
          images += 1;
        } catch (err) {
          if (!(err instanceof GeminiFailure)) throw err;
          if (err.kind === "safety") {
            safety = true;
            lastError = err.code;
            break;
          }
          lastError = err.code;
        }
      }

      if (images > 0) {
        if (suit.status === "draft") await deps.catalogue.updateSuit(suit.id, { status: "review" });
        return finish("succeeded", null);
      }
      return finish(safety ? "failed_safety" : "failed", lastError);
    } catch (err) {
      if (err instanceof GeminiFailure) {
        observeIn += err.usage.inputTokens;
        observeOut += err.usage.outputTokens;
        return finish(err.kind === "safety" ? "failed_safety" : "failed", err.code);
      }
      console.error(JSON.stringify({ level: "error", msg: "generation crashed", generation: id, error: String(err) }));
      return finish("failed", "internal");
    }
  }

  return {
    start,
    run,

    async get(id: string): Promise<GenerationView> {
      await deps.gen.failIfStuck(id, new Date(now().getTime() - 10 * 60_000).toISOString());
      const row = await deps.gen.get(id);
      if (!row) throw new HttpError(404, "not_found", "No AI run with that id.");
      return view(row);
    },

  };
}

export type Generation = ReturnType<typeof createGeneration>;

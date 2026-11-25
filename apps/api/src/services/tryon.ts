import { createHmac } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import { HttpError } from "../lib/errors.ts";
import type { StoragePort } from "./admin-catalogue.ts";
import { GeminiFailure, type GeminiPort } from "./gemini.ts";
import { TRYON_PROMPT } from "../prompts.ts";
import { lagosDayStart, lagosMonthStart, type GenerationRepo, type PriceRates } from "./generation.ts";

export const TryonRequest = z.strictObject({
  suit_slug: z.string().min(1).max(80),
  photo_base64: z.string().min(100).max(4_000_000),
  mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
  agreed: z.literal(true),
  over_18: z.literal(true),
  visitor_cookie: z.string().regex(/^[a-f0-9]{32}$/).optional(),
});
export type TryonRequest = z.infer<typeof TryonRequest>;

export type TryonSuit = { id: string; final_path: string | null; final_widths: number[] };

export type TryonDeps = {
  gen: GenerationRepo;
  storage: StoragePort;
  gemini: GeminiPort;
  suitBySlug: (slug: string) => Promise<TryonSuit | null>;
  visitorSecret: string | undefined;
  ipSecret: string | undefined;
  enabled: boolean;
  monthlyCapUsdMicro: number;
  now?: () => Date;
};

const hmac = (secret: string, value: string) => createHmac("sha256", secret).update(value).digest("hex").slice(0, 32);

export function createTryon(deps: TryonDeps) {
  const now = deps.now ?? (() => new Date());

  return {
    async enabled(): Promise<boolean> {
      return deps.enabled;
    },

    async run(input: TryonRequest, ip: string | undefined): Promise<{ image_base64: string; label: string }> {
      if (!deps.enabled) throw new HttpError(503, "ai_disabled", "The changing room is closed right now.");

      const day = now().toISOString().slice(0, 10);
      const addressHash = deps.ipSecret ? hmac(deps.ipSecret, `${ip ?? "unknown"}|${day}`) : "no-ip-secret";
      const visitorHash = input.visitor_cookie && deps.visitorSecret ? hmac(deps.visitorSecret, input.visitor_cookie) : null;
      const requester = visitorHash ?? addressHash;
      const since = lagosDayStart(now());

      const perVisitor = (await deps.gen.setting<number>("tryon_per_visitor_per_day")) ?? 3;
      const perAddress = (await deps.gen.setting<number>("tryon_per_address_per_day")) ?? 10;
      if (visitorHash && (await deps.gen.countTryonSince(visitorHash, since)) >= perVisitor) {
        throw new HttpError(429, "rate_limited", `You can try on ${perVisitor} suits a day. Come back tomorrow.`);
      }
      if ((await deps.gen.countTryonSince(addressHash, since)) >= perAddress) {
        throw new HttpError(429, "rate_limited", "This connection has used today's try-ons. Come back tomorrow.");
      }

      const rates = (await deps.gen.setting<PriceRates>("price_rates")) ?? { observe_input_per_mtok_usd_micro: 0, observe_output_per_mtok_usd_micro: 0, image_1k_usd_micro: 34_000 };
      const cap = deps.monthlyCapUsdMicro;
      if ((await deps.gen.monthSpend("tryon", lagosMonthStart(now()))) + rates.image_1k_usd_micro > cap) {
        await deps.gen.insert({ kind: "tryon", suit_id: null, status: "blocked_budget", candidate_count: 1, requester_hash: requester });
        throw new HttpError(503, "budget_blocked", "The changing room is busy this month. Ask us about the suit on WhatsApp instead.");
      }

      const suit = await deps.suitBySlug(input.suit_slug);
      if (!suit?.final_path || suit.final_widths.length === 0) throw new HttpError(404, "not_found", "That design is not on the site.");

      let person: Buffer;
      try {
        const raw = Buffer.from(input.photo_base64, "base64");
        if (raw.length > 3 * 1024 * 1024) throw new Error("too big");
        person = await sharp(raw, { limitInputPixels: 40_000_000 }).rotate().resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
      } catch {
        throw new HttpError(422, "rule_failed", "That photo could not be read. Try a JPEG photo from your camera.", [{ path: "photo", message: "unreadable" }]);
      }

      const suitImage = await deps.storage.download("public-suits", `${suit.final_path}-${Math.max(...suit.final_widths)}.webp`);
      const suitJpeg = await sharp(suitImage).jpeg({ quality: 85 }).toBuffer();

      const { id } = await deps.gen.insert({ kind: "tryon", suit_id: suit.id, status: "running", candidate_count: 1, requester_hash: requester, started_at: now().toISOString() });
      try {
        const drawn = await deps.gemini.draw(TRYON_PROMPT, [
          { mime: "image/jpeg", data: person },
          { mime: "image/jpeg", data: suitJpeg },
        ]);
        const out = await sharp(drawn.image.data).rotate().resize({ width: 1024, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
        await deps.gen.update(id, {
          status: "succeeded",
          image_count: 1,
          input_tokens: drawn.inputTokens,
          output_tokens: drawn.outputTokens,
          cost_usd_micro: rates.image_1k_usd_micro,
          finished_at: now().toISOString(),
        });
        return { image_base64: out.toString("base64"), label: "AI-styled preview" };
      } catch (err) {
        const safety = err instanceof GeminiFailure && err.kind === "safety";
        await deps.gen.update(id, {
          status: safety ? "failed_safety" : "failed",
          error: err instanceof GeminiFailure ? err.code : "internal",
          finished_at: now().toISOString(),
        });
        if (safety) throw new HttpError(422, "rule_failed", "We could not make a picture from that photo. Try a different photo, standing, front on.");
        throw new HttpError(502, "upstream_failed", "The picture did not come through. Try again in a moment.");
      }
    },
  };
}

export type Tryon = ReturnType<typeof createTryon>;

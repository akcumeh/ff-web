export const OBSERVE_MODEL = "gemini-3.1-flash-lite";
export const DRAW_MODEL = "gemini-nano-banana-2.1";

export type ImagePart = { mime: string; data: Buffer };
export type Usage = { inputTokens: number; outputTokens: number };

export class GeminiFailure extends Error {
  kind: "safety" | "no_image" | "failed";
  code: string;
  usage: Usage;
  constructor(kind: "safety" | "no_image" | "failed", code: string, usage: Usage = { inputTokens: 0, outputTokens: 0 }) {
    super(`gemini ${kind}: ${code}`);
    this.kind = kind;
    this.code = code;
    this.usage = usage;
  }
}

export interface GeminiPort {
  observe(prompt: string, images: ImagePart[], schema: object): Promise<{ json: unknown } & Usage>;
  draw(prompt: string, refs: ImagePart[]): Promise<{ image: ImagePart } & Usage>;
}

type GeminiResponse = {
  candidates?: { finishReason?: string; content?: { parts?: { text?: string; inlineData?: { mimeType: string; data: string } }[] } }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
};

const SAFETY_REASONS = new Set(["SAFETY", "IMAGE_SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION", "IMAGE_PROHIBITED_CONTENT"]);

export type GeminiOptions = {
  apiKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  retryDelaysMs?: number[];
  sleep?: (ms: number) => Promise<void>;
};

export function createGemini(opts: GeminiOptions): GeminiPort {
  const doFetch = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const delays = opts.retryDelaysMs ?? [2000, 6000];
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));

  async function call(model: string, body: object): Promise<{ res: GeminiResponse } & Usage> {
    let lastCode = "unknown";
    for (let attempt = 0; attempt <= delays.length; attempt++) {
      if (attempt > 0) await sleep(delays[attempt - 1]!);
      let response: Response;
      try {
        response = await doFetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": opts.apiKey },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        lastCode = "timeout";
        continue;
      }
      if (response.status === 429 || response.status >= 500) {
        lastCode = `http_${response.status}`;
        continue;
      }
      const json = (await response.json().catch(() => ({}))) as GeminiResponse & { error?: { status?: string } };
      if (!response.ok) throw new GeminiFailure("failed", json.error?.status ?? `http_${response.status}`);
      const usage = {
        inputTokens: json.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: (json.usageMetadata?.candidatesTokenCount ?? 0) + (json.usageMetadata?.thoughtsTokenCount ?? 0),
      };
      if (json.promptFeedback?.blockReason) throw new GeminiFailure("safety", json.promptFeedback.blockReason, usage);
      const reason = json.candidates?.[0]?.finishReason;
      if (reason && SAFETY_REASONS.has(reason)) throw new GeminiFailure("safety", reason, usage);
      return { res: json, ...usage };
    }
    throw new GeminiFailure("failed", lastCode);
  }

  const inline = (img: ImagePart) => ({ inlineData: { mimeType: img.mime, data: img.data.toString("base64") } });

  return {
    async observe(prompt, images, schema) {
      const { res, inputTokens, outputTokens } = await call(OBSERVE_MODEL, {
        contents: [{ role: "user", parts: [{ text: prompt }, ...images.map(inline)] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.2 },
      });
      const text = res.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text;
      if (!text) throw new GeminiFailure("failed", "empty_observation", { inputTokens, outputTokens });
      try {
        return { json: JSON.parse(text), inputTokens, outputTokens };
      } catch {
        throw new GeminiFailure("failed", "bad_observation_json", { inputTokens, outputTokens });
      }
    },

    async draw(prompt, refs) {
      const { res, inputTokens, outputTokens } = await call(DRAW_MODEL, {
        contents: [{ role: "user", parts: [{ text: prompt }, ...refs.map(inline)] }],
        generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "3:4", imageSize: "1K" } },
      });
      const parts = res.candidates?.[0]?.content?.parts ?? [];
      const img = parts.find((p) => p.inlineData?.data);
      if (!img?.inlineData) {
        const refused = parts.some((p) => p.text);
        throw new GeminiFailure(refused ? "safety" : "no_image", refused ? "text_refusal" : "no_image", { inputTokens, outputTokens });
      }
      return { image: { mime: img.inlineData.mimeType, data: Buffer.from(img.inlineData.data, "base64") }, inputTokens, outputTokens };
    },
  };
}

export const OBSERVATION_SCHEMA = {
  type: "OBJECT",
  properties: {
    is_garment: { type: "BOOLEAN" },
    garment: { type: "STRING" },
    colour_seen: { type: "STRING" },
    fabric_look: { type: "STRING" },
    neckline: { type: "STRING" },
    sleeves: { type: "STRING" },
    length: { type: "STRING" },
    trim: { type: "STRING" },
    pattern: { type: "STRING" },
    notes_for_drawer: { type: "STRING" },
    alt_text: { type: "STRING", description: "125 characters or fewer" },
    problems: { type: "ARRAY", items: { type: "STRING", enum: ["blur", "cropped", "dark", "folded"] } },
  },
  required: ["is_garment", "garment", "colour_seen", "fabric_look", "neckline", "sleeves", "length", "trim", "pattern", "notes_for_drawer", "alt_text", "problems"],
};

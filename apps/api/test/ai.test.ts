import { describe, expect, it } from "vitest";
import request from "supertest";
import sharp from "sharp";
import { AdminSuitDetail, ApiError, GenerationView } from "@ff/shared";
import { createAdminCatalogue } from "../src/services/admin-catalogue.ts";
import { createGeneration } from "../src/services/generation.ts";
import { GeminiFailure, createGemini } from "../src/services/gemini.ts";
import { memoryRepo, memoryStorage, recorder } from "./admin-fakes.ts";
import { GOOD_OBSERVATION, memoryGenRepo, scriptedGemini, type DrawStep } from "./ai-fakes.ts";
import { ADMIN_ID, testApp } from "./helpers.ts";

const tokens = { owner: { sub: ADMIN_ID, email: "owner@example.com", aal: "aal1" } };
const AUTH = { Authorization: "Bearer owner" };

function setup(opts: { draws?: DrawStep[]; settings?: Record<string, unknown>; observation?: unknown; observeFails?: GeminiFailure; cap?: number } = {}) {
    const db = memoryRepo();
    const store = memoryStorage();
    const rec = recorder();
    const gen = memoryGenRepo(opts.settings);
    const ai = scriptedGemini({ draws: opts.draws, observation: opts.observation, observeFails: opts.observeFails });
    const pending: Promise<unknown>[] = [];
    const generation = createGeneration({ gen: gen.repo, catalogue: db.repo, storage: store.storage, gemini: ai.gemini, audit: rec.audit, monthlyCapUsdMicro: opts.cap ?? 9_000_000, random: () => 0 });
    const app = testApp({
        tokens,
        adminCatalogue: createAdminCatalogue({ repo: db.repo, storage: store.storage, audit: rec.audit, revalidate: rec.revalidate }),
        generation,
        background: (p) => pending.push(p),
    });
    return { db, store, rec, gen, ai, app, generation, settle: () => Promise.all(pending) };
}

async function makeSuit(env: ReturnType<typeof setup>) {
    const sign = await request(env.app).post("/admin/uploads/sign").set(AUTH).send({ files: [{ name: "a.jpg", content_type: "image/jpeg", size: 100 }] });
    const path = sign.body.uploads[0].path as string;
    env.store.files.set(`originals/${path}`, await sharp({ create: { width: 900, height: 1200, channels: 3, background: "#0f6b4f" } }).jpeg().toBuffer());
    const res = await request(env.app)
        .post("/admin/suits")
        .set(AUTH)
        .send({ batch: { label: "Test", arrived_on: "2026-11-20" }, style: "london", title: "London style", price_kobo: 4_500_000, variants: [{ sizes: ["42"] }], images: [{ path }] });
    return AdminSuitDetail.parse(res.body);
}

async function generate(env: ReturnType<typeof setup>, suitId: string, body: object = {}) {
    const res = await request(env.app).post(`/admin/suits/${suitId}/generate`).set(AUTH).send(body);
    await env.settle();
    return res;
}

async function status(env: ReturnType<typeof setup>, id: string) {
    return GenerationView.parse((await request(env.app).get(`/admin/generations/${id}`).set(AUTH)).body);
}

describe("AI photo pipeline", () => {
    it("makes two candidates, moves the suit to review, and records the cost", async () => {
        const env = setup();
        const suit = await makeSuit(env);
        const res = await generate(env, suit.id);
        expect(res.status).toBe(202);
        const view = await status(env, res.body.generation_id);
        expect(view.status).toBe("succeeded");
        expect(view.candidates).toHaveLength(2);
        expect(view.problems).toEqual(["blur"]);
        expect(view.alt_text).toContain("Emerald");
        expect(view.cost_usd_micro).toBe(Math.round((4300 * 250_000 + 600 * 1_500_000) / 1e6) + 2 * 34_000);
        expect(env.ai.calls.write).toBe(1);
        expect(env.ai.calls.briefs[0]).toContain("plus-sized");
        expect(env.ai.calls.briefs[0]).toContain("Color: emerald green");
        expect(env.ai.calls.briefs[0]).toContain("hem falls just at the knee");
        expect(env.ai.calls.briefs[0]).toContain("Fashion context: corporate");
        expect(env.ai.calls.prompts[0]).toContain("Match its colour");
        expect(env.ai.calls.prompts[0]).toContain("plus-sized woman in the emerald suit");
        const after = AdminSuitDetail.parse((await request(env.app).get(`/admin/suits/${suit.id}`).set(AUTH)).body);
        expect(after.status).toBe("review");
    });

    it("succeeds with one candidate when the second draw fails", async () => {
        const env = setup({ draws: ["ok", "error"] });
        const suit = await makeSuit(env);
        const view = await status(env, (await generate(env, suit.id)).body.generation_id);
        expect(view.status).toBe("succeeded");
        expect(view.candidates).toHaveLength(1);
    });

    it("marks a safety block as failed_safety and does not retry", async () => {
        const env = setup({ draws: ["safety", "ok"] });
        const suit = await makeSuit(env);
        const view = await status(env, (await generate(env, suit.id)).body.generation_id);
        expect(view.status).toBe("failed_safety");
        expect(env.ai.calls.draw).toBe(1);
    });

    it("fails with no_image when the model returns no picture", async () => {
        const env = setup({ draws: ["no_image", "no_image"] });
        const suit = await makeSuit(env);
        const view = await status(env, (await generate(env, suit.id)).body.generation_id);
        expect(view).toMatchObject({ status: "failed", error: "no_image", candidates: [] });
    });

    it("stops at not_a_garment when the photo is not a suit", async () => {
        const env = setup({ observation: { ...GOOD_OBSERVATION, is_garment: false } });
        const suit = await makeSuit(env);
        const view = await status(env, (await generate(env, suit.id)).body.generation_id);
        expect(view).toMatchObject({ status: "failed", error: "not_a_garment" });
        expect(env.ai.calls.draw).toBe(0);
    });

    it("503 budget_blocked and a blocked_budget row when the month cap would be passed", async () => {
        const env = setup({ cap: 50_000 });
        const suit = await makeSuit(env);
        const res = await generate(env, suit.id);
        expect(res.status).toBe(503);
        expect(ApiError.parse(res.body).error.code).toBe("budget_blocked");
        expect([...env.gen.rows.values()].map((r) => r.status)).toEqual(["blocked_budget"]);
        expect(env.ai.calls.observe).toBe(0);
    });

    it("uses the caption weights and passes the caption to the art director", async () => {
        const env = setup();
        const suit = await makeSuit(env);
        await generate(env, suit.id, { extra_instructions: "show the back of the jacket" });
        expect(env.ai.calls.briefs[0]).toContain('"show the back of the jacket"');
    });

    it("lets the owner's suit details win over what the AI read from the photo", async () => {
        const env = setup();
        const suit = await makeSuit(env);
        const patched = await request(env.app)
            .patch(`/admin/suits/${suit.id}`)
            .set(AUTH)
            .send({ anatomy: { type: "skirt-suit", skirt_length: "full", sleeve_length: "3/4", has_camisole: true } });
        expect(AdminSuitDetail.parse(patched.body).anatomy).toMatchObject({ skirt_length: "full", sleeve_length: "3/4", has_camisole: true, gown_length: null });
        await generate(env, suit.id);
        const brief = env.ai.calls.briefs[0]!;
        expect(brief).toContain("hem falls at or just above the ankle");
        expect(brief).toContain("closer to the wrist");
        expect(brief).toContain("3 piece suit");
    });

    it("rejects a suit detail value that is not on the list", async () => {
        const env = setup();
        const suit = await makeSuit(env);
        const res = await request(env.app).patch(`/admin/suits/${suit.id}`).set(AUTH).send({ anatomy: { skirt_length: "mini" } });
        expect(res.status).toBe(400);
    });

    it("runs a job once even if it is started twice (idempotent claim)", async () => {
        const env = setup();
        const suit = await makeSuit(env);
        const { id, sourceIds } = await env.generation.start(ADMIN_ID, suit.id, { candidates: 1 });
        await Promise.all([env.generation.run(id, sourceIds), env.generation.run(id, sourceIds)]);
        expect(env.gen.claims()).toBe(1);
        expect(env.ai.calls.observe).toBe(1);
    });

    it("409 when a job for the suit is already running", async () => {
        const env = setup();
        const suit = await makeSuit(env);
        await env.generation.start(ADMIN_ID, suit.id, { candidates: 1 });
        const res = await request(env.app).post(`/admin/suits/${suit.id}/generate`).set(AUTH).send({});
        expect(res.status).toBe(409);
    });

    it("publishes a chosen candidate with the real photo beside it and deletes the drafts", async () => {
        const env = setup();
        const suit = await makeSuit(env);
        const view = await status(env, (await generate(env, suit.id)).body.generation_id);
        const sel = await request(env.app)
            .post(`/admin/suits/${suit.id}/select-image`)
            .set(AUTH)
            .send({ candidate_image_id: view.candidates[0]!.image_id, alt_text: "Model in an emerald London style suit" });
        expect(sel.status).toBe(200);
        const pub = AdminSuitDetail.parse((await request(env.app).post(`/admin/suits/${suit.id}/publish`).set(AUTH).send({})).body);
        expect(pub.images.map((i) => i.kind).sort()).toEqual(["detail", "final", "original"]);
        expect([...env.store.files.keys()].some((k) => k.startsWith("candidates/"))).toBe(false);
        const finalRow = [...env.db.images.values()].find((i) => i.kind === "final")!;
        expect(finalRow.generation_id).toBe(view.id);
    });
});

describe("Gemini client retries", () => {
    const ok = { candidates: [{ finishReason: "STOP", content: { parts: [{ text: "{\"ok\":true}" }] } }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 } };

    it("retries twice on 503 and 429, then succeeds", async () => {
        const replies = [new Response("", { status: 503 }), new Response("", { status: 429 }), Response.json(ok)];
        const slept: number[] = [];
        const g = createGemini({ apiKey: "k".repeat(30), fetchImpl: async () => replies.shift()!, sleep: async (ms) => void slept.push(ms) });
        const out = await g.observe("p", [], {});
        expect(out.json).toEqual({ ok: true });
        expect(slept).toEqual([2000, 6000]);
    });

    it("gives up after two retries", async () => {
        const g = createGemini({ apiKey: "k".repeat(30), fetchImpl: async () => new Response("", { status: 503 }), sleep: async () => {} });
        await expect(g.observe("p", [], {})).rejects.toMatchObject({ kind: "failed", code: "http_503" });
    });

    it("does not retry other 4xx errors", async () => {
        let calls = 0;
        const g = createGemini({ apiKey: "k".repeat(30), fetchImpl: async () => (calls++, Response.json({ error: { status: "INVALID_ARGUMENT" } }, { status: 400 })), sleep: async () => {} });
        await expect(g.observe("p", [], {})).rejects.toMatchObject({ kind: "failed", code: "INVALID_ARGUMENT" });
        expect(calls).toBe(1);
    });

    it("treats a timeout as retryable", async () => {
        let calls = 0;
        const g = createGemini({
            apiKey: "k".repeat(30),
            fetchImpl: async () => {
                calls += 1;
                if (calls < 3) throw new DOMException("timed out", "TimeoutError");
                return Response.json(ok);
            },
            sleep: async () => {},
        });
        await expect(g.observe("p", [], {})).resolves.toBeTruthy();
        expect(calls).toBe(3);
    });

    it("reports a safety finish and a text refusal as safety", async () => {
        const blocked = { candidates: [{ finishReason: "IMAGE_SAFETY", content: { parts: [] } }] };
        const g1 = createGemini({ apiKey: "k".repeat(30), fetchImpl: async () => Response.json(blocked), sleep: async () => {} });
        await expect(g1.draw("p", [])).rejects.toMatchObject({ kind: "safety" });
        const refusal = { candidates: [{ finishReason: "STOP", content: { parts: [{ text: "I can't draw that." }] } }] };
        const g2 = createGemini({ apiKey: "k".repeat(30), fetchImpl: async () => Response.json(refusal), sleep: async () => {} });
        await expect(g2.draw("p", [])).rejects.toMatchObject({ kind: "safety", code: "text_refusal" });
    });
});

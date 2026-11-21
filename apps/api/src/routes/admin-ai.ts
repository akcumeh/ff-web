import { Router } from "express";
import { z } from "zod";
import { waitUntil } from "@vercel/functions";
import { AiSettingsUpdate, GenerateRequest, PromptName, PromptUpdate } from "@ff/shared";
import { currentAdmin } from "../lib/auth.ts";
import { HttpError } from "../lib/errors.ts";
import type { Generation } from "../services/generation.ts";

function parse<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value ?? {});
  if (result.success) return result.data;
  throw new HttpError(
    400,
    "validation_failed",
    "Some fields need fixing.",
    result.error.issues.map((i) => ({ path: i.path.join(".") || "body", message: i.message })),
  );
}

const IdParam = z.object({ id: z.uuid() });

export function adminAiRouter(generation: Generation, background: (p: Promise<unknown>) => void = waitUntil): Router {
  const r = Router();

  r.post("/suits/:id/generate", async (req, res) => {
    const { id } = parse(IdParam, req.params);
    const input = parse(GenerateRequest, req.body);
    const job = await generation.start(currentAdmin(res).adminId, id, input);
    res.status(202).json({ generation_id: job.id });
    background(generation.run(job.id, job.sourceIds, input.extra_instructions));
  });

  r.get("/generations/:id", async (req, res) => {
    const { id } = parse(IdParam, req.params);
    res.json(await generation.get(id));
  });

  r.get("/prompts", async (_req, res) => {
    res.json({ items: await generation.prompts() });
  });

  r.patch("/prompts/:name", async (req, res) => {
    const name = parse(z.object({ name: PromptName }), req.params).name;
    const { body } = parse(PromptUpdate, req.body);
    res.json({ items: await generation.updatePrompt(currentAdmin(res).adminId, name, body) });
  });

  r.get("/settings", async (_req, res) => {
    res.json(await generation.settings());
  });

  r.patch("/settings", async (req, res) => {
    res.json(await generation.updateSettings(currentAdmin(res).adminId, parse(AiSettingsUpdate, req.body)));
  });

  return r;
}

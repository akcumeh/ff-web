import { Router } from "express";
import { z } from "zod";
import { BatchCreate, PublishInput, SelectImage, SuitCreate, SuitPatch, SuitStatus, UploadSignRequest } from "@ff/shared";
import { currentAdmin } from "../lib/auth.ts";
import { HttpError } from "../lib/errors.ts";
import type { AdminCatalogue } from "../services/admin-catalogue.ts";

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
const ListQuery = z.strictObject({ status: SuitStatus.optional() });

export function adminCatalogueRouter(catalogue: AdminCatalogue): Router {
  const r = Router();

  r.post("/uploads/sign", async (req, res) => {
    const input = parse(UploadSignRequest, req.body);
    res.json(await catalogue.signUploads(currentAdmin(res).adminId, input));
  });

  r.get("/batches", async (_req, res) => {
    res.json({ items: await catalogue.listBatches() });
  });

  r.post("/batches", async (req, res) => {
    res.status(201).json(await catalogue.createBatch(currentAdmin(res).adminId, parse(BatchCreate, req.body)));
  });

  r.get("/suits", async (req, res) => {
    res.json(await catalogue.listSuits(parse(ListQuery, req.query)));
  });

  r.post("/suits", async (req, res) => {
    res.status(201).json(await catalogue.createSuit(currentAdmin(res).adminId, parse(SuitCreate, req.body)));
  });

  r.get("/suits/:id", async (req, res) => {
    const { id } = parse(IdParam, req.params);
    res.json(await catalogue.getSuit(id));
  });

  r.patch("/suits/:id", async (req, res) => {
    const { id } = parse(IdParam, req.params);
    res.json(await catalogue.updateSuit(currentAdmin(res).adminId, id, parse(SuitPatch, req.body)));
  });

  r.post("/suits/:id/select-image", async (req, res) => {
    const { id } = parse(IdParam, req.params);
    res.json(await catalogue.selectImage(currentAdmin(res).adminId, id, parse(SelectImage, req.body)));
  });

  r.post("/suits/:id/publish", async (req, res) => {
    const { id } = parse(IdParam, req.params);
    parse(PublishInput, req.body);
    res.json(await catalogue.publish(currentAdmin(res).adminId, id));
  });

  r.post("/suits/:id/archive", async (req, res) => {
    const { id } = parse(IdParam, req.params);
    res.json(await catalogue.archive(currentAdmin(res).adminId, id));
  });

  return r;
}

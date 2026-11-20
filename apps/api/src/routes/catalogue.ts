import { Router } from "express";
import { SLUG_RE, SuitListQuery } from "@ff/shared";
import { HttpError } from "../lib/errors.ts";
import type { Catalogue } from "../services/catalogue.ts";

const CACHE = "public, s-maxage=60, stale-while-revalidate=600";

export function catalogueRouter(catalogue: Catalogue): Router {
  const r = Router();

  r.get("/", async (req, res) => {
    const parsed = SuitListQuery.safeParse(req.query);
    if (!parsed.success) {
      throw new HttpError(
        400,
        "validation_failed",
        "Some filters are not valid.",
        parsed.error.issues.map((i) => ({ path: i.path.join(".") || "query", message: i.message })),
      );
    }
    res.set("cache-control", CACHE).json(await catalogue.list(parsed.data));
  });

  r.get("/sitemap", async (_req, res) => {
    res.set("cache-control", CACHE).json(await catalogue.sitemap());
  });

  r.get("/:slug", async (req, res) => {
    const slug = req.params.slug;
    if (!SLUG_RE.test(slug)) throw new HttpError(404, "not_found", "That design is not on the site.");
    res.set("cache-control", CACHE).json(await catalogue.bySlug(slug));
  });

  return r;
}

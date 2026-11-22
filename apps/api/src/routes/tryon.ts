import express, { Router } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { HttpError } from "../lib/errors.ts";
import { TryonRequest, type Tryon, type TryonSuit } from "../services/tryon.ts";

type Limit = (route: string, ip: string | undefined, max: number, windowSeconds?: number) => Promise<void>;

export function tryonRouter(tryon: Tryon, limit: Limit): Router {
  const r = Router();

  r.get("/config", async (_req, res) => {
    res.set("cache-control", "public, s-maxage=60").json({ tryon_enabled: await tryon.enabled() });
  });

  r.post("/tryon", express.json({ limit: "4mb" }), async (req, res) => {
    await limit("tryon", req.ip, 3, 60);
    const parsed = TryonRequest.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new HttpError(400, "validation_failed", "Tick both boxes and add a photo.", parsed.error.issues.slice(0, 5).map((i) => ({ path: i.path.join("."), message: i.message })));
    }
    res.set("cache-control", "no-store").json(await tryon.run(parsed.data, req.ip));
  });

  return r;
}

export function supabaseTryonSuit(db: SupabaseClient) {
  return async (slug: string): Promise<TryonSuit | null> => {
    const { data, error } = await db
      .from("suits")
      .select("id, suit_images(kind, is_cover, storage_path, widths)")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw new Error(`tryon suit failed: ${error.message}`);
    if (!data) return null;
    const imgs = (data as unknown as { suit_images: { kind: string; is_cover: boolean; storage_path: string; widths: number[] }[] }).suit_images;
    const final = imgs.find((i) => i.kind === "final" && i.is_cover) ?? imgs.find((i) => i.kind === "final");
    return { id: data.id, final_path: final?.storage_path ?? null, final_widths: final?.widths ?? [] };
  };
}

import { Router } from "express";
import { z } from "zod";
import { currentAdmin } from "../lib/auth.ts";
import { HttpError } from "../lib/errors.ts";
import type { AdminCatalogueRepo } from "../services/admin-catalogue.ts";
import type { Channels } from "../services/channels.ts";

function parse<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
    const result = schema.safeParse(value ?? {});
    if (result.success) return result.data;
    throw new HttpError(400, "validation_failed", "Some fields need fixing.", result.error.issues.map((i) => ({ path: i.path.join(".") || "body", message: i.message })));
}

export function adminChannelsRouter(channels: Channels, suits: Pick<AdminCatalogueRepo, "getSuit">): Router {
    const r = Router();

    r.get("/posts", async (req, res) => {
        const { suit_id } = parse(z.strictObject({ suit_id: z.uuid() }), req.query);
        res.json({ items: await channels.postsForSuit(suit_id) });
    });

    r.post("/posts/:id/retry", async (req, res) => {
        const { id } = parse(z.object({ id: z.uuid() }), req.params);
        res.json(await channels.retry(currentAdmin(res).adminId, id, (sid) => suits.getSuit(sid)));
    });

    r.post("/posts/:id/mark-posted", async (req, res) => {
        const { id } = parse(z.object({ id: z.uuid() }), req.params);
        res.json(await channels.markPosted(currentAdmin(res).adminId, id));
    });

    r.get("/packs/pending", async (_req, res) => {
        res.json({ items: await channels.pending() });
    });

    return r;
}

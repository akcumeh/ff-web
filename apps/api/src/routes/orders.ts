import express, { Router } from "express";
import { z } from "zod";
import { AdminOrderPatch, ORDER_REF_RE, OrderCreate } from "@ff/shared";
import { currentAdmin } from "../lib/auth.ts";
import { HttpError } from "../lib/errors.ts";
import type { Orders } from "../services/orders.ts";
import { validPaystackSignature } from "../services/paystack.ts";

type Limit = (route: string, ip: string | undefined, max: number, windowSeconds?: number) => Promise<void>;

function parse<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
    const result = schema.safeParse(value ?? {});
    if (result.success) return result.data;
    throw new HttpError(400, "validation_failed", "Some fields need fixing.", result.error.issues.map((i) => ({ path: i.path.join(".") || "body", message: i.message })));
}

const RefParam = z.object({ ref: z.string().regex(ORDER_REF_RE) });

export function webhookRouter(orders: Orders, secretKey: string | undefined): Router {
    const r = Router();
    r.post("/webhooks/paystack", express.raw({ type: "*/*", limit: "64kb" }), async (req, res) => {
        const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
        if (!secretKey || !validPaystackSignature(secretKey, raw, req.get("x-paystack-signature"))) {
            res.status(401).end();
            return;
        }
        let event: unknown;
        try {
            event = JSON.parse(raw.toString("utf8"));
        } catch {
            res.status(400).end();
            return;
        }
        await orders.webhook(event as Parameters<Orders["webhook"]>[0], event);
        res.status(200).end();
    });
    return r;
}

export function publicOrdersRouter(orders: Orders, limit: Limit): Router {
    const r = Router();

    r.post("/orders", express.json({ limit: "8kb" }), async (req, res) => {
        await limit("orders", req.ip, 10, 600);
        res.status(201).json(await orders.create(parse(OrderCreate, req.body)));
    });

    r.get("/orders/:ref", async (req, res) => {
        const ref = RefParam.safeParse(req.params);
        if (!ref.success) throw new HttpError(404, "not_found", "No order with that reference.");
        await limit("order-read", req.ip, 30, 600);
        res.set("cache-control", "no-store").json(await orders.get(ref.data.ref));
    });

    r.post("/orders/:ref/verify", async (req, res) => {
        const ref = RefParam.safeParse(req.params);
        if (!ref.success) throw new HttpError(404, "not_found", "No order with that reference.");
        await limit("order-read", req.ip, 30, 600);
        res.set("cache-control", "no-store").json(await orders.verify(ref.data.ref));
    });

    return r;
}

export function adminOrdersRouter(orders: Orders): Router {
    const r = Router();
    r.get("/orders", async (req, res) => {
        const { status } = parse(z.strictObject({ status: z.enum(["pending", "paid", "failed", "delivered", "cancelled"]).default("paid") }), req.query);
        res.json({ items: await orders.adminList(status) });
    });
    r.patch("/orders/:id", async (req, res) => {
        const { id } = parse(z.object({ id: z.uuid() }), req.params);
        const { status } = parse(AdminOrderPatch, req.body);
        await orders.adminUpdate(currentAdmin(res).adminId, id, status);
        res.status(204).end();
    });
    return r;
}

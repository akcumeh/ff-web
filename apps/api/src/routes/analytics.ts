import { timingSafeEqual } from "node:crypto";
import express, { Router, type RequestHandler } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { EnquiryPatch, ForgetRequest, SnapshotInput, StatsRange, TrackEvent } from "@ff/shared";
import { currentAdmin } from "../lib/auth.ts";
import { HttpError } from "../lib/errors.ts";
import type { Analytics } from "../services/analytics.ts";
import type { Nightly } from "../services/nightly.ts";

function parse<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
    const result = schema.safeParse(value ?? {});
    if (result.success) return result.data;
    throw new HttpError(400, "validation_failed", "Some fields need fixing.", result.error.issues.map((i) => ({ path: i.path.join(".") || "body", message: i.message })));
}

const textJson = express.json({ limit: "8kb", type: ["application/json", "text/plain"] });

export function publicAnalyticsRouter(analytics: Analytics): Router {
    const r = Router();

    r.post("/events", textJson, async (req, res) => {
        const input = TrackEvent.safeParse(req.body);
        if (input.success) await analytics.track(input.data, { ip: req.ip, userAgent: req.get("user-agent") });
        res.status(204).end();
    });

    r.post("/visitors/forget", textJson, async (req, res) => {
        const { cookie } = parse(ForgetRequest, req.body);
        await analytics.forget(cookie, req.ip);
        res.status(204).end();
    });

    return r;
}

export interface AdminAnalyticsPort {
    listEnquiries(): Promise<{ id: string; code: string; suit_ref: string; created_at: string; chat_started_at: string | null }[]>;
    setChatStarted(id: string, started: boolean, adminId: string): Promise<boolean>;
    saveSnapshot(platform: "whatsapp", takenOn: string, followers: number): Promise<void>;
}

export function adminAnalyticsRouter(analytics: Analytics, port: AdminAnalyticsPort, audit: (e: { adminId: string; action: string; targetType: string; targetId: string }) => Promise<void>): Router {
    const r = Router();

    r.get("/stats", async (req, res) => {
        const { range } = parse(z.strictObject({ range: StatsRange.default("30d") }), req.query);
        res.json(await analytics.stats(range));
    });

    r.get("/enquiries", async (_req, res) => {
        res.json({ items: await port.listEnquiries() });
    });

    r.patch("/enquiries/:id", async (req, res) => {
        const { id } = parse(z.object({ id: z.uuid() }), req.params);
        const { chat_started } = parse(EnquiryPatch, req.body);
        if (!(await port.setChatStarted(id, chat_started, currentAdmin(res).adminId))) throw new HttpError(404, "not_found", "No enquiry with that id.");
        res.status(204).end();
    });

    r.post("/snapshots", async (req, res) => {
        const input = parse(SnapshotInput, req.body);
        await port.saveSnapshot(input.platform, input.taken_on, input.followers);
        await audit({ adminId: currentAdmin(res).adminId, action: "snapshot.save", targetType: "channel", targetId: input.platform });
        res.status(204).end();
    });

    return r;
}

export function supabaseAdminAnalytics(db: SupabaseClient): AdminAnalyticsPort {
    return {
        async listEnquiries() {
            const { data, error } = await db
                .from("enquiries")
                .select("id, code, created_at, chat_started_at, suits(ref)")
                .order("created_at", { ascending: false })
                .limit(200);
            if (error) throw new Error(`enquiry list failed: ${error.message}`);
            return ((data ?? []) as unknown as { id: string; code: string; created_at: string; chat_started_at: string | null; suits: { ref: string } | null }[]).map(
                ({ suits, ...e }) => ({ ...e, suit_ref: suits?.ref ?? "?" }),
            );
        },
        async setChatStarted(id, started, adminId) {
            const { data, error } = await db
                .from("enquiries")
                .update(started ? { chat_started_at: new Date().toISOString(), chat_started_by: adminId } : { chat_started_at: null, chat_started_by: null })
                .eq("id", id)
                .select("id");
            if (error) throw new Error(`enquiry update failed: ${error.message}`);
            return (data ?? []).length > 0;
        },
        async saveSnapshot(platform, takenOn, followers) {
            const { error } = await db.from("channel_snapshots").upsert({ platform, taken_on: takenOn, followers, source: "manual" }, { onConflict: "platform,taken_on" });
            if (error) throw new Error(`snapshot failed: ${error.message}`);
        },
    };
}

export function cronRouter(nightly: Nightly, secret: string | undefined): Router {
    const r = Router();
    const auth: RequestHandler = (req, _res, next) => {
        const given = Buffer.from(req.get("authorization") ?? "");
        const expected = Buffer.from(`Bearer ${secret ?? ""}`);
        if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) {
            return next(new HttpError(401, "unauthenticated", "Bad cron secret."));
        }
        next();
    };
    const run: RequestHandler = async (_req, res) => {
        res.set("cache-control", "no-store").json({ steps: await nightly.run() });
    };
    r.get("/cron/nightly", auth, run);
    r.post("/cron/nightly", auth, run);
    return r;
}

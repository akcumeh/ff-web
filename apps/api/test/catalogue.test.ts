import { describe, expect, it } from "vitest";
import request from "supertest";
import { ApiError, SuitDetail, SuitList } from "@ff/shared";
import { IMG_BASE, testApp } from "./helpers.ts";

describe("GET /suits", () => {
    it("lists published suits newest first, in the shared shape, with cache headers", async () => {
        const res = await request(testApp()).get("/suits");
        expect(res.status).toBe(200);
        const body = SuitList.parse(res.body);
        expect(body.items.map((s) => s.ref)).toEqual(["LN-05", "TR-04", "LN-03", "TR-02", "LN-01"]);
        expect(body.next_cursor).toBeNull();
        expect(res.headers["cache-control"]).toContain("s-maxage=60");
    });

    it("marks the newest batch as latest, older ones as past, and an all-out-of-stock suit as sold out", async () => {
        const body = SuitList.parse((await request(testApp()).get("/suits")).body);
        const byRef = Object.fromEntries(body.items.map((s) => [s.ref, s]));
        expect(byRef["LN-05"]).toMatchObject({ is_latest: true, is_past: false, sold_out: false });
        expect(byRef["TR-02"]).toMatchObject({ is_latest: false, is_past: true, sold_out: true });
    });

    it("builds the cover srcset from the public bucket, smallest first, and never exposes originals", async () => {
        const body = SuitList.parse((await request(testApp()).get("/suits?limit=1")).body);
        const cover = body.items[0]!.cover!;
        expect(cover.srcset.map((s) => s.w)).toEqual([320, 480]);
        expect(cover.srcset[0]!.url.startsWith(IMG_BASE)).toBe(true);
        expect(JSON.stringify(body)).not.toContain("/orig");
    });

    it("filters by style, latest and months", async () => {
        const london = SuitList.parse((await request(testApp()).get("/suits?style=london")).body);
        expect(london.items.every((s) => s.style === "london")).toBe(true);
        const latest = SuitList.parse((await request(testApp()).get("/suits?latest=true")).body);
        expect(latest.items.map((s) => s.ref)).toEqual(["LN-05", "TR-04", "LN-03"]);
        const recent = SuitList.parse((await request(testApp()).get("/suits?months=1")).body);
        expect(recent.items.map((s) => s.ref)).toEqual(["LN-05", "TR-04", "LN-03"]);
    });

    it("pages with an opaque cursor", async () => {
        const app = testApp();
        const first = SuitList.parse((await request(app).get("/suits?limit=2")).body);
        expect(first.items.map((s) => s.ref)).toEqual(["LN-05", "TR-04"]);
        const second = SuitList.parse((await request(app).get(`/suits?limit=2&cursor=${first.next_cursor}`)).body);
        expect(second.items.map((s) => s.ref)).toEqual(["LN-03", "TR-02"]);
    });

    it("400 validation_failed for a bad filter or an unknown field", async () => {
        for (const q of ["style=paris", "limit=500", "months=0", "cursor=bm9wZQ", "colour=red"]) {
            const res = await request(testApp()).get(`/suits?${q}`);
            expect(res.status, q).toBe(400);
            expect(ApiError.parse(res.body).error.code).toBe("validation_failed");
        }
    });
});

describe("GET /suits/:slug", () => {
    it("returns the detail with variants and related suits of the same style", async () => {
        const res = await request(testApp()).get("/suits/london-style-ln-03");
        expect(res.status).toBe(200);
        const body = SuitDetail.parse(res.body);
        expect(body.ref).toBe("LN-03");
        expect(body.variants).toHaveLength(1);
        expect(body.real_photo).toBeNull();
        expect(body.related.map((s) => s.ref)).toEqual(["LN-05", "LN-01"]);
    });

    it("404 not_found for an unknown or malformed slug", async () => {
        for (const slug of ["london-style-ln-99", "../admin", "LONDON"]) {
            const res = await request(testApp()).get(`/suits/${encodeURIComponent(slug)}`);
            expect(res.status, slug).toBe(404);
            expect(ApiError.parse(res.body).error.code).toBe("not_found");
        }
    });
});

describe("GET /suits/sitemap", () => {
    it("lists every published slug", async () => {
        const res = await request(testApp()).get("/suits/sitemap");
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(5);
    });
});

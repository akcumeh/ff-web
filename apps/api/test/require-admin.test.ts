import { describe, expect, it } from "vitest";
import request from "supertest";
import { AdminMe, ApiError } from "@ff/shared";
import { ADMIN_ID, SITE, STRANGER_ID, testApp } from "./helpers.ts";

const tokens = {
  "admin-aal1": { sub: ADMIN_ID, email: "owner@example.com", aal: "aal1" },
  "admin-aal2": { sub: ADMIN_ID, email: "owner@example.com", aal: "aal2" },
  "stranger-aal1": { sub: STRANGER_ID, email: "someone@example.com", aal: "aal1" },
};

const codeOf = (body: unknown) => ApiError.parse(body).error.code;

describe("requireAdmin on GET /admin/me", () => {
  it("401 without a token", async () => {
    const res = await request(testApp({ tokens })).get("/admin/me");
    expect(res.status).toBe(401);
    expect(codeOf(res.body)).toBe("unauthenticated");
  });

  it("401 with a token that does not verify", async () => {
    const res = await request(testApp({ tokens })).get("/admin/me").set("Authorization", "Bearer forged");
    expect(res.status).toBe(401);
    expect(codeOf(res.body)).toBe("unauthenticated");
  });

  it("403 not_admin for a signed-in user who is not on the owner list", async () => {
    const res = await request(testApp({ tokens })).get("/admin/me").set("Authorization", "Bearer stranger-aal1");
    expect(res.status).toBe(403);
    expect(codeOf(res.body)).toBe("not_admin");
  });

  it("200 for an admin with no authenticator, password only", async () => {
    const res = await request(testApp({ tokens })).get("/admin/me").set("Authorization", "Bearer admin-aal1");
    expect(res.status).toBe(200);
    expect(AdminMe.parse(res.body)).toEqual({ adminId: ADMIN_ID, email: "owner@example.com", mfaEnabled: false });
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("403 mfa_required when the admin has an authenticator but skipped the code", async () => {
    const res = await request(testApp({ tokens, totpUsers: [ADMIN_ID] }))
      .get("/admin/me")
      .set("Authorization", "Bearer admin-aal1");
    expect(res.status).toBe(403);
    expect(codeOf(res.body)).toBe("mfa_required");
  });

  it("200 when the admin has an authenticator and gave the code", async () => {
    const res = await request(testApp({ tokens, totpUsers: [ADMIN_ID] }))
      .get("/admin/me")
      .set("Authorization", "Bearer admin-aal2");
    expect(res.status).toBe(200);
    expect(AdminMe.parse(res.body).mfaEnabled).toBe(true);
  });
});

describe("CORS", () => {
  it("allows our own site origin", async () => {
    const res = await request(testApp()).options("/admin/me").set("Origin", SITE).set("Access-Control-Request-Method", "GET");
    expect(res.headers["access-control-allow-origin"]).toBe(SITE);
  });

  it("gives no CORS header to another origin", async () => {
    const res = await request(testApp()).options("/admin/me").set("Origin", "https://evil.example").set("Access-Control-Request-Method", "GET");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

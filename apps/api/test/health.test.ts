import { describe, expect, it } from "vitest";
import request from "supertest";
import { HealthResponse } from "@ff/shared";
import { createApp } from "../src/app.ts";

describe("GET /health", () => {
  it("answers with the shared schema", async () => {
    const res = await request(createApp()).get("/health");
    expect(res.status).toBe(200);
    expect(HealthResponse.safeParse(res.body).success).toBe(true);
  });

  it("answers 404 JSON for unknown routes", async () => {
    const res = await request(createApp()).get("/nope");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "not_found" });
  });
});

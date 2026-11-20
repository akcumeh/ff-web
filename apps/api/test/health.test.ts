import { describe, expect, it } from "vitest";
import request from "supertest";
import { ApiError, HealthResponse } from "@ff/shared";
import { testApp } from "./helpers.ts";

describe("GET /health", () => {
  it("answers with the shared schema", async () => {
    const res = await request(testApp()).get("/health");
    expect(res.status).toBe(200);
    expect(HealthResponse.safeParse(res.body).success).toBe(true);
    expect(res.headers["x-request-id"]).toBeTruthy();
  });

  it("answers 404 in the shared error shape for unknown routes", async () => {
    const res = await request(testApp()).get("/nope");
    expect(res.status).toBe(404);
    expect(ApiError.parse(res.body).error.code).toBe("not_found");
  });
});

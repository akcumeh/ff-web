import express from "express";
import type { HealthResponse } from "@ff/shared";

/**
 * Builds the Express app. Routes get added here step by step
 * (see the build order in docs/HANDOFF.md).
 */
export function createApp() {
  const app = express();

  app.disable("x-powered-by");

  app.get("/health", (_req, res) => {
    const body: HealthResponse = {
      ok: true,
      service: "ff-api",
      time: new Date().toISOString(),
    };
    res.json(body);
  });

  app.use((_req, res) => {
    res.status(404).json({ error: "not_found" });
  });

  return app;
}

import { randomUUID } from "node:crypto";
import express, { Router } from "express";
import helmet from "helmet";
import cors from "cors";
import type { HealthResponse } from "@ff/shared";
import { currentAdmin, requireAdmin, type AuthDeps } from "./lib/auth.ts";
import { errorHandler, notFound } from "./lib/errors.ts";
import { catalogueRouter } from "./routes/catalogue.ts";
import type { Catalogue } from "./services/catalogue.ts";

export type AppDeps = {
  allowedOrigins: string[];
  auth: AuthDeps;
  catalogue: Catalogue;
};

export function createApp(deps: AppDeps) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use((req, res, next) => {
    const incoming = req.get("x-request-id");
    const id = incoming && /^[A-Za-z0-9-]{8,64}$/.test(incoming) ? incoming : randomUUID();
    res.locals.requestId = id;
    res.set("x-request-id", id);
    next();
  });
  app.use(helmet());
  app.use(
    cors({
      origin: deps.allowedOrigins,
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: false,
    }),
  );
  app.use(express.json({ limit: "100kb" }));

  app.get("/health", (_req, res) => {
    const body: HealthResponse = { ok: true, service: "ff-api", time: new Date().toISOString() };
    res.json(body);
  });

  app.use("/suits", catalogueRouter(deps.catalogue));

  const admin = Router();
  admin.use(requireAdmin(deps.auth));
  admin.use((_req, res, next) => {
    res.set("cache-control", "no-store");
    next();
  });
  admin.get("/me", (_req, res) => {
    res.json(currentAdmin(res));
  });
  app.use("/admin", admin);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

import { randomUUID } from "node:crypto";
import express, { Router } from "express";
import helmet from "helmet";
import cors from "cors";
import type { HealthResponse } from "@ff/shared";
import { currentAdmin, requireAdmin, type AuthDeps } from "./lib/auth.ts";
import { errorHandler, notFound } from "./lib/errors.ts";
import { catalogueRouter } from "./routes/catalogue.ts";
import type { Catalogue } from "./services/catalogue.ts";
import { adminCatalogueRouter } from "./routes/admin-catalogue.ts";
import type { AdminCatalogue } from "./services/admin-catalogue.ts";
import { adminAiRouter } from "./routes/admin-ai.ts";
import type { Generation } from "./services/generation.ts";
import { adminChannelsRouter } from "./routes/admin-channels.ts";
import type { Channels } from "./services/channels.ts";
import type { AdminCatalogueRepo } from "./services/admin-catalogue.ts";

export type AppDeps = {
  allowedOrigins: (string | RegExp)[];
  auth: AuthDeps;
  catalogue: Catalogue;
  adminCatalogue: AdminCatalogue;
  generation: Generation;
  channels: Channels;
  suitLookup: Pick<AdminCatalogueRepo, "getSuit">;
  background?: (p: Promise<unknown>) => void;
  rawBodyRouters?: Router[];
  publicRouters?: Router[];
  adminRouters?: Router[];
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

  for (const r of deps.rawBodyRouters ?? []) app.use(r);

  app.use(express.json({ limit: "100kb" }));

  app.get("/health", (_req, res) => {
    const body: HealthResponse = { ok: true, service: "ff-api", time: new Date().toISOString() };
    res.json(body);
  });

  app.use("/suits", catalogueRouter(deps.catalogue));
  for (const r of deps.publicRouters ?? []) app.use(r);

  const admin = Router();
  admin.use(requireAdmin(deps.auth));
  admin.use((_req, res, next) => {
    res.set("cache-control", "no-store");
    next();
  });
  admin.get("/me", (_req, res) => {
    res.json(currentAdmin(res));
  });
  admin.use(adminCatalogueRouter(deps.adminCatalogue));
  admin.use(adminAiRouter(deps.generation, deps.background));
  admin.use(adminChannelsRouter(deps.channels, deps.suitLookup));
  for (const r of deps.adminRouters ?? []) admin.use(r);
  app.use("/admin", admin);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

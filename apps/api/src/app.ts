import express from "express";
import { createApp } from "./create-app.ts";
import { loadConfig } from "./config.ts";
import { createSupabase, supabaseAuthDeps } from "./lib/supabase.ts";
import { supabaseCatalogueRepo } from "./repos/catalogue-repo.ts";
import { createCatalogue } from "./services/catalogue.ts";
import { supabaseAdminCatalogueRepo } from "./repos/admin-catalogue-repo.ts";
import { createAdminCatalogue } from "./services/admin-catalogue.ts";
import { supabaseStorage } from "./lib/storage.ts";
import { revalidator, supabaseAudit } from "./lib/side-effects.ts";
import { supabaseGenerationRepo } from "./repos/generation-repo.ts";
import { createGeneration } from "./services/generation.ts";
import { createGemini, GeminiFailure, type GeminiPort } from "./services/gemini.ts";
import { supabaseChannelRepo } from "./repos/channel-repo.ts";
import { createChannels } from "./services/channels.ts";
import { createTelegram } from "./services/telegram.ts";
import { supabaseAnalyticsRepo } from "./repos/analytics-repo.ts";
import { createAnalytics } from "./services/analytics.ts";
import { createNightly } from "./services/nightly.ts";
import { adminAnalyticsRouter, cronRouter, publicAnalyticsRouter, supabaseAdminAnalytics } from "./routes/analytics.ts";
import { supabaseOrdersRepo } from "./repos/orders-repo.ts";
import { createOrders } from "./services/orders.ts";
import { createPaystack } from "./services/paystack.ts";
import { adminOrdersRouter, publicOrdersRouter, webhookRouter } from "./routes/orders.ts";
import { createTryon } from "./services/tryon.ts";
import { supabaseTryonSuit, tryonRouter } from "./routes/tryon.ts";

const config = loadConfig();
const supabase = createSupabase(config);
const audit = supabaseAudit(supabase);
const catalogueRepo = supabaseAdminCatalogueRepo(supabase);
const storage = supabaseStorage(supabase);
const genRepo = supabaseGenerationRepo(supabase);

const telegram = config.telegram.token ? createTelegram({ token: config.telegram.token }) : null;
const alert = async (text: string) => {
    if (telegram && config.telegram.alertChatId) await telegram.sendMessage(config.telegram.alertChatId, text).catch(() => {});
};

const noKey = async (): Promise<never> => {
    throw new GeminiFailure("failed", "no_api_key");
};
const gemini: GeminiPort = config.googleApiKey ? createGemini({ apiKey: config.googleApiKey }) : { observe: noKey, write: noKey, draw: noKey };

const channels = createChannels({
    repo: supabaseChannelRepo(supabase),
    storage,
    telegram,
    channelId: config.telegram.channelId,
    alertChatId: config.telegram.alertChatId,
    siteUrl: config.siteUrl,
    audit,
});

const analytics = createAnalytics({ repo: supabaseAnalyticsRepo(supabase), visitorSecret: config.visitorSecret, ipSecret: config.ipSecret });

const orders = createOrders({
    repo: supabaseOrdersRepo(supabase),
    paystack: config.paystackSecret ? createPaystack({ secretKey: config.paystackSecret }) : null,
    siteUrl: config.siteUrl,
    alert,
    audit,
    visitorIdForCookie: (c) => analytics.visitorIdForCookie(c),
    serverEvent: (type, suitId, visitorId) => analytics.serverEvent(type, suitId, visitorId),
});

const tryon = createTryon({
    gen: genRepo,
    storage,
    gemini,
    suitBySlug: supabaseTryonSuit(supabase),
    visitorSecret: config.visitorSecret,
    ipSecret: config.ipSecret,
    enabled: config.ai.tryonEnabled && Boolean(config.googleApiKey),
    monthlyCapUsdMicro: config.ai.tryonMonthlyCapUsdMicro,
});

const nightly = createNightly({ db: supabase, telegram, channelId: config.telegram.channelId, alertChatId: config.telegram.alertChatId });

const app = createApp({
    allowedOrigins: config.allowedOrigins,
    auth: supabaseAuthDeps(supabase),
    catalogue: createCatalogue(supabaseCatalogueRepo(supabase), `${config.supabaseUrl}/storage/v1/object/public/public-suits/`),
    adminCatalogue: createAdminCatalogue({
        repo: catalogueRepo,
        storage,
        audit,
        revalidate: revalidator(config.siteUrl, config.revalidateSecret),
        afterPublish: (suit, repost) => channels.afterPublish(suit, repost),
    }),
    channels,
    suitLookup: catalogueRepo,
    generation: createGeneration({ gen: genRepo, catalogue: catalogueRepo, storage, gemini, audit, monthlyCapUsdMicro: config.ai.monthlyCapUsdMicro }),
    rawBodyRouters: [webhookRouter(orders, config.paystackSecret), tryonRouter(tryon, analytics.limit)],
    publicRouters: [publicAnalyticsRouter(analytics), publicOrdersRouter(orders, analytics.limit), cronRouter(nightly, config.cronSecret)],
    adminRouters: [adminAnalyticsRouter(analytics, supabaseAdminAnalytics(supabase), audit), adminOrdersRouter(orders)],
});

export { config };
export default app;

import { createApp } from "./app.ts";
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

const config = loadConfig();
const supabase = createSupabase(config);
const audit = supabaseAudit(supabase);
const catalogueRepo = supabaseAdminCatalogueRepo(supabase);
const storage = supabaseStorage(supabase);
const noKey = async (): Promise<never> => {
  throw new GeminiFailure("failed", "no_api_key");
};
const channels = createChannels({
  repo: supabaseChannelRepo(supabase),
  storage,
  telegram: config.telegram.token ? createTelegram({ token: config.telegram.token }) : null,
  channelId: config.telegram.channelId,
  alertChatId: config.telegram.alertChatId,
  siteUrl: config.siteUrl,
  audit,
});
const gemini: GeminiPort = config.googleApiKey ? createGemini({ apiKey: config.googleApiKey }) : { observe: noKey, draw: noKey };

const app = createApp({
  allowedOrigins: config.allowedOrigins,
  auth: supabaseAuthDeps(supabase),
  catalogue: createCatalogue(
    supabaseCatalogueRepo(supabase),
    `${config.supabaseUrl}/storage/v1/object/public/public-suits/`,
  ),
  adminCatalogue: createAdminCatalogue({
    repo: catalogueRepo,
    storage,
    audit,
    revalidate: revalidator(config.siteUrl, config.revalidateSecret),
    afterPublish: (suit, repost) => channels.afterPublish(suit, repost),
  }),
  channels,
  suitLookup: catalogueRepo,
  generation: createGeneration({ gen: supabaseGenerationRepo(supabase), catalogue: catalogueRepo, storage, gemini, audit }),
});

export { config };
export default app;

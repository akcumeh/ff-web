import { createApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { createSupabase, supabaseAuthDeps } from "./lib/supabase.ts";
import { supabaseCatalogueRepo } from "./repos/catalogue-repo.ts";
import { createCatalogue } from "./services/catalogue.ts";
import { supabaseAdminCatalogueRepo } from "./repos/admin-catalogue-repo.ts";
import { createAdminCatalogue } from "./services/admin-catalogue.ts";
import { supabaseStorage } from "./lib/storage.ts";
import { revalidator, supabaseAudit } from "./lib/side-effects.ts";

const config = loadConfig();
const supabase = createSupabase(config);

const app = createApp({
  allowedOrigins: config.allowedOrigins,
  auth: supabaseAuthDeps(supabase),
  catalogue: createCatalogue(
    supabaseCatalogueRepo(supabase),
    `${config.supabaseUrl}/storage/v1/object/public/public-suits/`,
  ),
  adminCatalogue: createAdminCatalogue({
    repo: supabaseAdminCatalogueRepo(supabase),
    storage: supabaseStorage(supabase),
    audit: supabaseAudit(supabase),
    revalidate: revalidator(config.siteUrl, config.revalidateSecret),
  }),
});

export { config };
export default app;

import { createApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { createSupabase, supabaseAuthDeps } from "./lib/supabase.ts";
import { supabaseCatalogueRepo } from "./repos/catalogue-repo.ts";
import { createCatalogue } from "./services/catalogue.ts";

const config = loadConfig();
const supabase = createSupabase(config);

const app = createApp({
  allowedOrigins: config.allowedOrigins,
  auth: supabaseAuthDeps(supabase),
  catalogue: createCatalogue(
    supabaseCatalogueRepo(supabase),
    `${config.supabaseUrl}/storage/v1/object/public/public-suits/`,
  ),
});

export { config };
export default app;

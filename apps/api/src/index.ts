import { createApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { createSupabase, supabaseAuthDeps } from "./lib/supabase.ts";

const config = loadConfig();
const supabase = createSupabase(config);

const app = createApp({
  allowedOrigins: config.allowedOrigins,
  auth: supabaseAuthDeps(supabase),
});

export { config };
export default app;

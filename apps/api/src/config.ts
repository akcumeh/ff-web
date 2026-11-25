import { z } from "zod";

const Env = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  SITE_URL: z.url().default("http://localhost:3000"),
  SUPABASE_DB_URL: z.url(),
  GOOGLE_API_KEY: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(20).optional()),
  TG_BOT_TOKEN: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(3).optional()),
  TG_CHANNEL_ID: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(3).optional()),
  TG_ALERT_CHAT_ID: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(3).optional()),
  VISITOR_HASH_SECRET: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(24).optional()),
  IP_HASH_SECRET: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(24).optional()),
  CRON_SECRET: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(16).optional()),
  PAYSTACK_SECRET_KEY: z.preprocess((v) => (v === "" ? undefined : v), z.string().regex(/^sk_(test|live)_/, "must start with sk_test_ or sk_live_").optional()),
  REVALIDATE_SECRET: z.string().min(24, "use 24 or more random characters").optional(),
  AI_MONTHLY_CAP_USD: z.coerce.number().min(0).max(1000).default(9),
  TRYON_ENABLED: z.enum(["true", "false"]).default("true"),
  TRYON_MONTHLY_CAP_USD: z.coerce.number().min(0).max(1000).default(2),
  SUPABASE_SEC_KEY: z.string().startsWith("sb_secret_", "must be the new sb_secret_ key, not a legacy key"),
});

export type Config = {
  port: number;
  siteUrl: string;
  allowedOrigins: (string | RegExp)[];
  supabaseUrl: string;
  supabaseSecretKey: string;
  revalidateSecret: string | undefined;
  googleApiKey: string | undefined;
  telegram: { token: string | undefined; channelId: string | undefined; alertChatId: string | undefined };
  visitorSecret: string | undefined;
  ipSecret: string | undefined;
  cronSecret: string | undefined;
  paystackSecret: string | undefined;
  ai: { monthlyCapUsdMicro: number; tryonEnabled: boolean; tryonMonthlyCapUsdMicro: number };
};

const LAN_ORIGIN = /^http:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|[a-z0-9-]+\.local)(:\d+)?$/;

function wwwTwin(origin: string): string {
  const url = new URL(origin);
  url.hostname = url.hostname.startsWith("www.") ? url.hostname.slice(4) : `www.${url.hostname}`;
  return url.origin;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = Env.safeParse(env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`API env is not valid:\n${lines}`);
  }
  const e = parsed.data;
  const siteOrigin = new URL(e.SITE_URL).origin;
  const isLocal = new URL(siteOrigin).hostname === "localhost";
  return {
    port: e.PORT,
    siteUrl: siteOrigin,
    allowedOrigins: isLocal ? [siteOrigin, LAN_ORIGIN] : [siteOrigin, wwwTwin(siteOrigin)],
    supabaseUrl: e.SUPABASE_DB_URL.replace(/\/+$/, ""),
    supabaseSecretKey: e.SUPABASE_SEC_KEY,
    revalidateSecret: e.REVALIDATE_SECRET,
    googleApiKey: e.GOOGLE_API_KEY,
    telegram: { token: e.TG_BOT_TOKEN, channelId: e.TG_CHANNEL_ID, alertChatId: e.TG_ALERT_CHAT_ID },
    visitorSecret: e.VISITOR_HASH_SECRET,
    ipSecret: e.IP_HASH_SECRET,
    cronSecret: e.CRON_SECRET,
    paystackSecret: e.PAYSTACK_SECRET_KEY,
    ai: {
      monthlyCapUsdMicro: Math.round(e.AI_MONTHLY_CAP_USD * 1_000_000),
      tryonEnabled: e.TRYON_ENABLED === "true",
      tryonMonthlyCapUsdMicro: Math.round(e.TRYON_MONTHLY_CAP_USD * 1_000_000),
    },
  };
}

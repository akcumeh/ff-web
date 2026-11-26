import { z } from "zod";

const Env = z.object({
    NEXT_SUPABASE_DB_URL: z.url(),
    NEXT_SUPABASE_PUB_KEY: z.string().startsWith("sb_publishable_", "must be the new sb_publishable_ key"),
    API_INTERNAL_URL: z.url().default("http://localhost:4000"),
    NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
});

let cached: z.infer<typeof Env> | undefined;

export function serverEnv() {
    if (cached) return cached;
    const parsed = Env.safeParse(process.env);
    if (!parsed.success) {
        const lines = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
        throw new Error(`Web env is not valid:\n${lines}`);
    }
    cached = parsed.data;
    return cached;
}

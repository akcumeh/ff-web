import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Config } from "../config.ts";
import type { AuthDeps } from "./auth.ts";

export function createSupabase(config: Config): SupabaseClient {
    return createClient(config.supabaseUrl, config.supabaseSecretKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
}

export function supabaseAuthDeps(supabase: SupabaseClient): AuthDeps {
    return {
        async verifyToken(token) {
            const { data, error } = await supabase.auth.getClaims(token);
            if (error || !data) return null;
            const c = data.claims;
            if (typeof c.sub !== "string") return null;
            return { sub: c.sub, email: typeof c.email === "string" ? c.email : undefined, aal: typeof c.aal === "string" ? c.aal : undefined };
        },
        async findAdmin(userId) {
            const { data, error } = await supabase.from("admins").select("user_id, email").eq("user_id", userId).maybeSingle();
            if (error) throw new Error(`admins lookup failed: ${error.message}`);
            return data;
        },
        async hasVerifiedTotp(userId) {
            const { data, error } = await supabase.auth.admin.mfa.listFactors({ userId });
            if (error) throw new Error(`factor lookup failed: ${error.message}`);
            return data.factors.some((f) => f.factor_type === "totp" && f.status === "verified");
        },
    };
}

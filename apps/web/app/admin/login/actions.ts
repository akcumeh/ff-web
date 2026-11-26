"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginRequest, TotpCode } from "@ff/shared";
import { createSupabaseServer } from "@/lib/supabase-server";

export type FormState = {
    message?: string;
    fieldErrors?: Record<string, string>;
    email?: string;
};

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
    const out: Record<string, string> = {};
    for (const i of issues) {
        const key = String(i.path[0] ?? "form");
        out[key] ??= i.message;
    }
    return out;
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
    const email = String(formData.get("email") ?? "");
    const parsed = LoginRequest.safeParse({ email, password: formData.get("password") ?? "" });
    if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues), email };

    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) {
        const message =
            error.status === 429 ? "Too many tries. Wait a few minutes and try again." : "That email and password do not match.";
        return { message, email };
    }

    (await cookies()).set("ff_internal", "1", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", secure: process.env.NODE_ENV === "production", httpOnly: false });
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    redirect(data?.nextLevel === "aal2" && data.currentLevel !== "aal2" ? "/admin/login/code" : "/admin");
}

export async function verifyCode(_prev: FormState, formData: FormData): Promise<FormState> {
    const parsed = TotpCode.safeParse({ code: formData.get("code") ?? "" });
    if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues) };

    const supabase = await createSupabaseServer();
    const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
    const factor = factors?.totp[0];
    if (listError || !factor) return { message: "No authenticator app is set up for this account." };

    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: parsed.data.code });
    if (error) return { fieldErrors: { code: "That code did not work. Use the newest code in the app." } };

    redirect("/admin");
}

export async function signOut() {
    const supabase = await createSupabaseServer();
    await supabase.auth.signOut({ scope: "local" });
    redirect("/admin/login");
}

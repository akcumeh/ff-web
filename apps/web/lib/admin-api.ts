import type { z } from "zod";
import { AdminMe, ApiError } from "@ff/shared";
import { createSupabaseServer } from "./supabase-server";
import { serverEnv } from "./server-env";

export type AdminResult<T> =
    | { kind: "ok"; data: T }
    | { kind: "error"; status: number; code: string; message: string }
    | { kind: "offline" };

export async function sessionToken(): Promise<string | null> {
    const supabase = await createSupabaseServer();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
}

export async function adminGet<S extends z.ZodType>(path: string, schema: S): Promise<AdminResult<z.infer<S>>> {
    const token = await sessionToken();
    if (!token) return { kind: "error", status: 401, code: "unauthenticated", message: "Sign in to continue." };
    let res: Response;
    try {
        res = await fetch(`${serverEnv().API_INTERNAL_URL}/admin${path}`, {
            headers: { authorization: `Bearer ${token}` },
            cache: "no-store",
            signal: AbortSignal.timeout(15_000),
        });
    } catch {
        return { kind: "offline" };
    }
    const body: unknown = await res.json().catch(() => null);
    if (res.ok) return { kind: "ok", data: schema.parse(body) };
    const parsed = ApiError.safeParse(body);
    return parsed.success
        ? { kind: "error", status: res.status, code: parsed.data.error.code, message: parsed.data.error.message }
        : { kind: "error", status: res.status, code: "internal", message: "Something went wrong." };
}

export type MeResult = { kind: "ok"; me: AdminMe } | { kind: "error"; status: number; code: string; message: string } | { kind: "offline" };

export async function fetchMe(): Promise<MeResult> {
    const r = await adminGet("/me", AdminMe);
    return r.kind === "ok" ? { kind: "ok", me: r.data } : r;
}

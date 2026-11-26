import { ApiError } from "@ff/shared";

export type CallResult<T> =
    | { ok: true; data: T }
    | { ok: false; code: string; message: string; fields: Record<string, string> };

export async function adminCall<T = unknown>(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<CallResult<T>> {
    let res: Response;
    try {
        res = await fetch(`/admin/api${path}`, {
            method,
            headers: body === undefined ? undefined : { "content-type": "application/json" },
            body: body === undefined ? undefined : JSON.stringify(body),
            credentials: "same-origin",
        });
    } catch {
        return { ok: false, code: "offline", message: "No connection. Check your internet and try again.", fields: {} };
    }
    const json: unknown = await res.json().catch(() => null);
    if (res.ok) return { ok: true, data: json as T };
    const err = ApiError.safeParse(json);
    if (!err.success) return { ok: false, code: "internal", message: "Something went wrong. Try again.", fields: {} };
    const fields: Record<string, string> = {};
    for (const d of err.data.error.details ?? []) fields[d.path] ??= d.message;
    if (res.status === 401) window.location.assign("/admin/login");
    return { ok: false, code: err.data.error.code, message: err.data.error.message, fields };
}

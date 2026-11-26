import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditEntry } from "../services/admin-catalogue.ts";

export function supabaseAudit(db: SupabaseClient) {
    return async (e: AuditEntry) => {
        const { error } = await db.from("audit_log").insert({
            admin_id: e.adminId,
            action: e.action,
            target_type: e.targetType,
            target_id: e.targetId,
            detail: e.detail ?? null,
        });
        if (error) console.error(JSON.stringify({ level: "warn", msg: "audit write failed", action: e.action, error: error.message }));
    };
}

export function revalidator(siteUrl: string, secret: string | undefined) {
    return async (tags: string[]) => {
        if (!secret) {
            console.warn(JSON.stringify({ level: "warn", msg: "REVALIDATE_SECRET not set, public pages refresh on their hourly timer only", tags }));
            return;
        }
        try {
            const res = await fetch(`${siteUrl}/api/revalidate`, {
                method: "POST",
                headers: { "content-type": "application/json", "x-revalidate-secret": secret },
                body: JSON.stringify({ tags }),
                signal: AbortSignal.timeout(5000),
            });
            if (!res.ok) throw new Error(`status ${res.status}`);
        } catch (err) {
            console.error(JSON.stringify({ level: "warn", msg: "revalidate failed", tags, error: String(err) }));
        }
    };
}

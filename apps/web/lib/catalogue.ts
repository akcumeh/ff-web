import { SuitDetail, SuitList } from "@ff/shared";
import { apiInternalUrl } from "./public-env";

const REVALIDATE_SECONDS = 3600;

export type ListParams = {
    style?: "london" | "turkey";
    months?: number;
    latest?: boolean;
    exclude?: string;
    limit?: number;
    cursor?: string;
};

export async function getSuits(params: ListParams = {}): Promise<SuitList | null> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined) qs.set(k, String(v));
    try {
        const res = await fetch(`${apiInternalUrl()}/suits${qs.size ? `?${qs}` : ""}`, {
            next: { revalidate: REVALIDATE_SECONDS, tags: ["suits"] },
            signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) return null;
        return SuitList.parse(await res.json());
    } catch {
        return null;
    }
}

export type SuitResult = { kind: "ok"; suit: SuitDetail } | { kind: "not_found" } | { kind: "offline" };

export async function getSuit(slug: string): Promise<SuitResult> {
    try {
        const res = await fetch(`${apiInternalUrl()}/suits/${encodeURIComponent(slug)}`, {
            next: { revalidate: REVALIDATE_SECONDS, tags: ["suits", `suit:${slug}`] },
            signal: AbortSignal.timeout(10_000),
        });
        if (res.status === 404) return { kind: "not_found" };
        if (!res.ok) return { kind: "offline" };
        return { kind: "ok", suit: SuitDetail.parse(await res.json()) };
    } catch {
        return { kind: "offline" };
    }
}

export async function getConfig(): Promise<{ tryon_enabled: boolean }> {
    try {
        const res = await fetch(`${apiInternalUrl()}/config`, { next: { revalidate: 60, tags: ["config"] }, signal: AbortSignal.timeout(5000) });
        if (!res.ok) return { tryon_enabled: false };
        const body = (await res.json()) as { tryon_enabled?: unknown };
        return { tryon_enabled: body.tryon_enabled === true };
    } catch {
        return { tryon_enabled: false };
    }
}

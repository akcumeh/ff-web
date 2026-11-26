import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { serverEnv } from "@/lib/server-env";

const MAX_BODY_BYTES = 1024 * 1024;

function fail(status: number, code: string, message: string) {
    return NextResponse.json({ error: { code, message } }, { status, headers: { "cache-control": "no-store" } });
}

async function forward(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
    const env = serverEnv();

    if (request.method !== "GET") {
        const origin = request.headers.get("origin");
        const site = request.headers.get("sec-fetch-site");
        const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
        const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
        const allowed = new Set([new URL(env.NEXT_PUBLIC_SITE_URL).origin, ...(host ? [`${proto}://${host}`] : [])]);
        if (!origin || !allowed.has(origin) || (site !== null && site !== "same-origin")) {
            return fail(403, "forbidden_origin", "This request did not come from the admin site.");
        }
    }

    const { path } = await ctx.params;
    const joined = path.join("/");
    if (joined.includes("..") || joined.includes("//") || joined.includes("\\") || /^[a-z][a-z0-9+.-]*:/i.test(joined)) {
        return fail(400, "validation_failed", "Bad path.");
    }

    const supabase = await createSupabaseServer();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return fail(401, "unauthenticated", "Sign in to continue.");

    let body: string | undefined;
    if (request.method !== "GET") {
        body = await request.text();
        if (Buffer.byteLength(body) > MAX_BODY_BYTES) return fail(413, "too_large", "The request body is too large.");
    }

    let upstream: Response;
    try {
        upstream = await fetch(`${env.API_INTERNAL_URL}/admin/${joined}${request.nextUrl.search}`, {
            method: request.method,
            headers: {
                authorization: `Bearer ${token}`,
                ...(body !== undefined ? { "content-type": request.headers.get("content-type") ?? "application/json" } : {}),
                ...(request.headers.get("x-request-id") ? { "x-request-id": request.headers.get("x-request-id")! } : {}),
            },
            body,
            cache: "no-store",
            signal: AbortSignal.timeout(60_000),
        });
    } catch {
        return fail(502, "upstream_failed", "The site is having a problem right now. Please try again in a few minutes.");
    }

    return new NextResponse(await upstream.text(), {
        status: upstream.status,
        headers: {
            "content-type": upstream.headers.get("content-type") ?? "application/json",
            "cache-control": "no-store",
            ...(upstream.headers.get("x-request-id") ? { "x-request-id": upstream.headers.get("x-request-id")! } : {}),
        },
    });
}

export { forward as GET, forward as POST, forward as PATCH, forward as DELETE };

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE } from "./lib/supabase-server";
import { serverEnv } from "./lib/server-env";

const IDLE_LIMIT_MS = 12 * 60 * 60 * 1000;
const LAST_SEEN = "ff_last";

function jsonError(status: number, code: string, message: string) {
    return NextResponse.json({ error: { code, message } }, { status, headers: { "cache-control": "no-store" } });
}

export async function proxy(request: NextRequest) {
    const env = serverEnv();
    let response = NextResponse.next({ request });

    const supabase = createServerClient(env.NEXT_SUPABASE_DB_URL, env.NEXT_SUPABASE_PUB_KEY, {
        cookieOptions: ADMIN_COOKIE,
        cookies: {
            getAll: () => request.cookies.getAll(),
            setAll(list) {
                for (const { name, value } of list) request.cookies.set(name, value);
                response = NextResponse.next({ request });
                for (const { name, value, options } of list) response.cookies.set(name, value, { ...options, ...ADMIN_COOKIE });
            },
        },
    });

    const path = request.nextUrl.pathname;
    const isLogin = path === "/admin/login";
    const isCode = path === "/admin/login/code";
    const isApi = path.startsWith("/admin/api/");

    const redirectTo = (to: string) => {
        const r = NextResponse.redirect(new URL(to, request.url));
        for (const c of response.cookies.getAll()) r.cookies.set(c);
        return r;
    };

    const { data } = await supabase.auth.getClaims();
    let signedIn = Boolean(data?.claims);

    if (signedIn) {
        const last = Number(request.cookies.get(LAST_SEEN)?.value ?? 0);
        if (last && Date.now() - last > IDLE_LIMIT_MS) {
            await supabase.auth.signOut({ scope: "local" });
            response.cookies.delete({ name: LAST_SEEN, path: "/admin" });
            signedIn = false;
        } else {
            response.cookies.set(LAST_SEEN, String(Date.now()), { ...ADMIN_COOKIE, maxAge: IDLE_LIMIT_MS / 1000 });
        }
    }

    if (!signedIn) {
        if (isLogin) return response;
        if (isApi) return jsonError(401, "unauthenticated", "Sign in to continue.");
        return redirectTo("/admin/login");
    }

    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const needsCode = aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2";

    if (needsCode) {
        if (isCode) return response;
        if (isApi) return jsonError(401, "mfa_required", "Enter the code from your authenticator app.");
        return redirectTo("/admin/login/code");
    }

    if (isLogin || isCode) return redirectTo("/admin");
    return response;
}

export const config = {
    matcher: ["/admin/:path*"],
};

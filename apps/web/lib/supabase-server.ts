import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { serverEnv } from "./server-env";

export const ADMIN_COOKIE: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/admin",
};

export async function createSupabaseServer() {
  const env = serverEnv();
  const store = await cookies();
  return createServerClient(env.NEXT_SUPABASE_DB_URL, env.NEXT_SUPABASE_PUB_KEY, {
    cookieOptions: ADMIN_COOKIE,
    cookies: {
      getAll: () => store.getAll(),
      setAll(list) {
        try {
          for (const { name, value, options } of list) store.set(name, value, { ...options, ...ADMIN_COOKIE });
        } catch {
          // Server components cannot set cookies; proxy.ts refreshes the session instead.
        }
      },
    },
  });
}

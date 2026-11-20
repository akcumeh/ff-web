import type { RequestHandler, Response } from "express";
import type { AdminMe } from "@ff/shared";
import { HttpError } from "./errors.ts";
import { TtlCache } from "./ttl-cache.ts";

export type TokenClaims = { sub: string; email?: string; aal?: string };

export type AdminRow = { user_id: string; email: string };

export interface AuthDeps {
  verifyToken(token: string): Promise<TokenClaims | null>;
  findAdmin(userId: string): Promise<AdminRow | null>;
  hasVerifiedTotp(userId: string): Promise<boolean>;
}

export function requireAdmin(deps: AuthDeps): RequestHandler {
  const admins = new TtlCache<AdminRow | null>(60_000);
  const totp = new TtlCache<boolean>(60_000);

  return async (req, res, next) => {
    const header = req.get("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!token) throw new HttpError(401, "unauthenticated", "Sign in to continue.");

    const claims = await deps.verifyToken(token);
    if (!claims) throw new HttpError(401, "unauthenticated", "Sign in to continue.");

    const admin = await admins.get(claims.sub, () => deps.findAdmin(claims.sub));
    if (!admin) throw new HttpError(403, "not_admin", "This account is not on the owner list.");

    const mfaEnabled = await totp.get(claims.sub, () => deps.hasVerifiedTotp(claims.sub));
    if (mfaEnabled && claims.aal !== "aal2") {
      throw new HttpError(403, "mfa_required", "Enter the code from your authenticator app.");
    }

    const me: AdminMe = { adminId: admin.user_id, email: admin.email, mfaEnabled };
    res.locals.admin = me;
    next();
  };
}

export function currentAdmin(res: Response): AdminMe {
  return res.locals.admin as AdminMe;
}

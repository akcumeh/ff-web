import { createApp } from "../src/app.ts";
import type { AuthDeps, TokenClaims } from "../src/lib/auth.ts";

export const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
export const STRANGER_ID = "22222222-2222-4222-8222-222222222222";
export const SITE = "http://localhost:3000";

export type FakeOptions = {
  tokens?: Record<string, TokenClaims>;
  totpUsers?: string[];
};

export function fakeAuth(opts: FakeOptions = {}): AuthDeps {
  const tokens = opts.tokens ?? {};
  const totp = new Set(opts.totpUsers ?? []);
  return {
    async verifyToken(token) {
      return tokens[token] ?? null;
    },
    async findAdmin(userId) {
      return userId === ADMIN_ID ? { user_id: ADMIN_ID, email: "owner@example.com" } : null;
    },
    async hasVerifiedTotp(userId) {
      return totp.has(userId);
    },
  };
}

export function testApp(opts: FakeOptions = {}) {
  return createApp({ allowedOrigins: [SITE], auth: fakeAuth(opts) });
}

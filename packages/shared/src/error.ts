import { z } from "zod";

export const ErrorCode = z.enum([
    "validation_failed",
    "unauthenticated",
    "mfa_required",
    "not_admin",
    "forbidden_origin",
    "not_found",
    "conflict",
    "too_large",
    "rule_failed",
    "rate_limited",
    "upstream_failed",
    "budget_blocked",
    "ai_disabled",
    "internal",
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ApiError = z.object({
    error: z.object({
        code: ErrorCode,
        message: z.string(),
        details: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
    }),
});
export type ApiError = z.infer<typeof ApiError>;

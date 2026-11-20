import { z } from "zod";

export const LoginRequest = z.strictObject({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")),
  password: z.string().min(1, "Enter your password").max(200),
});
export type LoginRequest = z.infer<typeof LoginRequest>;

export const TotpCode = z.strictObject({
  code: z.string().trim().regex(/^[0-9]{6}$/, "Enter the 6 digit code from your authenticator app"),
});
export type TotpCode = z.infer<typeof TotpCode>;

export const AdminMe = z.object({
  adminId: z.uuid(),
  email: z.string(),
  mfaEnabled: z.boolean(),
});
export type AdminMe = z.infer<typeof AdminMe>;

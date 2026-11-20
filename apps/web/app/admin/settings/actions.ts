"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { TotpCode } from "@ff/shared";
import { createSupabaseServer } from "@/lib/supabase-server";

export type StartResult =
  | { ok: true; factorId: string; qrCode: string; secret: string }
  | { ok: false; message: string };

export type ConfirmState = { done?: boolean; message?: string };

export async function startEnroll(): Promise<StartResult> {
  const supabase = await createSupabaseServer();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  if (factors?.totp.length) return { ok: false, message: "An authenticator app is already on." };

  for (const f of factors?.all ?? []) {
    if (f.factor_type === "totp" && f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", issuer: "Frankie Suits" });
  if (error || !data) return { ok: false, message: "Could not start the setup. Try again." };
  return { ok: true, factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

const ConfirmInput = TotpCode.extend({ factorId: z.uuid() });

export async function confirmEnroll(_prev: ConfirmState, formData: FormData): Promise<ConfirmState> {
  const parsed = ConfirmInput.safeParse({ code: formData.get("code") ?? "", factorId: formData.get("factorId") ?? "" });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Check the code." };

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: parsed.data.factorId, code: parsed.data.code });
  if (error) return { message: "That code did not work. Use the newest code in the app." };

  revalidatePath("/admin");
  return { done: true };
}

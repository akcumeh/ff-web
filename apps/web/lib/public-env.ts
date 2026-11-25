import { toWaNumber } from "@ff/shared";

export function apiInternalUrl(): string {
  return (process.env.API_INTERNAL_URL ?? "http://localhost:4000").replace(/\/+$/, "");
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export function whatsappNumber(): string | null {
  const raw = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  return raw ? toWaNumber(raw) : null;
}

export const HEAD_OFFICE_TEL = "07081156800";

export const PHONES = [
  { tel: "07081156800", where: "Head office" },
  { tel: "07069743721", where: "Branch office" },
  { tel: "08098269558", where: "Branch office" },
] as const;

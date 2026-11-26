import { waLink } from "@ff/shared";
import { HEAD_OFFICE_TEL, whatsappNumber } from "./public-env";

export type ContactLink = { href: string; label: string; external: boolean };

export function contactLink(message: string, waLabel: string): ContactLink {
    const number = whatsappNumber();
    if (number) return { href: waLink(number, message), label: waLabel, external: true };
    return { href: `tel:${HEAD_OFFICE_TEL}`, label: "Call us", external: false };
}

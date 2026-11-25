"use client";

import { waLink } from "@ff/shared";
import { enquiryCode, track } from "@/lib/tracker";

export function EnquireLink({
  number,
  slug,
  baseMessage,
  className,
  label = "Ask about this suit on WhatsApp",
}: {
  number: string;
  slug: string;
  baseMessage: string;
  className?: string;
  label?: string;
}) {
  const plain = waLink(number, baseMessage);
  return (
    <a
      href={plain}
      target="_blank"
      rel="noopener"
      className={className}
      onClick={(e) => {
        const code = enquiryCode();
        const extra = (e.currentTarget.closest("[data-picker]") as HTMLElement | null)?.dataset.choice;
        const message = `${baseMessage}${extra ? ` ${extra}.` : ""} Code ${code}`;
        e.currentTarget.href = waLink(number, message);
        void track({ type: "enquire_click", suit_slug: slug, code });
      }}
    >
      {label}
    </a>
  );
}

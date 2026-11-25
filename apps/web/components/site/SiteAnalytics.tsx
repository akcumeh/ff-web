"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { chooseConsent, consent, track } from "@/lib/tracker";
import styles from "./site.module.css";

export function SiteAnalytics() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [agree, setAgree] = useState(false);

  useEffect(() => {
    setOpen(consent() === "unset");
    const reopen = () => {
      setAgree(consent() === "accepted");
      setOpen(true);
    };
    window.addEventListener("ff:open-consent", reopen);
    return () => window.removeEventListener("ff:open-consent", reopen);
  }, []);

  useEffect(() => {
    const timers = new Map<Element, ReturnType<typeof setTimeout>>();
    const seen = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const slug = (e.target as HTMLElement).dataset.trackView;
          if (!slug || seen.has(slug)) continue;
          if (e.isIntersecting && document.visibilityState === "visible") {
            timers.set(
              e.target,
              setTimeout(() => {
                seen.add(slug);
                void track({ type: "suit_view", suit_slug: slug });
                observer.unobserve(e.target);
              }, 1000),
            );
          } else {
            clearTimeout(timers.get(e.target));
            timers.delete(e.target);
          }
        }
      },
      { threshold: 0.5 },
    );
    document.querySelectorAll("[data-track-view]").forEach((el) => observer.observe(el));

    const pageSlug = document.querySelector<HTMLElement>("[data-track-page]")?.dataset.trackPage;
    const pageTimer = pageSlug ? setTimeout(() => void track({ type: "suit_view", suit_slug: pageSlug }), 1000) : undefined;

    const onClick = (ev: MouseEvent) => {
      const link = (ev.target as HTMLElement).closest<HTMLElement>("[data-track-join]");
      if (link) void track({ type: "join_channel_click", ...(link.dataset.trackJoin ? { suit_slug: link.dataset.trackJoin } : {}) });
    };
    document.addEventListener("click", onClick);

    return () => {
      observer.disconnect();
      timers.forEach((t) => clearTimeout(t));
      clearTimeout(pageTimer);
      document.removeEventListener("click", onClick);
    };
  }, [path]);

  if (!open) return null;

  const save = () => {
    chooseConsent(agree ? "accepted" : "declined");
    setOpen(false);
  };

  return (
    <section role="region" aria-label="Visit counting" className={styles.consent}>
      <p className={styles.consentText}>
        We count which suits people look at, so we know what to bring in. We never collect your name or phone number.
      </p>
      <label className={styles.consentCheck}>
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>You can count my visits too. This does not tell you who I am.</span>
      </label>
      <div className={styles.consentKeys}>
        <button type="button" className={styles.consentKey} onClick={save}>Done</button>
      </div>
    </section>
  );
}

export function PrivacySettingsButton({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event("ff:open-consent"))}>
      Visit counting
    </button>
  );
}

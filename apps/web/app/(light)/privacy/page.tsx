import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata";
import site from "@/components/site/site.module.css";
import styles from "@/components/site/pages.module.css";

export const metadata: Metadata = buildMetadata({ title: "Privacy", description: "What Frankie Suits collects on this site, why, and how long it is kept.", path: "/privacy" });

export default function PrivacyPage() {
  return (
    <div className={site.container}>
      <section className={styles.section} aria-labelledby="privacy-title">
        <h1 id="privacy-title" className={styles.h1}>Privacy</h1>
        <p className={styles.placeholder}>
          OWNER_TO_FILL: the privacy wording, checked by a lawyer before launch. It must cover the anonymous counters, the
          accepted-analytics cookie and fingerprint, orders, the changing room if it is switched on, the services that process
          data (Supabase, Vercel, Paystack, Google, Telegram), how long each is kept, and how to withdraw consent.
        </p>
      </section>
    </div>
  );
}

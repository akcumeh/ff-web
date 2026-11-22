import type { Metadata } from "next";
import { contactLink } from "@/lib/contact";
import { buildMetadata } from "@/lib/metadata";
import site from "@/components/site/site.module.css";
import styles from "@/components/site/pages.module.css";

export const metadata: Metadata = buildMetadata({
  title: "Ladies' suits wholesale, Lagos Island",
  description: "Order ladies' London and Turkey suits in bulk for churches, offices, events and uniforms. Martins Street, Lagos Island.",
  path: "/wholesale",
});

export default function WholesalePage() {
  const bulk = contactLink(
    "Hello Frankie Suits, I want to order suits in bulk. Styles and sizes: ... Date needed: ... Head count: ...",
    "Send a bulk request",
  );
  return (
    <div className={site.container}>
      <section className={styles.section} aria-labelledby="wholesale-title">
        <h1 id="wholesale-title" className={styles.h1}>Wholesale</h1>
        <p className={styles.lead}>
          We sell ladies&rsquo; London style and Turkey style suits in bulk to churches, offices, event organisers and
          companies who need uniforms.
        </p>
        <p className={styles.body}>
          Send a list of styles and sizes, or give us the date and the head count. We reply on WhatsApp with what is in stock
          and when it can be ready.
        </p>
        <p className={styles.placeholder}>OWNER_TO_FILL: minimum order and bulk prices, if the owners want to publish them.</p>
        <div className={styles.actions} style={{ marginTop: "var(--space-4)" }}>
          <a href={bulk.href} className={styles.primary} {...(bulk.external ? { target: "_blank", rel: "noopener" } : {})}>
            {bulk.label}
          </a>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="visit-title">
        <h2 id="visit-title" className={styles.h2}>Visit the showroom</h2>
        <div className={styles.split}>
          <div>
            <h3 className={styles.collectionTitle}>Head office</h3>
            <p className={styles.small}>43 Martins Street (Brasas Plaza), Lagos Island</p>
            <p className={styles.small}>Tel: <a href="tel:07081156800">07081156800</a></p>
          </div>
          <div>
            <h3 className={styles.collectionTitle}>Branch office</h3>
            <p className={styles.small}>No 35/37 Martins Street (Faith Plaza), Lagos Island</p>
            <p className={styles.small}>
              Tel: <a href="tel:07069743721">07069743721</a>, <a href="tel:08098269558">08098269558</a>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

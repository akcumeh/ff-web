import type { Metadata } from "next";
import site from "@/components/site/site.module.css";
import styles from "@/components/site/pages.module.css";

export const metadata: Metadata = {
  title: "Delivery and refunds | Frankie Suits",
  description: "How Frankie Suits delivers orders and handles returns and refunds.",
};

export default function DeliveryPage() {
  return (
    <div className={site.container}>
      <section className={styles.section} aria-labelledby="delivery-title">
        <h1 id="delivery-title" className={styles.h1}>Delivery and refunds</h1>
        <p className={styles.body}>Delivery is arranged with you on WhatsApp after you pay.</p>
        <p className={styles.placeholder}>
          OWNER_TO_FILL: delivery areas, who arranges and pays for delivery, how long it takes, returns and refunds, and what
          happens when two people pay for the last piece.
        </p>
      </section>
    </div>
  );
}

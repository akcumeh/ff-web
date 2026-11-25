import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata";
import { ContactButtons } from "@/components/site/ContactButtons";
import site from "@/components/site/site.module.css";
import styles from "@/components/site/pages.module.css";

export const metadata: Metadata = buildMetadata({ title: "Delivery and refunds", description: "How delivery and refunds work at Frankie Suits.", path: "/delivery-and-refunds" });

export default function DeliveryPage() {
  return (
    <div className={site.container}>
      <section className={styles.section} aria-labelledby="delivery-title">
        <h1 id="delivery-title" className={styles.h1}>Delivery and refunds</h1>
        <h2 className={styles.h2}>Delivery</h2>
        <p className={styles.body}>
          After you pay, tap &ldquo;Arrange delivery on WhatsApp&rdquo;. We will agree the place, the day and the delivery cost with you there.
        </p>
        <h2 className={styles.h2}>Problems and refunds</h2>
        <p className={styles.body}>If something is wrong with your suit, chat with us or call us, and we will sort it out with you.</p>
        <ContactButtons message="Hello Frankie Suits, I have a question about my order." />
      </section>
    </div>
  );
}

import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata";
import site from "@/components/site/site.module.css";
import styles from "@/components/site/pages.module.css";

export const metadata: Metadata = buildMetadata({ title: "Privacy", description: "What Frankie Suits keeps when you use this website, and why.", path: "/privacy" });

export default function PrivacyPage() {
    return (
        <div className={site.container}>
            <section className={styles.section} aria-labelledby="privacy-title">
                <h1 id="privacy-title" className={styles.h1}>Privacy</h1>
                <p className={styles.lead}>This page says what we keep when you use this website, and why.</p>

                <h2 className={styles.h2}>Counting visits</h2>
                <p className={styles.body}>
                    We count how many times each suit is looked at. This tells us which suits people like. The count has no name or phone
                    number in it.
                </p>
                <p className={styles.body}>
                    If you allow analytics cookies, we also save a random number on your phone or computer. It lets us
                    see when the same phone comes back. It does not tell us who you are. We delete it after one year. You can change your
                    choice at any time with &ldquo;Cookie settings&rdquo; at the bottom of every page.
                </p>

                <h2 className={styles.h2}>When you pay</h2>
                <p className={styles.body}>
                    To deliver your suit, we keep your name, phone number and delivery address. Paystack takes your card payment. We never
                    see your card number.
                </p>

                <h2 className={styles.h2}>Trying on a suit</h2>
                <p className={styles.body}>
                    When you try on a suit, your photo goes to Google to make the picture, and comes straight back to you. We do not keep
                    your photo or the picture.
                </p>

                <h2 className={styles.h2}>Questions</h2>
                <p className={styles.body}>
                    Email <a href="mailto:frankiefabrics@yahoo.com">frankiefabrics@yahoo.com</a> or chat with us on WhatsApp.
                </p>
            </section>
        </div>
    );
}

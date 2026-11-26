import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata";
import { ContactButtons } from "@/components/site/ContactButtons";
import site from "@/components/site/site.module.css";
import styles from "@/components/site/pages.module.css";

export const metadata: Metadata = buildMetadata({
    title: "Buy suits in bulk, Lagos Island",
    description: "Buy many ladies' London and Turkey suits for your church, office, event or group. Martins Street, Lagos Island.",
    path: "/wholesale",
});

export default function WholesalePage() {
    return (
        <div className={site.container}>
            <section className={styles.section} aria-labelledby="wholesale-title">
                <h1 id="wholesale-title" className={styles.h1}>Buy in bulk</h1>
                <p className={styles.lead}>
                    We sell many suits at once to churches, offices, event planners and groups who want everyone in the same suit.
                </p>
                <p className={styles.body}>Send us a WhatsApp message and tell us:</p>
                <ul className={styles.plainList}>
                    <li>which suits you like (send a photo or the suit number)</li>
                    <li>how many suits you need, and the sizes</li>
                    <li>the date you need them</li>
                </ul>
                <p className={styles.body}>We will tell you what we have and when it can be ready.</p>
                <ContactButtons message={"Hello Frankie Suits, I want to buy suits in bulk.\nSuits I like:\nHow many and sizes:\nDate I need them:"} />
            </section>
        </div>
    );
}

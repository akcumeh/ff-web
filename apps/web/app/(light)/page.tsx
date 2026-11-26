import Link from "next/link";
import { getConfig, getSuits } from "@/lib/catalogue";
import { buildMetadata } from "@/lib/metadata";
import { JsonLd, storeJsonLd } from "@/lib/jsonld";
import { siteUrl } from "@/lib/public-env";
import { ContactButtons } from "@/components/site/ContactButtons";
import { SuitCardLink } from "@/components/site/SuitCardLink";
import { SuitImage } from "@/components/site/SuitImage";
import site from "@/components/site/site.module.css";
import styles from "@/components/site/pages.module.css";
import cards from "@/components/site/suits.module.css";

export const metadata = buildMetadata({
    title: "Frankie Suits",
    description: "Ladies' London and Turkey suits for church, work and events. Martins Street, Lagos Island. Since 2012.",
    path: "",
});

const OCCASIONS = [
    { name: "Church", line: "Skirt suits and long jackets for Sunday service." },
    { name: "Work", line: "Neat suits for the office, all week." },
    { name: "Events", line: "Matching suits for weddings and special days." },
    { name: "Uniforms", line: "Many suits in one colour for your whole group." },
];

export default async function HomePage() {
    const [latest, config] = await Promise.all([getSuits({ latest: true, limit: 4 }), getConfig()]);
    const heroSuit = latest?.items.find((s) => s.cover);

    return (
        <>
            <JsonLd data={storeJsonLd(siteUrl())} />
            <section className={`${site.container} ${styles.hero}`} aria-labelledby="home-title">
                <div className={styles.heroText}>
                    <h1 id="home-title" className={styles.display}>Ladies&rsquo; London and Turkey suits</h1>
                    <p className={styles.lead}>
                        {config.tryon_enabled
                            ? "See our latest suits, then try any of them on your own photo before you buy."
                            : "See our latest suits and ask us about any of them on WhatsApp."}
                    </p>
                    <div className={styles.actions}>
                        <Link href="/gallery" className={styles.primary}>See our suits</Link>
                        {config.tryon_enabled && <Link href="/changing-room" className={styles.secondary}>Try a suit on</Link>}
                    </div>
                </div>
                {heroSuit?.cover && (
                    <div className={styles.field}>
                        <SuitImage img={heroSuit.cover} sizes="(max-width: 860px) 90vw, 480px" priority className={styles.fieldPhoto} />
                    </div>
                )}
            </section>

            <section className={`${site.container} ${styles.section}`} aria-labelledby="new-title">
                <h2 id="new-title" className={styles.h2}>New suits</h2>
                {latest === null && <p className={styles.notice}>The suits could not load just now. Please refresh the page.</p>}
                {latest && latest.items.length === 0 && <p className={styles.notice}>New suits are coming soon.</p>}
                {latest && latest.items.length > 0 && (
                    <ul className={cards.grid}>
                        {latest.items.map((s) => (
                            <li key={s.id}><SuitCardLink suit={s} /></li>
                        ))}
                    </ul>
                )}
                <Link href="/gallery" className={styles.textLink}>See all our suits</Link>
            </section>

            <section className={`${site.container} ${styles.section}`} aria-labelledby="occasion-title">
                <h2 id="occasion-title" className={styles.h2}>Suits for every day</h2>
                <ul className={styles.collections}>
                    {OCCASIONS.map((c) => (
                        <li key={c.name}>
                            <h3 className={styles.collectionTitle}>{c.name}</h3>
                            <p className={styles.small}>{c.line}</p>
                        </li>
                    ))}
                </ul>
            </section>

            <section className={`${site.container} ${styles.section}`} aria-labelledby="talk-title">
                <h2 id="talk-title" className={styles.h2}>Talk to us</h2>
                <p className={styles.body}>Ask about a suit, a size or a colour. We reply on WhatsApp.</p>
                <ContactButtons />
            </section>

            <section className={`${site.container} ${styles.section}`} aria-labelledby="team-title">
                <h2 id="team-title" className={styles.h2}>Buying many suits?</h2>
                <p className={styles.body}>We sell to churches, offices and groups. Tell us how many suits you need and when you need them.</p>
                <div className={styles.actions}>
                    <Link href="/wholesale" className={styles.secondary}>Buy in bulk</Link>
                </div>
            </section>
        </>
    );
}

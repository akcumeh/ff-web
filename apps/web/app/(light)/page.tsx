import Link from "next/link";
import { getSuits } from "@/lib/catalogue";
import { contactLink } from "@/lib/contact";
import { SuitCardLink } from "@/components/site/SuitCardLink";
import { SuitImage } from "@/components/site/SuitImage";
import site from "@/components/site/site.module.css";
import styles from "@/components/site/pages.module.css";
import cards from "@/components/site/suits.module.css";

const COLLECTIONS = [
  { name: "Church", line: "Skirt suits and long jackets for Sunday service." },
  { name: "Office", line: "Tailored sets for the working week." },
  { name: "Events", line: "Matching outfits for weddings and conferences." },
  { name: "Uniforms", line: "Bulk orders in one colour for your whole team." },
];

export default async function HomePage() {
  const latest = await getSuits({ latest: true, limit: 4 });
  const heroSuit = latest?.items.find((s) => s.cover);
  const message = contactLink("Hello Frankie Suits, I would like to ask about your suits.", "Message us on WhatsApp");

  return (
    <>
      <section className={`${site.container} ${styles.hero}`} aria-labelledby="home-title">
        <div className={styles.heroText}>
          <h1 id="home-title" className={styles.display}>Ladies&rsquo; London and Turkey suits</h1>
          <p className={styles.lead}>Wholesale and retail from Martins Street, Lagos Island. Since 2012.</p>
          <div className={styles.actions}>
            <Link href="/gallery" className={styles.primary}>See the gallery</Link>
            <a href={message.href} className={styles.secondary} {...(message.external ? { target: "_blank", rel: "noopener" } : {})}>
              {message.label}
            </a>
          </div>
        </div>
        <div className={styles.field}>
          {heroSuit?.cover && <SuitImage img={heroSuit.cover} sizes="(max-width: 860px) 90vw, 480px" priority className={styles.fieldPhoto} />}
        </div>
      </section>

      <section className={`${site.container} ${styles.section}`} aria-labelledby="collections-title">
        <h2 id="collections-title" className={styles.h2}>For every occasion</h2>
        <ul className={styles.collections}>
          {COLLECTIONS.map((c) => {
            const link = contactLink(`Hello Frankie Suits, I am looking for suits for ${c.name.toLowerCase()}.`, `Ask about ${c.name.toLowerCase()} suits`);
            return (
              <li key={c.name}>
                <h3 className={styles.collectionTitle}>{c.name}</h3>
                <p className={styles.small}>{c.line}</p>
                <a href={link.href} className={styles.textLink} {...(link.external ? { target: "_blank", rel: "noopener" } : {})}>
                  {link.label}
                </a>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={`${site.container} ${styles.section}`} aria-labelledby="new-title">
        <h2 id="new-title" className={styles.h2}>New in store</h2>
        {latest === null && <p className={styles.notice}>The designs could not be loaded just now. Reload the page in a moment.</p>}
        {latest && latest.items.length === 0 && <p className={styles.notice}>New designs are on their way. Check back soon.</p>}
        {latest && latest.items.length > 0 && (
          <ul className={cards.grid}>
            {latest.items.map((s) => (
              <li key={s.id}><SuitCardLink suit={s} /></li>
            ))}
          </ul>
        )}
        <Link href="/gallery" className={styles.textLink}>See every design in the gallery</Link>
      </section>

      <section className={`${site.container} ${styles.section}`} aria-labelledby="team-title">
        <h2 id="team-title" className={styles.h2}>Ordering for a team?</h2>
        <p className={styles.body}>Send a list of styles and sizes, or give us the date and the head count.</p>
        <div className={styles.actions}>
          <Link href="/wholesale" className={styles.secondary}>Order in bulk</Link>
        </div>
      </section>
    </>
  );
}

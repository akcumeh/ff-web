import type { Metadata } from "next";
import Link from "next/link";
import { getConfig } from "@/lib/catalogue";
import { buildMetadata } from "@/lib/metadata";
import { JsonLd, storeJsonLd } from "@/lib/jsonld";
import { siteUrl } from "@/lib/public-env";
import { ContactButtons } from "@/components/site/ContactButtons";
import site from "@/components/site/site.module.css";
import styles from "@/components/site/pages.module.css";

export const metadata: Metadata = buildMetadata({
  title: "About",
  description: "Frankie Suits has sold ladies' London and Turkey suits on Martins Street, Lagos Island, since 2012.",
  path: "/about",
});

export default async function AboutPage() {
  const config = await getConfig();
  const steps = [
    { title: "1. Choose a suit", text: "Look through our suits and pick the one you like." },
    ...(config.tryon_enabled ? [{ title: "2. Try it on", text: "Add a photo of yourself and see how the suit looks on you." }] : []),
    { title: `${config.tryon_enabled ? 3 : 2}. Ask or pay`, text: "Chat with us on WhatsApp about size and colour, or pay on the website." },
    { title: `${config.tryon_enabled ? 4 : 3}. Get it delivered`, text: "We agree the delivery with you on WhatsApp." },
  ];
  return (
    <div className={site.container}>
      <JsonLd data={storeJsonLd(siteUrl())} />
      <section className={styles.section} aria-labelledby="about-title">
        <h1 id="about-title" className={styles.h1}>About us</h1>
        <p className={styles.lead}>
          We have sold ladies&rsquo; suits on Martins Street, Lagos Island, since 2012. We sell London style and Turkey style
          suits to single buyers and to groups. Women wear them to church, to work and to special events.
        </p>
        <p className={styles.sub}>Sir Frank Umeh, C.E.O.</p>
      </section>

      <section className={styles.section} aria-labelledby="order-title">
        <h2 id="order-title" className={styles.h2}>How to buy</h2>
        <ul className={styles.collections}>
          {steps.map((s) => (
            <li key={s.title}>
              <h3 className={styles.collectionTitle}>{s.title}</h3>
              <p className={styles.small}>{s.text}</p>
            </li>
          ))}
        </ul>
        <div className={styles.actions}>
          <Link href="/gallery" className={styles.secondary}>See our suits</Link>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="talk-title">
        <h2 id="talk-title" className={styles.h2}>Talk to us</h2>
        <p className={styles.body}>WhatsApp is the fastest way to reach us.</p>
        <ContactButtons message="Hello Frankie Suits, I have a question." />
      </section>
    </div>
  );
}

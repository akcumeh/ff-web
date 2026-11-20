import type { Metadata } from "next";
import Link from "next/link";
import { contactLink } from "@/lib/contact";
import site from "@/components/site/site.module.css";
import styles from "@/components/site/pages.module.css";

export const metadata: Metadata = {
  title: "About | Frankie Suits",
  description: "Frankie Suits has sold ladies' London and Turkey suits on Martins Street, Lagos Island, since 2012.",
};

const STEPS = [
  { title: "Walk in", text: "Visit either office on Martins Street and try a fit." },
  { title: "Message us", text: "Send the style you like on WhatsApp and we reply there." },
  { title: "Order in bulk", text: "Send a list of styles and sizes, or give us the date and the head count." },
  { title: "Order online", text: "Pick a design in the gallery and ask us about it." },
];

export default function AboutPage() {
  const message = contactLink("Hello Frankie Suits, I have a question.", "Message us on WhatsApp");
  return (
    <div className={site.container}>
      <section className={styles.section} aria-labelledby="about-title">
        <h1 id="about-title" className={styles.h1}>About Frankie Suits</h1>
        <p className={styles.lead}>
          Frankie Suits has traded on Martins Street, Lagos Island, since 2012. We sell ladies&rsquo; London style and Turkey
          style suits, retail and wholesale. Women buy them for church and for work. Event organisers and companies order them
          in bulk as uniforms.
        </p>
        <p className={styles.sub}>Sir Frank Umeh, C.E.O.</p>
      </section>

      <section className={styles.section} aria-labelledby="order-title">
        <h2 id="order-title" className={styles.h2}>How to order</h2>
        <ul className={styles.collections}>
          {STEPS.map((s) => (
            <li key={s.title}>
              <h3 className={styles.collectionTitle}>{s.title}</h3>
              <p className={styles.small}>{s.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="talk-title">
        <h2 id="talk-title" className={styles.h2}>Talk to us</h2>
        <p className={styles.body}>The quickest way to reach the shop is a WhatsApp message.</p>
        <div className={styles.actions}>
          <a href={message.href} className={styles.primary} {...(message.external ? { target: "_blank", rel: "noopener" } : {})}>
            {message.label}
          </a>
          <Link href="/gallery" className={styles.secondary}>See the gallery</Link>
        </div>
      </section>
    </div>
  );
}

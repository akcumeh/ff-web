import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatNaira, styleLabel, type SuitDetail } from "@ff/shared";
import { getSuit } from "@/lib/catalogue";
import { contactLink } from "@/lib/contact";
import { siteUrl } from "@/lib/public-env";
import { SuitCardLink } from "@/components/site/SuitCardLink";
import { SuitImage } from "@/components/site/SuitImage";
import site from "@/components/site/site.module.css";
import styles from "@/components/site/pages.module.css";
import cards from "@/components/site/suits.module.css";
import page from "./suit.module.css";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const result = await getSuit(slug);
  if (result.kind !== "ok") return { title: "Design | Frankie Suits" };
  const s = result.suit;
  return {
    title: `${styleLabel[s.style]}, Ref ${s.ref} | Frankie Suits`,
    description: `${styleLabel[s.style]} ladies' suit, Ref ${s.ref}, ${formatNaira(s.price_kobo)}. From Martins Street, Lagos Island.`,
  };
}

function sizesByColour(suit: SuitDetail) {
  const map = new Map<string, { hex: string | null; sizes: { size: string; inStock: boolean }[] }>();
  for (const v of suit.variants) {
    const entry = map.get(v.colour) ?? { hex: v.hex, sizes: [] };
    entry.sizes.push({ size: v.size, inStock: v.in_stock });
    map.set(v.colour, entry);
  }
  return [...map.entries()];
}

export default async function SuitPage({ params }: Params) {
  const { slug } = await params;
  const result = await getSuit(slug);
  if (result.kind === "not_found") notFound();
  if (result.kind === "offline") {
    return (
      <div className={`${site.container} ${styles.section}`}>
        <h1 className={styles.h1}>This design could not be loaded</h1>
        <p className={styles.body}>Reload the page in a moment.</p>
      </div>
    );
  }

  const suit = result.suit;
  const name = styleLabel[suit.style];
  const enquiry = contactLink(
    `Hello Frankie Suits, I would like to ask about Ref ${suit.ref} (${name}). ${siteUrl()}/suits/${suit.slug}`,
    "Ask us about this design",
  );

  return (
    <div className={site.container}>
      <section className={page.layout} aria-labelledby="suit-title">
        <div className={page.media}>
          <figure className={page.figure}>
            {suit.cover ? (
              <SuitImage img={suit.cover} sizes="(max-width: 860px) 90vw, 560px" priority className={page.photo} />
            ) : (
              <div className={cards.noPhoto} aria-hidden="true" />
            )}
            {suit.cover_is_ai && <figcaption className={page.caption}>AI-styled image</figcaption>}
          </figure>
          {suit.real_photo && (
            <figure className={page.figure}>
              <SuitImage img={suit.real_photo} sizes="(max-width: 860px) 45vw, 260px" className={page.photo} />
              <figcaption className={page.caption}>Real photo of this suit</figcaption>
            </figure>
          )}
        </div>

        <div className={page.info}>
          <h1 id="suit-title" className={styles.h1}>{suit.title === name ? name : suit.title}</h1>
          <p className={styles.sub}>Ref {suit.ref}</p>
          <p className={cards.price}>{formatNaira(suit.price_kobo)}</p>

          {(suit.is_past || suit.sold_out) && (
            <p className={cards.tags}>
              {suit.is_past && <span className={cards.tag}>Past design</span>}
              {suit.sold_out && <span className={cards.tag}>Sold out</span>}
            </p>
          )}

          {suit.description && <p className={styles.body}>{suit.description}</p>}

          <h2 className={page.label}>Colours and sizes</h2>
          <ul className={page.colours}>
            {sizesByColour(suit).map(([colour, { hex, sizes }]) => (
              <li key={colour} className={page.colourRow}>
                <span className={page.swatch} style={hex ? { background: hex } : undefined} aria-hidden="true" />
                <span className={page.colourName}>{colour}</span>
                <span className={page.sizes}>
                  {sizes.map((s) => (
                    <span key={s.size} className={s.inStock ? page.size : page.sizeOut}>
                      {s.size}
                      {!s.inStock && <span className={page.visuallyHidden}> (sold out)</span>}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>

          <div className={styles.actions}>
            <a href={enquiry.href} className={styles.primary} {...(enquiry.external ? { target: "_blank", rel: "noopener" } : {})}>
              {enquiry.label}
            </a>
          </div>
          <p className={styles.small}>
            {enquiry.external ? "We reply on WhatsApp. " : ""}Delivery is arranged after you order.
          </p>
        </div>
      </section>

      {suit.related.length > 0 && (
        <section className={styles.section} aria-labelledby="related-title">
          <h2 id="related-title" className={styles.h2}>More {name} designs</h2>
          <ul className={cards.grid}>
            {suit.related.map((s) => (
              <li key={s.id}><SuitCardLink suit={s} /></li>
            ))}
          </ul>
        </section>
      )}

      <p className={styles.section}>
        <Link href="/gallery" className={styles.textLink}>Back to the gallery</Link>
      </p>
    </div>
  );
}

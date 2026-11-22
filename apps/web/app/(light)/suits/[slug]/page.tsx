import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatNaira, styleLabel } from "@ff/shared";
import { getConfig, getSuit } from "@/lib/catalogue";
import { HEAD_OFFICE_TEL, siteUrl, whatsappNumber } from "@/lib/public-env";
import { buildMetadata } from "@/lib/metadata";
import { productJsonLd, JsonLd } from "@/lib/jsonld";
import { SuitBuy } from "@/components/site/SuitBuy";
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
  if (result.kind !== "ok") return buildMetadata({ title: "Design", description: "Ladies' suits from Frankie Suits, Lagos Island.", path: `/suits/${slug}`, noindex: true });
  const s = result.suit;
  return buildMetadata({
    title: `${styleLabel[s.style]}, Ref ${s.ref}`,
    description: `${styleLabel[s.style]} ladies' suit, Ref ${s.ref}, ${formatNaira(s.price_kobo)}. ${s.colours.map((c) => c.name).join(", ")}. From Martins Street, Lagos Island.`,
    path: `/suits/${s.slug}`,
    image: s.cover?.srcset.at(-1)?.url,
  });
}

export default async function SuitPage({ params }: Params) {
  const { slug } = await params;
  const [result, config] = await Promise.all([getSuit(slug), getConfig()]);
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
  const enquiry = `Hello Frankie Suits. I'd like to ask about ${name} Ref ${suit.ref}. ${siteUrl()}/suits/${suit.slug}`;

  return (
    <div className={site.container} data-track-page={suit.slug}>
      <JsonLd data={productJsonLd(suit, siteUrl())} />
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
              <figcaption className={page.caption}>The cloth as photographed</figcaption>
            </figure>
          )}
        </div>

        <div className={page.info}>
          <h1 id="suit-title" className={styles.h1}>{suit.title === name ? name : suit.title}</h1>
          <p className={styles.sub}>Ref {suit.ref}</p>
          {(suit.is_latest || suit.is_past || suit.sold_out) && (
            <p className={cards.tags}>
              {suit.is_latest && <span className={cards.tag}>Latest</span>}
              {suit.is_past && <span className={cards.tag}>Past design</span>}
              {suit.sold_out && <span className={cards.tag}>Sold out</span>}
            </p>
          )}
          {suit.description && <p className={styles.body}>{suit.description}</p>}
          <p className={cards.price}>{formatNaira(suit.price_kobo)}</p>

          <SuitBuy
            slug={suit.slug}
            variants={suit.variants}
            soldOut={suit.sold_out}
            waNumber={whatsappNumber()}
            enquiryMessage={enquiry}
            telFallback={HEAD_OFFICE_TEL}
          />

          {config.tryon_enabled && (
            <p className={styles.small}>
              <Link href={`/changing-room?suit=${suit.slug}`} className={styles.textLink}>Try it on in the changing room</Link>
            </p>
          )}
          <p className={styles.small}>
            <Link href="/delivery-and-refunds" className={styles.textLink}>Delivery and refunds</Link>
          </p>
        </div>
      </section>

      {suit.related.length > 0 && (
        <section className={styles.section} aria-labelledby="related-title">
          <h2 id="related-title" className={styles.h2}>More from this style</h2>
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

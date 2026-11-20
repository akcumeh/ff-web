import Link from "next/link";
import { formatNaira, styleLabel, type SuitCard } from "@ff/shared";
import { SuitImage } from "./SuitImage";
import styles from "./suits.module.css";

export function SuitCardLink({ suit, priority = false }: { suit: SuitCard; priority?: boolean }) {
  const colours = suit.colours.map((c) => c.name).join(", ");
  return (
    <Link href={`/suits/${suit.slug}`} className={styles.card}>
      {suit.cover ? (
        <SuitImage img={suit.cover} sizes="(max-width: 640px) 80vw, 300px" priority={priority} className={styles.photo} />
      ) : (
        <div className={styles.noPhoto} aria-hidden="true" />
      )}
      <hr className={styles.cardRule} />
      <h3 className={styles.cardTitle}>{suit.title === styleLabel[suit.style] ? styleLabel[suit.style] : suit.title}</h3>
      <p className={styles.cardDetail}>Ref {suit.ref}{colours ? `, ${colours}` : ""}</p>
      <p className={styles.priceSmall}>{formatNaira(suit.price_kobo)}</p>
      {(suit.is_past || suit.sold_out) && (
        <p className={styles.tags}>
          {suit.is_past && <span className={styles.tag}>Past design</span>}
          {suit.sold_out && <span className={styles.tag}>Sold out</span>}
        </p>
      )}
      <span className={styles.cardLink}>See this design</span>
    </Link>
  );
}

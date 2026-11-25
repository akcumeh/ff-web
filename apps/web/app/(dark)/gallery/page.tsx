import type { Metadata } from "next";
import Link from "next/link";
import { SuitStyle } from "@ff/shared";
import { getSuits } from "@/lib/catalogue";
import { buildMetadata } from "@/lib/metadata";
import { Carousel } from "@/components/site/Carousel";
import { SuitCardLink } from "@/components/site/SuitCardLink";
import site from "@/components/site/site.module.css";
import styles from "@/components/site/pages.module.css";
import cards from "@/components/site/suits.module.css";
import gallery from "./gallery.module.css";

export const metadata: Metadata = buildMetadata({
  title: "Gallery",
  description: "Ladies' London style and Turkey style suits. See what we have now.",
  path: "/gallery",
});

type Search = { style?: string; months?: string; view?: string; cursor?: string };

const STYLES = [
  { value: undefined, label: "All styles" },
  { value: "london", label: "London style" },
  { value: "turkey", label: "Turkey style" },
] as const;

const RANGES = [
  { value: undefined, label: "Any time" },
  { value: "6", label: "Last 6 months" },
  { value: "12", label: "Last 12 months" },
] as const;

function hrefWith(current: Search, change: Partial<Search>): string {
  const next = { ...current, ...change, cursor: undefined };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(next)) if (v) qs.set(k, v);
  return qs.size ? `/gallery?${qs}` : "/gallery";
}

function olderHref(base: string, cursor: string): string {
  return `${base}${base.includes("?") ? "&" : "?"}cursor=${encodeURIComponent(cursor)}`;
}

export default async function GalleryPage({ searchParams }: { searchParams: Promise<Search> }) {
  const raw = await searchParams;
  const style = SuitStyle.safeParse(raw.style).data;
  const months = raw.months === "6" || raw.months === "12" ? raw.months : undefined;
  const view = raw.view === "grid" ? "grid" : "carousel";
  const current: Search = { style, months, view: view === "grid" ? "grid" : undefined };

  const list = await getSuits({ style, months: months ? Number(months) : undefined, limit: 24, cursor: raw.cursor });

  return (
    <div className={site.container}>
      <section className={styles.section} aria-labelledby="gallery-title">
        <h1 id="gallery-title" className={styles.h1}>Our suits</h1>
        <p className={styles.body}>Swipe to see more, or tap Grid to see them all at once.</p>

        <div className={gallery.filters}>
          <ul className={gallery.chips} aria-label="Style">
            {STYLES.map((s) => (
              <li key={s.label}>
                <Link href={hrefWith(current, { style: s.value })} className={gallery.chip} aria-current={style === s.value ? "true" : undefined}>
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
          <ul className={gallery.chips} aria-label="When">
            {RANGES.map((r) => (
              <li key={r.label}>
                <Link href={hrefWith(current, { months: r.value })} className={gallery.chip} aria-current={months === r.value ? "true" : undefined}>
                  {r.label}
                </Link>
              </li>
            ))}
          </ul>
          <ul className={gallery.chips} aria-label="View">
            <li>
              <Link href={hrefWith(current, { view: undefined })} className={gallery.chip} aria-current={view === "carousel" ? "true" : undefined}>One by one</Link>
            </li>
            <li>
              <Link href={hrefWith(current, { view: "grid" })} className={gallery.chip} aria-current={view === "grid" ? "true" : undefined}>Grid</Link>
            </li>
          </ul>
        </div>

        {list === null && <p className={styles.notice}>The suits could not load just now. Please refresh the page.</p>}
        {list && list.items.length === 0 && <p className={styles.notice}>No suits here. Try another style or a longer time.</p>}

        {list && list.items.length > 0 && view === "carousel" && (
          <Carousel label="Suits. Use the left and right arrow keys to move">
            {list.items.map((s, i) => (
              <li key={s.id}><SuitCardLink suit={s} priority={i < 2} /></li>
            ))}
          </Carousel>
        )}

        {list && list.items.length > 0 && view === "grid" && (
          <ul className={cards.grid}>
            {list.items.map((s, i) => (
              <li key={s.id}><SuitCardLink suit={s} priority={i < 4} /></li>
            ))}
          </ul>
        )}

        {list?.next_cursor && (
          <Link href={olderHref(hrefWith(current, {}), list.next_cursor)} className={styles.textLink}>
            Older designs
          </Link>
        )}
      </section>
    </div>
  );
}

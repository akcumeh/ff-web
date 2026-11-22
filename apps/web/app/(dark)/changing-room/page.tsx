import Link from "next/link";
import { getConfig, getSuits } from "@/lib/catalogue";
import { buildMetadata } from "@/lib/metadata";
import { ChangingRoom } from "./ChangingRoom";
import site from "@/components/site/site.module.css";
import styles from "@/components/site/pages.module.css";

export const metadata = buildMetadata({
  title: "Changing room",
  description: "Try a Frankie Suits design on a photo of yourself before you visit. An AI-styled preview, not a fitting.",
  path: "/changing-room",
});

export default async function ChangingRoomPage({ searchParams }: { searchParams: Promise<{ suit?: string }> }) {
  const { suit } = await searchParams;
  const [config, list] = await Promise.all([getConfig(), getSuits({ limit: 60 })]);

  return (
    <div className={`${site.container} ${styles.section}`}>
      <h1 className={styles.h1}>Changing room</h1>
      {!config.tryon_enabled ? (
        <>
          <p className={styles.body}>The changing room is closed right now. You can still see every design in the gallery.</p>
          <Link href="/gallery" className={styles.textLink}>See the gallery</Link>
        </>
      ) : !list || list.items.length === 0 ? (
        <p className={styles.body}>There are no designs to try on yet.</p>
      ) : (
        <>
          <p className={styles.lead}>Pick a suit, add a photo of yourself, and see how it sits on you. The picture is made by AI and is a rough idea.</p>
          <ChangingRoom
            suits={list.items
              .filter((s) => !s.sold_out && s.cover)
              .map((s) => ({ slug: s.slug, ref: s.ref, title: s.title, thumb: s.cover?.srcset[0]?.url ?? null }))}
            initial={suit && list.items.some((s) => s.slug === suit) ? suit : null}
          />
        </>
      )}
    </div>
  );
}

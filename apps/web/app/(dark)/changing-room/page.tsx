import Link from "next/link";
import { getConfig, getSuits } from "@/lib/catalogue";
import { buildMetadata } from "@/lib/metadata";
import { ChangingRoom } from "./ChangingRoom";
import site from "@/components/site/site.module.css";
import styles from "@/components/site/pages.module.css";

export const metadata = buildMetadata({
    title: "Try a suit on",
    description: "See how a Frankie Suits suit looks on you. Add your photo and the website makes a picture of you in the suit.",
    path: "/changing-room",
});

export default async function ChangingRoomPage({ searchParams }: { searchParams: Promise<{ suit?: string }> }) {
    const { suit } = await searchParams;
    const [config, list] = await Promise.all([getConfig(), getSuits({ limit: 60 })]);

    return (
        <div className={`${site.container} ${styles.section}`}>
            <h1 className={styles.h1}>Try a suit on</h1>
            {!config.tryon_enabled ? (
                <>
                    <p className={styles.body}>Trying on is not working right now. You can still see all our suits.</p>
                    <Link href="/gallery" className={styles.textLink}>See our suits</Link>
                </>
            ) : !list || list.items.length === 0 ? (
                <p className={styles.body}>There are no suits to try on yet.</p>
            ) : (
                <>
                    <p className={styles.lead}>Pick a suit and add a photo of yourself. We will make a picture of you wearing it. It shows how the suit looks on you. It is not exact.</p>
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

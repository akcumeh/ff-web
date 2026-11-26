import { redirect } from "next/navigation";
import { z } from "zod";
import { adminGet } from "@/lib/admin-api";
import { AdminNav } from "../AdminNav";
import { PackCard } from "./PackCard";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";

const PendingPacks = z.object({
  items: z.array(z.object({ id: z.uuid(), suit_ref: z.string(), suit_title: z.string(), caption: z.string(), image_url: z.string().nullable() })),
});

export default async function PostsPage() {
  const result = await adminGet("/packs/pending", PendingPacks);
  if (result.kind === "error" && result.status === 401) redirect("/admin/login");
  const channelUrl = process.env.NEXT_PUBLIC_WHATSAPP_CHANNEL_URL || null;

  return (
    <main id="main" className={styles.page}>
      <AdminNav />
      <h1 className={styles.title}>To post on WhatsApp</h1>
      <p className={styles.lead}>WhatsApp has no way for the site to post into the channel, so each new suit waits here. Save the image, copy the caption, post it in the channel, then press I posted it.</p>
      {result.kind === "offline" && <p className={styles.error}>The site is having a problem right now. Please wait a few minutes and refresh the page.</p>}
      {result.kind === "error" && <p className={styles.error}>{result.message}</p>}
      {result.kind === "ok" && result.data.items.length === 0 && <p className={styles.lead}>Nothing to post. Every published suit is on the channel.</p>}
      {result.kind === "ok" && result.data.items.length > 0 && (
        <div className={styles.packList}>
          {result.data.items.map((p) => (
            <PackCard key={p.id} pack={p} channelUrl={channelUrl} />
          ))}
        </div>
      )}
    </main>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminCall } from "@/lib/admin-client";
import styles from "../../admin.module.css";

export type Post = { id: string; platform: "telegram" | "whatsapp_pack"; status: "pending" | "posted" | "failed"; error: string | null };

export function ChannelStatus({ posts }: { posts: Post[] }) {
    const router = useRouter();
    const [message, setMessage] = useState("");
    const [busy, setBusy] = useState(false);
    if (posts.length === 0) return null;

    async function retry(id: string) {
        setBusy(true);
        setMessage("Posting to Telegram again.");
        const res = await adminCall<Post>("POST", `/posts/${id}/retry`, {});
        setBusy(false);
        setMessage(res.ok ? (res.data.status === "posted" ? "Posted to Telegram." : `Still failing: ${res.data.error ?? "unknown"}`) : res.message);
        router.refresh();
    }

    const tg = posts.find((p) => p.platform === "telegram");
    const pack = posts.find((p) => p.platform === "whatsapp_pack");

    return (
        <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Channels</legend>
            {tg && (
                <div className={styles.actions}>
                    <span>Telegram:</span>
                    {tg.status === "posted" && <span className={styles.status}>Posted</span>}
                    {tg.status === "pending" && <span className={styles.status}>Waiting</span>}
                    {tg.status === "failed" && (
                        <>
                            <span className={styles.badge}>Telegram failed</span>
                            <button type="button" className={styles.secondary} onClick={() => retry(tg.id)} disabled={busy}>Retry</button>
                            {tg.error && <span className={styles.hint}>{tg.error}</span>}
                        </>
                    )}
                </div>
            )}
            {pack && (
                <div className={styles.actions}>
                    <span>WhatsApp channel:</span>
                    {pack.status === "posted" ? (
                        <span className={styles.status}>Posted</span>
                    ) : (
                        <Link href="/admin/posts" className={styles.link}>Waiting for you to post it</Link>
                    )}
                </div>
            )}
            <p role="status" aria-live="polite" className={styles.ok}>{message}</p>
        </fieldset>
    );
}

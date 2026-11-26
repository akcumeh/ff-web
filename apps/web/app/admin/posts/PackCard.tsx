"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminCall } from "@/lib/admin-client";
import styles from "../admin.module.css";

export type Pack = { id: string; suit_ref: string; suit_title: string; caption: string; image_url: string | null };

export function PackCard({ pack, channelUrl }: { pack: Pack; channelUrl: string | null }) {
    const router = useRouter();
    const [message, setMessage] = useState("");
    const [busy, setBusy] = useState(false);

    async function saveImage() {
        if (!pack.image_url) return;
        setMessage("Getting the image.");
        try {
            const blob = await (await fetch(pack.image_url)).blob();
            const file = new File([blob], `${pack.suit_ref}.jpg`, { type: "image/jpeg" });
            if (navigator.canShare?.({ files: [file] })) {
                await navigator.share({ files: [file] });
                setMessage("Image shared. Save it to your photos or send it to the channel.");
                return;
            }
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = file.name;
            a.click();
            URL.revokeObjectURL(url);
            setMessage("Image saved to your downloads.");
        } catch {
            setMessage("Could not get the image. Press and hold it to save it instead.");
        }
    }

    async function copyCaption() {
        try {
            await navigator.clipboard.writeText(pack.caption);
            setMessage("Caption copied.");
        } catch {
            setMessage("Could not copy. Press and hold the caption to copy it.");
        }
    }

    async function markPosted() {
        setBusy(true);
        const res = await adminCall("POST", `/posts/${pack.id}/mark-posted`, {});
        setBusy(false);
        if (!res.ok) {
            setMessage(res.message);
            return;
        }
        router.refresh();
    }

    return (
        <article className={styles.packCard} aria-labelledby={`pack-${pack.id}`}>
            <h2 id={`pack-${pack.id}`} className={styles.label}>{pack.suit_ref}: {pack.suit_title}</h2>
            {pack.image_url && <img src={pack.image_url} alt={`Photo for ${pack.suit_ref}`} className={styles.packImage} />}
            <label htmlFor={`caption-${pack.id}`} className={styles.label}>Caption</label>
            <textarea id={`caption-${pack.id}`} className={styles.textarea} readOnly value={pack.caption} rows={6} />
            <div className={styles.actions}>
                <button type="button" className={styles.secondary} onClick={saveImage} disabled={!pack.image_url}>Save image</button>
                <button type="button" className={styles.secondary} onClick={copyCaption}>Copy caption</button>
                {channelUrl && (
                    <a href={channelUrl} target="_blank" rel="noopener" className={styles.secondary}>Open channel</a>
                )}
                <button type="button" className={styles.primary} onClick={markPosted} disabled={busy}>I posted it</button>
            </div>
            <p role="status" aria-live="polite" className={styles.ok}>{message}</p>
        </article>
    );
}

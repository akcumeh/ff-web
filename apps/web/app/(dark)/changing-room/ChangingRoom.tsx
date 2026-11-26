"use client";

import Link from "next/link";
import { useState } from "react";
import { ApiError } from "@ff/shared";
import { visitorCookieIfAccepted } from "@/lib/tracker";
import styles from "./room.module.css";

type Option = { slug: string; ref: string; title: string; thumb: string | null };

const API = "/ffapi";

async function shrink(file: File): Promise<string> {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    return dataUrl.slice(dataUrl.indexOf(",") + 1);
}

export function ChangingRoom({ suits, initial }: { suits: Option[]; initial: string | null }) {
    const [slug, setSlug] = useState(initial ?? suits[0]?.slug ?? "");
    const [file, setFile] = useState<File | null>(null);
    const [agreed, setAgreed] = useState(false);
    const [adult, setAdult] = useState(false);
    const [status, setStatus] = useState("");
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<string | null>(null);

    const ready = Boolean(slug && file && agreed && adult);
    const reason = !file ? "Add a photo of yourself first." : !agreed || !adult ? "Tick both boxes first." : "";

    async function go() {
        if (!ready || !file) return;
        setBusy(true);
        setResult(null);
        setStatus("Making your picture. Please wait, it takes about one minute.");
        const slow = setTimeout(() => setStatus("This is taking longer than usual. Please wait a little more, or try again."), 60_000);
        try {
            const photo = await shrink(file);
            const cookie = visitorCookieIfAccepted();
            const res = await fetch(`${API}/tryon`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ suit_slug: slug, photo_base64: photo, mime: "image/jpeg", agreed: true, over_18: true, ...(cookie ? { visitor_cookie: cookie } : {}) }),
            });
            const body: unknown = await res.json().catch(() => null);
            if (!res.ok) {
                const err = ApiError.safeParse(body);
                setStatus(err.success ? err.data.error.message : "Something went wrong. Please try again.");
                return;
            }
            setResult(`data:image/jpeg;base64,${(body as { image_base64: string }).image_base64}`);
            setStatus("Here you are! The picture shows how the suit looks on you. It is not exact.");
        } catch {
            setStatus("We could not use that photo, or your internet cut off. Please try again.");
        } finally {
            clearTimeout(slow);
            setBusy(false);
        }
    }

    const chosen = suits.find((s) => s.slug === slug);

    return (
        <div className={styles.room}>
            <fieldset className={styles.step}>
                <legend className={styles.legend}>1. Pick a suit</legend>
                <div className={styles.suits}>
                    {suits.map((s) => (
                        <label key={s.slug} className={styles.suit}>
                            <input type="radio" name="suit" value={s.slug} checked={slug === s.slug} onChange={() => setSlug(s.slug)} />
                            {s.thumb ? <img src={s.thumb} alt="" width={96} height={128} /> : <span className={styles.noThumb} aria-hidden="true" />}
                            <span>Ref {s.ref}</span>
                        </label>
                    ))}
                </div>
            </fieldset>

            <div className={styles.step}>
                <label htmlFor="photo" className={styles.legend}>2. Add your photo</label>
                <p id="photo-hint" className={styles.hint}>Use a clear photo of you standing and facing the camera.</p>
                <input id="photo" type="file" accept="image/*" aria-describedby="photo-hint" className={styles.file} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>

            <fieldset className={styles.step}>
                <legend className={styles.legend}>3. Please tick both boxes</legend>
                <label className={styles.check}>
                    <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                    <span>I agree my photo is sent to Google to make the picture. We do not keep it.</span>
                </label>
                <label className={styles.check}>
                    <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
                    <span>I am 18 or older.</span>
                </label>
            </fieldset>

            <div className={styles.actions}>
                <button type="button" className={styles.primary} onClick={go} disabled={!ready || busy} aria-describedby={reason ? "reason" : undefined}>
                    {busy ? "Making your picture" : "Show me in this suit"}
                </button>
                {reason && !busy && <span id="reason" className={styles.hint}>{reason}</span>}
            </div>

            <p role="status" aria-live="polite" className={styles.status}>{status}</p>

            {result && chosen && (
                <figure className={styles.result}>
                    <img src={result} alt={`AI-styled preview of you in ${chosen.title}, Ref ${chosen.ref}`} />
                    <figcaption className={styles.badge}>Picture made with AI</figcaption>
                    <Link href={`/suits/${chosen.slug}`} className={styles.primary}>Buy this suit</Link>
                </figure>
            )}
        </div>
    );
}

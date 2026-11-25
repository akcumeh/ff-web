"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { formatNaira, type AdminSuitDetail } from "@ff/shared";
import { adminCall } from "@/lib/admin-client";
import { VariantsField, draftsToInput, type VariantDraft } from "../VariantsField";
import { AiPanel } from "./AiPanel";
import styles from "../../admin.module.css";

function toDrafts(suit: AdminSuitDetail): VariantDraft[] {
  const map = new Map<string, VariantDraft>();
  for (const v of suit.variants) {
    const d = map.get(v.colour) ?? { colour: v.colour, hex: v.colour_hex ?? "", sizes: [] };
    d.sizes.push(v.size);
    map.set(v.colour, d);
  }
  return [...map.values()];
}

export function SuitEditor({ suit, siteUrl }: { suit: AdminSuitDetail; siteUrl: string }) {
  const router = useRouter();
  const [title, setTitle] = useState(suit.title);
  const [description, setDescription] = useState(suit.description ?? "");
  const [price, setPrice] = useState(String(suit.price_kobo / 100));
  const [variants, setVariants] = useState<VariantDraft[]>(toDrafts(suit));
  const [fields, setFields] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function run<T>(label: string, call: () => Promise<{ ok: true; data: T } | { ok: false; message: string; fields: Record<string, string> }>, done: string) {
    setBusy(true);
    setFields({});
    setStatus(label);
    const r = await call();
    setBusy(false);
    if (!r.ok) {
      setFields(r.fields);
      setStatus(r.message);
      return;
    }
    setStatus(done);
    router.refresh();
  }

  function save(e: FormEvent) {
    e.preventDefault();
    const naira = Number(price.replace(/[,\s]/g, ""));
    if (!Number.isFinite(naira) || naira <= 0) {
      setFields({ price_kobo: "Enter the price in naira" });
      return;
    }
    void run(
      "Saving.",
      () =>
        adminCall("PATCH", `/suits/${suit.id}`, {
          title,
          description: description.trim() || null,
          price_kobo: Math.round(naira * 100),
          variants: draftsToInput(variants),
        }),
      "Saved.",
    );
  }

  const toggleStock = (id: string, inStock: boolean) =>
    run("Saving.", () => adminCall("PATCH", `/suits/${suit.id}`, { variant_updates: [{ id, in_stock: inStock }] }), "Saved.");

  const chooseCover = (img: { id: string; kind: string }) => {
    const ref = img.kind === "candidate" ? { candidate_image_id: img.id } : { original_image_id: img.id };
    void run("Choosing the photo.", () => adminCall("POST", `/suits/${suit.id}/select-image`, ref), "Photo chosen.");
  };

  const publish = () => run("Publishing. This can take a few seconds.", () => adminCall("POST", `/suits/${suit.id}/publish`, {}), "Published. It is on the site now.");
  const archive = () => run("Taking it down.", () => adminCall("POST", `/suits/${suit.id}/archive`, {}), "Taken down from the site.");

  const fieldError = (key: string) => fields[key] ?? Object.entries(fields).find(([k]) => k.startsWith(`${key}.`))?.[1];
  const choosable = suit.images.filter((i) => i.kind === "original" || i.kind === "candidate");
  const finalCover = suit.images.find((i) => i.kind === "final" && i.is_cover);

  return (
    <div className={styles.wide}>
      <p role="status" aria-live="polite" className={styles.ok}>{status}</p>
      {(fields.cover || fields.variants) && (
        <ul className={styles.error}>
          {fields.cover && <li>{fields.cover}</li>}
          {fields.variants && <li>{fields.variants}</li>}
        </ul>
      )}

      <div className={styles.actions}>
        {suit.status !== "published" && (
          <button type="button" className={styles.primary} onClick={publish} disabled={busy}>Publish</button>
        )}
        {suit.status === "published" && (
          <>
            <a href={`${siteUrl}/suits/${suit.slug}`} target="_blank" rel="noopener" className={styles.link}>See it on the site</a>
            <button type="button" className={styles.secondary} onClick={archive} disabled={busy}>Take off the site</button>
          </>
        )}
      </div>

      <AiPanel suitId={suit.id} hasOriginals={choosable.some((i) => i.kind === "original")} />

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Photo on the site</legend>
        {finalCover && (
          <p className={styles.hint}>The site shows the photo marked below. Choose another and publish again to change it.</p>
        )}
        <div className={styles.images}>
          {suit.images.filter((i) => i.kind === "final").map((img) => (
            <figure key={img.id} className={styles.thumb} data-cover={img.is_cover}>
              <img src={img.url} alt={img.alt_text ?? ""} />
              <figcaption className={styles.hint}>On the site now</figcaption>
            </figure>
          ))}
          {choosable.map((img) => (
            <figure key={img.id} className={styles.thumb} data-cover={img.is_cover}>
              <img src={img.url} alt={img.alt_text || (img.kind === "candidate" ? "AI draft" : "Uploaded photo")} />
              <figcaption className={styles.hint}>{img.kind === "candidate" ? "AI draft" : "Your photo"}</figcaption>
              {img.is_cover ? (
                <span className={styles.hint}>Chosen</span>
              ) : (
                <button type="button" className={styles.secondary} onClick={() => chooseCover(img)} disabled={busy}>Use this photo</button>
              )}
            </figure>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>In stock</legend>
        <ul className={styles.list}>
          {suit.variants.map((v) => (
            <li key={v.id}>
              <label className={styles.choice}>
                <input type="checkbox" checked={v.in_stock} disabled={busy} onChange={(e) => toggleStock(v.id, e.target.checked)} />
                {v.colour}, size {v.size}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <form onSubmit={save} className={styles.wide} noValidate>
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Details</legend>
          <div className={styles.field}>
            <label htmlFor="title" className={styles.label}>Title</label>
            <input id="title" className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} aria-invalid={Boolean(fields.title)} aria-describedby={fields.title ? "title-error" : undefined} />
            {fields.title && <p id="title-error" className={styles.error}>{fields.title}</p>}
          </div>
          <div className={styles.field}>
            <label htmlFor="description" className={styles.label}>Description (optional)</label>
            <textarea id="description" className={styles.textarea} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={600} />
          </div>
          <div className={styles.field}>
            <label htmlFor="price" className={styles.label}>Price in naira (now {formatNaira(suit.price_kobo)})</label>
            <input id="price" inputMode="numeric" className={styles.input} value={price} onChange={(e) => setPrice(e.target.value)} aria-invalid={Boolean(fields.price_kobo)} aria-describedby={fields.price_kobo ? "price-error" : undefined} />
            {fields.price_kobo && <p id="price-error" className={styles.error}>{fields.price_kobo}</p>}
          </div>
        </fieldset>
        <VariantsField rows={variants} onChange={setVariants} error={fieldError("variants")} />
        <div className={styles.actions}>
          <button type="submit" className={styles.secondary} disabled={busy}>Save changes</button>
        </div>
      </form>
    </div>
  );
}

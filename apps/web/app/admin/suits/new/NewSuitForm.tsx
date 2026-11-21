"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { IMAGE_TYPES, MAX_UPLOAD_BYTES, type AdminSuitDetail, type Batch, type UploadSignResponse } from "@ff/shared";
import { adminCall } from "@/lib/admin-client";
import { VariantsField, draftsToInput, type VariantDraft } from "../VariantsField";
import styles from "../../admin.module.css";

export function NewSuitForm({ batches }: { batches: Batch[] }) {
  const router = useRouter();
  const [batchId, setBatchId] = useState(batches[0]?.id ?? "new");
  const [batchLabel, setBatchLabel] = useState("");
  const [arrivedOn, setArrivedOn] = useState(new Date().toISOString().slice(0, 10));
  const [style, setStyle] = useState<"london" | "turkey">("london");
  const [title, setTitle] = useState("London style");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [variants, setVariants] = useState<VariantDraft[]>([{ colour: "", hex: "", sizes: "" }]);
  const [files, setFiles] = useState<File[]>([]);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const pickStyle = (s: "london" | "turkey") => {
    if (title === "London style" || title === "Turkey style" || !title) setTitle(s === "london" ? "London style" : "Turkey style");
    setStyle(s);
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFields({});
    const local: Record<string, string> = {};
    if (files.length === 0) local.images = "Add at least one photo";
    if (files.some((f) => !IMAGE_TYPES.includes(f.type as (typeof IMAGE_TYPES)[number]))) local.images = "Use JPEG, PNG or WebP photos";
    if (files.some((f) => f.size > MAX_UPLOAD_BYTES)) local.images = "Each photo must be 10 MB or less";
    const naira = Number(price.replace(/[,\s]/g, ""));
    if (!Number.isFinite(naira) || naira <= 0) local.price_kobo = "Enter the price in naira";
    if (Object.keys(local).length) {
      setFields(local);
      setStatus("Some fields need fixing.");
      return;
    }

    setBusy(true);
    try {
      setStatus("Preparing the upload.");
      const signed = await adminCall<UploadSignResponse>("POST", "/uploads/sign", {
        files: files.map((f) => ({ name: f.name.slice(0, 200), content_type: f.type, size: f.size })),
      });
      if (!signed.ok) {
        setFields(signed.fields);
        setStatus(signed.message);
        return;
      }

      for (const [i, u] of signed.data.uploads.entries()) {
        setStatus(`Uploading photo ${i + 1} of ${files.length}.`);
        const file = files[i]!;
        const put = await fetch(u.signed_url, { method: "PUT", headers: { "content-type": file.type, "x-upsert": "false" }, body: file }).catch(() => null);
        if (!put?.ok) {
          setStatus(`Photo ${i + 1} did not upload. Check your connection and try again.`);
          return;
        }
      }

      setStatus("Saving the suit.");
      const created = await adminCall<AdminSuitDetail>("POST", "/suits", {
        batch: batchId === "new" ? { label: batchLabel, arrived_on: arrivedOn } : { id: batchId },
        style,
        title,
        ...(description.trim() ? { description } : {}),
        price_kobo: Math.round(naira * 100),
        variants: draftsToInput(variants),
        images: signed.data.uploads.map((u) => ({ path: u.path })),
      });
      if (!created.ok) {
        setFields(created.fields);
        setStatus(created.message);
        return;
      }
      setStatus(`Saved as ${created.data.ref}.`);
      router.push(`/admin/suits/${created.data.id}`);
    } finally {
      setBusy(false);
    }
  }

  const fieldError = (key: string) => fields[key] ?? Object.entries(fields).find(([k]) => k.startsWith(`${key}.`))?.[1];

  return (
    <form onSubmit={submit} className={styles.wide} noValidate>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Batch</legend>
        <div className={styles.field}>
          <label htmlFor="batch" className={styles.label}>Which delivery is this from?</label>
          <select id="batch" className={styles.select} value={batchId} onChange={(e) => setBatchId(e.target.value)}>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>{b.label} ({b.arrived_on})</option>
            ))}
            <option value="new">A new batch</option>
          </select>
        </div>
        {batchId === "new" && (
          <div className={styles.inline}>
            <div className={styles.field}>
              <label htmlFor="batch-label" className={styles.label}>Batch name</label>
              <input id="batch-label" className={styles.input} value={batchLabel} onChange={(e) => setBatchLabel(e.target.value)} placeholder="December 2026, first batch" aria-invalid={Boolean(fieldError("batch"))} aria-describedby={fieldError("batch") ? "batch-error" : undefined} />
            </div>
            <div className={styles.field}>
              <label htmlFor="arrived" className={styles.label}>Arrived on</label>
              <input id="arrived" type="date" className={styles.input} value={arrivedOn} onChange={(e) => setArrivedOn(e.target.value)} />
            </div>
          </div>
        )}
        {fieldError("batch") && <p id="batch-error" className={styles.error}>{fieldError("batch")}</p>}
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Style</legend>
        <div className={styles.inline}>
          <label className={styles.choice}><input type="radio" name="style" checked={style === "london"} onChange={() => pickStyle("london")} /> London style</label>
          <label className={styles.choice}><input type="radio" name="style" checked={style === "turkey"} onChange={() => pickStyle("turkey")} /> Turkey style</label>
        </div>
      </fieldset>

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
        <label htmlFor="price" className={styles.label}>Price in naira</label>
        <input id="price" inputMode="numeric" className={styles.input} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="45000" aria-invalid={Boolean(fields.price_kobo)} aria-describedby={fields.price_kobo ? "price-error" : undefined} />
        {fields.price_kobo && <p id="price-error" className={styles.error}>{fields.price_kobo}</p>}
      </div>

      <VariantsField rows={variants} onChange={setVariants} error={fieldError("variants")} />

      <div className={styles.field}>
        <label htmlFor="photos" className={styles.label}>Photos of the suit (up to 8)</label>
        <input
          id="photos"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className={styles.input}
          onChange={(e) => setFiles([...(e.target.files ?? [])].slice(0, 8))}
          aria-invalid={Boolean(fieldError("images"))}
          aria-describedby={fieldError("images") ? "photos-error" : "photos-hint"}
        />
        {fieldError("images") ? (
          <p id="photos-error" className={styles.error}>{fieldError("images")}</p>
        ) : (
          <p id="photos-hint" className={styles.hint}>{files.length ? `${files.length} photo${files.length > 1 ? "s" : ""} chosen.` : "Flat photos on a plain background work best."}</p>
        )}
      </div>

      <p role="status" aria-live="polite" className={styles.ok}>{status}</p>

      <div className={styles.actions}>
        <button type="submit" className={styles.primary} disabled={busy}>{busy ? "Saving" : "Save as draft"}</button>
      </div>
    </form>
  );
}

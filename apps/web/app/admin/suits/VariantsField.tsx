"use client";

import type { VariantInput } from "@ff/shared";
import styles from "../admin.module.css";

export type VariantDraft = { colour: string; hex: string; sizes: string };

export function draftsToInput(rows: VariantDraft[]): VariantInput[] {
  return rows
    .filter((r) => r.colour.trim() || r.sizes.trim())
    .map((r) => ({
      colour: r.colour.trim(),
      ...(r.hex.trim() ? { colour_hex: r.hex.trim() } : {}),
      sizes: r.sizes.split(",").map((s) => s.trim()).filter(Boolean),
    }));
}

export function VariantsField({
  rows,
  onChange,
  error,
}: {
  rows: VariantDraft[];
  onChange: (rows: VariantDraft[]) => void;
  error?: string;
}) {
  const set = (i: number, patch: Partial<VariantDraft>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <fieldset className={styles.fieldset} aria-describedby={error ? "variants-error" : "variants-hint"}>
      <legend className={styles.legend}>Colours and sizes</legend>
      <p id="variants-hint" className={styles.hint}>One row per colour. Type sizes with commas, for example 10, 12, 14.</p>
      {rows.map((r, i) => (
        <div key={i} className={styles.inline}>
          <div className={styles.field}>
            <label htmlFor={`colour-${i}`} className={styles.label}>Colour</label>
            <input id={`colour-${i}`} className={styles.input} value={r.colour} onChange={(e) => set(i, { colour: e.target.value })} maxLength={30} />
          </div>
          <div className={styles.field}>
            <label htmlFor={`hex-${i}`} className={styles.label}>Swatch (optional)</label>
            <input id={`hex-${i}`} type="color" className={styles.input} value={r.hex || "#000000"} onChange={(e) => set(i, { hex: e.target.value })} />
          </div>
          <div className={styles.field}>
            <label htmlFor={`sizes-${i}`} className={styles.label}>Sizes</label>
            <input id={`sizes-${i}`} className={styles.input} value={r.sizes} onChange={(e) => set(i, { sizes: e.target.value })} placeholder="10, 12, 14" />
          </div>
          {rows.length > 1 && (
            <button type="button" className={styles.secondary} onClick={() => onChange(rows.filter((_, j) => j !== i))}>
              Remove
            </button>
          )}
        </div>
      ))}
      {error && <p id="variants-error" className={styles.error}>{error}</p>}
      <button type="button" className={styles.secondary} onClick={() => onChange([...rows, { colour: "", hex: "", sizes: "" }])}>
        Add a colour
      </button>
    </fieldset>
  );
}

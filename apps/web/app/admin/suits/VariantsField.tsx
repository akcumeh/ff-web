"use client";

import type { VariantInput } from "@ff/shared";
import styles from "../admin.module.css";

export const STANDARD_SIZES = Array.from({ length: 12 }, (_, i) => String(38 + i * 2));

export type VariantDraft = { colour: string; hex: string; sizes: string[] };

export const emptyDraft = (sizes: string[] = []): VariantDraft => ({ colour: "", hex: "", sizes });

function sortSizes(sizes: string[]) {
    return [...sizes].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export function draftsToInput(rows: VariantDraft[]): VariantInput[] {
    return rows
        .filter((r) => r.sizes.length > 0)
        .map((r) => ({
            ...(r.colour.trim() ? { colour: r.colour.trim() } : {}),
            ...(r.hex ? { colour_hex: r.hex } : {}),
            sizes: sortSizes(r.sizes),
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
    const toggle = (i: number, size: string, on: boolean) => {
        const current = rows[i]!.sizes;
        set(i, { sizes: on ? sortSizes([...new Set([...current, size])]) : current.filter((s) => s !== size) });
    };

    return (
        <fieldset className={styles.fieldset} aria-describedby={error ? "variants-error" : "variants-hint"}>
            <legend className={styles.legend}>Colours and sizes</legend>
            <p id="variants-hint" className={styles.hint}>One row per colour. Tick the sizes in stock. The colour name is optional.</p>
            {rows.map((r, i) => {
                const options = sortSizes([...new Set([...STANDARD_SIZES, ...r.sizes])]);
                return (
                    <div key={i} className={styles.variantRow}>
                        <div className={styles.inline}>
                            <div className={styles.field}>
                                <label htmlFor={`colour-${i}`} className={styles.label}>Colour name (optional)</label>
                                <input id={`colour-${i}`} className={styles.input} value={r.colour} onChange={(e) => set(i, { colour: e.target.value })} maxLength={30} placeholder="Wine" />
                            </div>
                            <div className={styles.field}>
                                <label htmlFor={`hex-${i}`} className={styles.label}>Swatch</label>
                                <input id={`hex-${i}`} type="color" className={styles.input} value={r.hex || "#7a7a7a"} onChange={(e) => set(i, { hex: e.target.value })} />
                            </div>
                        </div>
                        <div role="group" aria-label={`Sizes for colour ${i + 1}`} className={styles.sizeGrid}>
                            {options.map((size) => (
                                <label key={size} className={styles.sizeChoice}>
                                    <input type="checkbox" checked={r.sizes.includes(size)} onChange={(e) => toggle(i, size, e.target.checked)} />
                                    {size}
                                </label>
                            ))}
                        </div>
                        <div className={styles.actions}>
                            <button type="button" className={styles.secondary} onClick={() => set(i, { sizes: STANDARD_SIZES.filter((s) => +s >= 40 && +s <= 56) })}>
                                Sizes 40 to 56
                            </button>
                            {rows.length > 1 && (
                                <button type="button" className={styles.secondary} onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                                    Remove colour
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}
            {error && <p id="variants-error" className={styles.error}>{error}</p>}
            <button type="button" className={styles.secondary} onClick={() => onChange([...rows, emptyDraft(rows.at(-1)?.sizes ?? [])])}>
                Add a colour (same sizes)
            </button>
        </fieldset>
    );
}

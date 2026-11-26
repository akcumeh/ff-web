"use client";

import { EMPTY_ANATOMY, type SuitAnatomy } from "@ff/shared";
import styles from "../admin.module.css";

const SKIRT = [
    { value: "knee", label: "At the knee" },
    { value: "3/4", label: "Mid-calf (3/4)" },
    { value: "full", label: "Ankle length (full)" },
];
const GOWN = [
    { value: "3/4", label: "Mid-calf (3/4)" },
    { value: "full", label: "Ankle length (full)" },
];
const SLEEVE = [
    { value: "3/4", label: "Three-quarter (3/4)" },
    { value: "full", label: "Long, to the wrist (full)" },
];

export function anatomyForSave(a: SuitAnatomy): SuitAnatomy {
    if (a.type === "skirt-suit") return { ...a, gown_length: null, has_belt: null, has_no_jacket: null };
    if (a.type === "gown-suit") return { ...a, skirt_length: null, has_camisole: null };
    return a;
}

function Choice({ id, label, value, options, onChange }: { id: string; label: string; value: string | null; options: { value: string; label: string }[]; onChange: (v: string | null) => void }) {
    return (
        <div className={styles.field}>
            <label htmlFor={id} className={styles.label}>{label}</label>
            <select id={id} className={styles.select} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
                <option value="">Let the AI decide</option>
                {options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                ))}
            </select>
        </div>
    );
}

function Tick({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean | null) => void }) {
    return (
        <label className={styles.choice}>
            <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked ? true : null)} />
            {label}
        </label>
    );
}

export function AnatomyField({ value = EMPTY_ANATOMY, onChange }: { value?: SuitAnatomy; onChange: (a: SuitAnatomy) => void }) {
    const set = <K extends keyof SuitAnatomy>(k: K, v: SuitAnatomy[K]) => onChange({ ...value, [k]: v });
    return (
        <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Suit details (optional)</legend>
            <p className={styles.hint}>These show on the suit page and help the AI draw the suit correctly.</p>
            <Choice
                id="suit-type"
                label="Type"
                value={value.type}
                options={[{ value: "skirt-suit", label: "Skirt suit" }, { value: "gown-suit", label: "Gown suit" }]}
                onChange={(v) => set("type", v as SuitAnatomy["type"])}
            />
            {value.type !== "gown-suit" && (
                <Choice id="skirt-length" label="Skirt length" value={value.skirt_length} options={SKIRT} onChange={(v) => set("skirt_length", v as SuitAnatomy["skirt_length"])} />
            )}
            {value.type !== "skirt-suit" && (
                <Choice id="gown-length" label="Gown length" value={value.gown_length} options={GOWN} onChange={(v) => set("gown_length", v as SuitAnatomy["gown_length"])} />
            )}
            <Choice id="sleeve-length" label="Sleeves" value={value.sleeve_length} options={SLEEVE} onChange={(v) => set("sleeve_length", v as SuitAnatomy["sleeve_length"])} />
            {value.type === "skirt-suit" && <Tick label="Comes with a camisole (3 pieces)" checked={value.has_camisole === true} onChange={(v) => set("has_camisole", v)} />}
            {value.type === "gown-suit" && (
                <>
                    <Tick label="Has a belt" checked={value.has_belt === true} onChange={(v) => set("has_belt", v)} />
                    <Tick label="Gown only, no jacket" checked={value.has_no_jacket === true} onChange={(v) => set("has_no_jacket", v)} />
                </>
            )}
        </fieldset>
    );
}

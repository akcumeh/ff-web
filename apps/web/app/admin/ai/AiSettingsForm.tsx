"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { AiSettings } from "@ff/shared";
import { adminCall } from "@/lib/admin-client";
import styles from "../admin.module.css";

type Prompt = { name: string; version: number; body: string };

const LABELS: Record<string, { title: string; hint: string }> = {
  observe: { title: "Instructions for reading the photo", hint: "Tells the AI what to look for in your flat photo." },
  direct: { title: "Instructions for drawing the model photo", hint: "Keep {{style_note}}, {{observation}} and {{extra}}. The AI fills them in each time." },
  tryon: { title: "Changing room instructions", hint: "Used later, in the changing room." },
};

export function AiSettingsForm({ settings, prompts }: { settings: AiSettings; prompts: Prompt[] }) {
  const router = useRouter();
  const [bodies, setBodies] = useState<Record<string, string>>(Object.fromEntries(prompts.map((p) => [p.name, p.body])));
  const [london, setLondon] = useState(settings.style_notes.london);
  const [turkey, setTurkey] = useState(settings.style_notes.turkey);
  const [capDollars, setCapDollars] = useState(String(settings.ai_monthly_cap_usd_micro / 1e6));
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(label: string, call: () => ReturnType<typeof adminCall>) {
    setBusy(true);
    setMessage(`Saving ${label}.`);
    const res = await call();
    setBusy(false);
    setMessage(res.ok ? `Saved ${label}.` : res.message);
    if (res.ok) router.refresh();
  }

  const savePrompt = (name: string) => (e: FormEvent) => {
    e.preventDefault();
    void save(LABELS[name]?.title.toLowerCase() ?? name, () => adminCall("PATCH", `/prompts/${name}`, { body: bodies[name] }));
  };

  const saveNotes = (e: FormEvent) => {
    e.preventDefault();
    void save("style notes", () => adminCall("PATCH", "/settings", { style_notes: { london, turkey } }));
  };

  const saveBudget = (e: FormEvent) => {
    e.preventDefault();
    const dollars = Number(capDollars);
    if (!Number.isFinite(dollars) || dollars < 0) {
      setMessage("Enter the cap in dollars, for example 9.");
      return;
    }
    void save("budget", () => adminCall("PATCH", "/settings", { ai_monthly_cap_usd_micro: Math.round(dollars * 1e6) }));
  };

  const toggleKill = () =>
    save("the switch", () => adminCall("PATCH", "/settings", { ai_kill_switch: !settings.ai_kill_switch }));

  const spent = settings.month_spend_usd_micro / 1e6;
  const cap = settings.ai_monthly_cap_usd_micro / 1e6;
  const pct = cap > 0 ? Math.min(100, Math.round((spent / cap) * 100)) : 100;

  return (
    <div className={styles.wide}>
      <p role="status" aria-live="polite" className={styles.ok}>{message}</p>

      <section className={styles.fieldset} aria-labelledby="budget-title">
        <h2 id="budget-title" className={styles.legend}>This month</h2>
        <p className={styles.lead}>${spent.toFixed(2)} of ${cap.toFixed(2)} used ({pct}%).</p>
        <progress max={100} value={pct} aria-label="AI budget used" style={{ width: "100%" }} />
        <form onSubmit={saveBudget} className={styles.inline} noValidate>
          <div className={styles.field}>
            <label htmlFor="cap" className={styles.label}>Monthly cap in US dollars</label>
            <input id="cap" inputMode="decimal" className={styles.input} value={capDollars} onChange={(e) => setCapDollars(e.target.value)} />
          </div>
          <button type="submit" className={styles.secondary} disabled={busy}>Save cap</button>
        </form>
        <div className={styles.actions}>
          <button type="button" className={settings.ai_kill_switch ? styles.primary : styles.secondary} onClick={toggleKill} disabled={busy}>
            {settings.ai_kill_switch ? "Turn AI photos back on" : "Turn AI photos off"}
          </button>
          <span className={styles.hint}>AI photos are {settings.ai_kill_switch ? "off" : "on"}.</span>
        </div>
      </section>

      <form onSubmit={saveNotes} className={styles.fieldset} noValidate>
        <h2 className={styles.legend}>Style notes</h2>
        <p className={styles.hint}>One sentence each. It goes into every drawing of that style.</p>
        <div className={styles.field}>
          <label htmlFor="note-london" className={styles.label}>London style</label>
          <textarea id="note-london" className={styles.textarea} maxLength={300} value={london} onChange={(e) => setLondon(e.target.value)} />
        </div>
        <div className={styles.field}>
          <label htmlFor="note-turkey" className={styles.label}>Turkey style</label>
          <textarea id="note-turkey" className={styles.textarea} maxLength={300} value={turkey} onChange={(e) => setTurkey(e.target.value)} />
        </div>
        <div className={styles.actions}>
          <button type="submit" className={styles.secondary} disabled={busy}>Save style notes</button>
        </div>
      </form>

      {prompts
        .filter((p) => p.name !== "tryon")
        .map((p) => (
          <form key={p.name} onSubmit={savePrompt(p.name)} className={styles.fieldset} noValidate>
            <h2 className={styles.legend}>{LABELS[p.name]?.title ?? p.name}</h2>
            <p className={styles.hint}>{LABELS[p.name]?.hint} Version {p.version}.</p>
            <label htmlFor={`prompt-${p.name}`} className={styles.label}>Instructions</label>
            <textarea
              id={`prompt-${p.name}`}
              className={styles.textarea}
              style={{ minHeight: 180 }}
              maxLength={4000}
              value={bodies[p.name] ?? ""}
              onChange={(e) => setBodies({ ...bodies, [p.name]: e.target.value })}
            />
            {(bodies[p.name] ?? "").includes("OWNER_TO_FILL") && (
              <p className={styles.error}>Replace OWNER_TO_FILL with your own words. AI photos stay off until you do.</p>
            )}
            <div className={styles.actions}>
              <button type="submit" className={styles.secondary} disabled={busy}>Save as a new version</button>
            </div>
          </form>
        ))}
    </div>
  );
}

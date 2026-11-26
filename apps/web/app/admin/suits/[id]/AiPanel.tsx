"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { GenerationView } from "@ff/shared";
import { adminCall } from "@/lib/admin-client";
import styles from "../../admin.module.css";

const POLL_MS = 3000;
const GIVE_UP_MS = 5 * 60_000;

const ERROR_TEXT: Record<string, string> = {
  failed_safety: "Gemini would not draw this photo. Try another photo, or add a note and start again.",
  not_a_garment: "The photo does not look like a suit. Try another photo.",
  timeout: "The AI run took too long and was stopped. Try again.",
  no_image: "The AI did not send back a picture. Try again.",
  no_api_key: "AI photos are not working right now. You can still publish with your own photo.",
};

const PROBLEM_TEXT: Record<string, string> = {
  blur: "The photo looks blurry.",
  cropped: "Part of the suit is cut off in the photo.",
  dark: "The photo is dark.",
  folded: "The suit looks folded or creased.",
};

export function AiPanel({ suitId, hasOriginals }: { suitId: string; hasOriginals: boolean }) {
  const router = useRouter();
  const [extra, setExtra] = useState("");
  const [message, setMessage] = useState("");
  const [running, setRunning] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function poll(id: string, startedAt: number) {
    const res = await adminCall<GenerationView>("GET", `/generations/${id}`);
    if (!res.ok) {
      setRunning(false);
      setMessage(res.message);
      return;
    }
    const v = res.data;
    if (v.status === "queued" || v.status === "running") {
      if (Date.now() - startedAt > GIVE_UP_MS) {
        setRunning(false);
        setMessage("This is taking longer than usual. Reload the page in a minute to see if the photos arrived.");
        return;
      }
      const seconds = Math.round((Date.now() - startedAt) / 1000);
      setMessage(`Making AI photos. ${seconds} seconds so far. You can keep this page open.`);
      timer.current = setTimeout(() => void poll(id, startedAt), POLL_MS);
      return;
    }
    setRunning(false);
    setProblems(v.problems);
    if (v.status === "succeeded") {
      setMessage(`${v.candidates.length} AI photo${v.candidates.length === 1 ? "" : "s"} ready. Compare them with your photo below and pick one, or try again.`);
      router.refresh();
      return;
    }
    const key = v.status === "failed_safety" ? "failed_safety" : v.error ?? "";
    setMessage(ERROR_TEXT[key] ?? "The AI run did not work. Try again, or publish with your own photo.");
  }

  async function start() {
    setRunning(true);
    setProblems([]);
    setMessage("Starting.");
    const res = await adminCall<{ generation_id: string }>("POST", `/suits/${suitId}/generate`, {
      candidates: 2,
      ...(extra.trim() ? { extra_instructions: extra.trim() } : {}),
    });
    if (!res.ok) {
      setRunning(false);
      setMessage(res.message);
      return;
    }
    void poll(res.data.generation_id, Date.now());
  }

  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>AI photos</legend>
      <p className={styles.hint}>Draws the suit on a model from your photo. You always choose before anything goes on the site.</p>
      <div className={styles.field}>
        <label htmlFor="ai-extra" className={styles.label}>Extra note for this run (optional)</label>
        <textarea id="ai-extra" className={styles.textarea} maxLength={500} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="For example: show the back of the jacket" />
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={start} disabled={running || !hasOriginals}>
          {running ? "Working" : "Make AI photos"}
        </button>
      </div>
      <p role="status" aria-live="polite" className={styles.ok}>{message}</p>
      {problems.length > 0 && (
        <ul className={styles.hint}>
          {problems.map((p) => (
            <li key={p}>{PROBLEM_TEXT[p] ?? p}</li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { adminCall } from "@/lib/admin-client";
import styles from "../admin.module.css";

export function SnapshotForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [message, setMessage] = useState("");

  async function save(e: FormEvent) {
    e.preventDefault();
    const followers = Number(value);
    if (!Number.isInteger(followers) || followers < 0) {
      setMessage("Type the follower count as a whole number.");
      return;
    }
    const res = await adminCall("POST", "/snapshots", { platform: "whatsapp", taken_on: new Date().toISOString().slice(0, 10), followers });
    setMessage(res.ok ? "Saved." : res.message);
    if (res.ok) router.refresh();
  }

  return (
    <form onSubmit={save} className={styles.inline} noValidate>
      <div className={styles.field}>
        <label htmlFor="wa-count" className={styles.label}>WhatsApp channel followers today</label>
        <input id="wa-count" inputMode="numeric" className={styles.input} value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
      <button type="submit" className={styles.secondary}>Save count</button>
      <p role="status" aria-live="polite" className={styles.ok}>{message}</p>
    </form>
  );
}

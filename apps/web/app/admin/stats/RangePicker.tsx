"use client";

import { useRouter } from "next/navigation";
import styles from "../admin.module.css";

const RANGES = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "12w", label: "Last 3 months" },
  { key: "12m", label: "Last 12 months" },
] as const;

export function RangePicker({ range }: { range: string }) {
  const router = useRouter();
  return (
    <form method="get" className={styles.rangeForm}>
      <label htmlFor="range" className={styles.label}>Show</label>
      <select
        id="range"
        name="range"
        className={styles.select}
        defaultValue={range}
        onChange={(e) => router.push(`/admin/stats?range=${e.target.value}`)}
      >
        {RANGES.map((r) => (
          <option key={r.key} value={r.key}>{r.label}</option>
        ))}
      </select>
      <noscript><button type="submit" className={styles.secondary}>Show</button></noscript>
    </form>
  );
}

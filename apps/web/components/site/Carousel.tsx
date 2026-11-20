"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import styles from "./suits.module.css";

export function Carousel({ label, children }: { label: string; children: ReactNode }) {
  const track = useRef<HTMLUListElement>(null);

  const step = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const item = el.querySelector("li");
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    const width = item ? item.getBoundingClientRect().width + gap : el.clientWidth;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * width, behavior: reduce ? "auto" : "smooth" });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      step(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      step(-1);
    }
  };

  return (
    <div>
      <div className={styles.arrows}>
        <button type="button" className={styles.arrow} onClick={() => step(-1)} aria-label="Previous designs">&larr;</button>
        <button type="button" className={styles.arrow} onClick={() => step(1)} aria-label="Next designs">&rarr;</button>
      </div>
      <ul ref={track} className={styles.track} tabIndex={0} aria-label={label} onKeyDown={onKeyDown}>
        {children}
      </ul>
    </div>
  );
}

import { contactLink } from "@/lib/contact";
import { PHONES } from "@/lib/public-env";
import styles from "./pages.module.css";

export function CallUs({ className }: { className?: string }) {
  return (
    <details className={styles.call}>
      <summary className={className ?? styles.secondary}>Call us</summary>
      <ul className={styles.callList}>
        {PHONES.map((p) => (
          <li key={p.tel}>
            <a href={`tel:${p.tel}`}>
              <span>{p.tel}</span>
              <span className={styles.callWhere}>{p.where}</span>
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function ContactButtons({ message = "Hello Frankie Suits, I would like to ask about your suits." }: { message?: string }) {
  const wa = contactLink(message, "Chat on WhatsApp");
  return (
    <div className={styles.actions}>
      {wa.external && (
        <a href={wa.href} className={styles.primary} target="_blank" rel="noopener">
          {wa.label}
        </a>
      )}
      <CallUs />
    </div>
  );
}

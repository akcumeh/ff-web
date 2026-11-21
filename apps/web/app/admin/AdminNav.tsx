import Link from "next/link";
import styles from "./admin.module.css";

export function AdminNav() {
  return (
    <nav aria-label="Admin">
      <ul className={styles.nav}>
        <li><Link href="/admin">Admin home</Link></li>
        <li><Link href="/admin/suits">Suits</Link></li>
        <li><Link href="/admin/suits/new">New suit</Link></li>
        <li><Link href="/admin/ai">AI instructions</Link></li>
        <li><Link href="/admin/settings">Settings</Link></li>
        <li><Link href="/" target="_blank">View site</Link></li>
      </ul>
    </nav>
  );
}

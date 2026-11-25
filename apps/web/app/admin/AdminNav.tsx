import Link from "next/link";
import { z } from "zod";
import { adminGet } from "@/lib/admin-api";
import styles from "./admin.module.css";

const Pending = z.object({ items: z.array(z.object({ id: z.string() }).loose()) });

export async function AdminNav() {
  const pending = await adminGet("/packs/pending", Pending);
  const count = pending.kind === "ok" ? pending.data.items.length : 0;
  return (
    <header className={styles.topBar}>
      <Link href="/admin" className={styles.wordmark}>Frankie Suits</Link>
      <details className={styles.menu}>
        <summary className={styles.menuButton}>
          Menu{count > 0 && <span className={styles.navCount} aria-label={`${count} to post`}>{count}</span>}
        </summary>
        <nav aria-label="Admin">
          <ul className={styles.menuList}>
            <li><Link href="/admin">Home</Link></li>
            <li><Link href="/admin/suits/new">Add a suit</Link></li>
            <li><Link href="/admin/suits">All suits</Link></li>
            <li>
              <Link href="/admin/posts">
                Post on WhatsApp{count > 0 && <span className={styles.navCount}>{count}</span>}
              </Link>
            </li>
            <li><Link href="/admin/orders">Orders</Link></li>
            <li><Link href="/admin/stats">Stats</Link></li>
            <li><Link href="/admin/settings">My account</Link></li>
            <li><Link href="/" target="_blank">Open the website</Link></li>
          </ul>
        </nav>
      </details>
    </header>
  );
}

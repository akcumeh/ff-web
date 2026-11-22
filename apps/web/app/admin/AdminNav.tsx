import Link from "next/link";
import { z } from "zod";
import { adminGet } from "@/lib/admin-api";
import styles from "./admin.module.css";

const Pending = z.object({ items: z.array(z.object({ id: z.string() }).loose()) });

export async function AdminNav() {
  const pending = await adminGet("/packs/pending", Pending);
  const count = pending.kind === "ok" ? pending.data.items.length : 0;
  return (
    <nav aria-label="Admin">
      <ul className={styles.nav}>
        <li><Link href="/admin">Admin home</Link></li>
        <li><Link href="/admin/suits">Suits</Link></li>
        <li><Link href="/admin/suits/new">New suit</Link></li>
        <li>
          <Link href="/admin/posts">
            To post{count > 0 && <span className={styles.navCount} aria-label={`${count} waiting`}>{count}</span>}
          </Link>
        </li>
        <li><Link href="/admin/ai">AI instructions</Link></li>
        <li><Link href="/admin/settings">Settings</Link></li>
        <li><Link href="/" target="_blank">View site</Link></li>
      </ul>
    </nav>
  );
}

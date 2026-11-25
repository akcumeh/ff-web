import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminSuitList, formatNaira } from "@ff/shared";
import { adminGet } from "@/lib/admin-api";
import { AdminNav } from "../AdminNav";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";

const STATUS_LABEL = { draft: "Draft", review: "Review", published: "On the site", archived: "Taken down" } as const;

export default async function AdminSuitsPage() {
  const result = await adminGet("/suits", AdminSuitList);
  if (result.kind === "error" && result.status === 401) redirect("/admin/login");

  return (
    <main id="main" className={styles.page}>
      <AdminNav />
      <h1 className={styles.title}>Suits</h1>

      {result.kind === "offline" && <p className={styles.lead}>The API is not answering. Reload in a moment.</p>}
      {result.kind === "error" && <p className={styles.lead}>{result.message}</p>}
      {result.kind === "ok" && result.data.items.length === 0 && (
        <p className={styles.lead}>
          No suits yet. <Link href="/admin/suits/new" className={styles.link}>Add the first one</Link>.
        </p>
      )}
      {result.kind === "ok" && result.data.items.length > 0 && (
        <ul className={styles.list}>
          {result.data.items.map((s) => (
            <li key={s.id}>
              <Link href={`/admin/suits/${s.id}`} className={styles.row}>
                <span>{s.ref}</span>
                <span>
                  {s.title} <span className={styles.hint}>{formatNaira(s.price_kobo)}{s.batch_label ? `, ${s.batch_label}` : ""}</span>
                </span>
                <span className={styles.status}>{STATUS_LABEL[s.status]}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { fetchMe } from "@/lib/admin-api";
import { TotpSetup } from "./TotpSetup";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const result = await fetchMe();
  if (result.kind !== "ok") redirect("/admin");

  return (
    <main id="main" className={styles.page}>
      <p className={styles.wordmark}>Frankie Suits</p>
      <h1 className={styles.title}>Settings</h1>
      <h2 className={styles.label}>Authenticator app</h2>
      <TotpSetup enabled={result.me.mfaEnabled} />
      <hr className={styles.rule} />
      <Link href="/admin" className={styles.link}>Back to admin</Link>
    </main>
  );
}

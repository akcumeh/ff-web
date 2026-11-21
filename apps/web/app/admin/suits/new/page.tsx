import { redirect } from "next/navigation";
import { BatchList } from "@ff/shared";
import { adminGet } from "@/lib/admin-api";
import { AdminNav } from "../../AdminNav";
import { NewSuitForm } from "./NewSuitForm";
import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

export default async function NewSuitPage() {
  const batches = await adminGet("/batches", BatchList);
  if (batches.kind === "error" && batches.status === 401) redirect("/admin/login");

  return (
    <main id="main" className={styles.page}>
      <p className={styles.wordmark}>Frankie Suits</p>
      <AdminNav />
      <h1 className={styles.title}>New suit</h1>
      <p className={styles.lead}>It is saved as a draft. Nothing shows on the site until you publish it.</p>
      {batches.kind === "ok" ? (
        <NewSuitForm batches={batches.data.items} />
      ) : (
        <p className={styles.error}>{batches.kind === "offline" ? "The API is not answering. Reload in a moment." : batches.message}</p>
      )}
    </main>
  );
}

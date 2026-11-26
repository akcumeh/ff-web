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
      <AdminNav />
      <h1 className={styles.title}>New suit</h1>
      <p className={styles.lead}>It is saved as a draft. Nothing shows on the site until you publish it.</p>
      {batches.kind === "ok" ? (
        <NewSuitForm batches={batches.data.items} />
      ) : (
        <p className={styles.error}>{batches.kind === "offline" ? "The site is having a problem right now. Please wait a few minutes and refresh the page." : batches.message}</p>
      )}
    </main>
  );
}

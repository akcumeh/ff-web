import { redirect } from "next/navigation";
import { fetchMe } from "@/lib/admin-api";
import { AdminNav } from "../AdminNav";
import { TotpSetup } from "./TotpSetup";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
    const result = await fetchMe();
    if (result.kind !== "ok") redirect("/admin");

    return (
        <main id="main" className={styles.page}>
            <AdminNav />
            <h1 className={styles.title}>My account</h1>
            <h2 className={styles.legend}>Extra login check (optional)</h2>
            <TotpSetup enabled={result.me.mfaEnabled} />
        </main>
    );
}

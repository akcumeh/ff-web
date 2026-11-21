import { redirect } from "next/navigation";
import { AiSettings, PromptList } from "@ff/shared";
import { adminGet } from "@/lib/admin-api";
import { AdminNav } from "../AdminNav";
import { AiSettingsForm } from "./AiSettingsForm";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";

export default async function AdminAiPage() {
  const [settings, prompts] = await Promise.all([adminGet("/settings", AiSettings), adminGet("/prompts", PromptList)]);
  if ((settings.kind === "error" && settings.status === 401) || (prompts.kind === "error" && prompts.status === 401)) redirect("/admin/login");

  return (
    <main id="main" className={styles.page}>
      <p className={styles.wordmark}>Frankie Suits</p>
      <AdminNav />
      <h1 className={styles.title}>AI instructions</h1>
      {settings.kind === "ok" && prompts.kind === "ok" ? (
        <AiSettingsForm settings={settings.data} prompts={prompts.data.items} />
      ) : (
        <p className={styles.error}>The API is not answering. Reload in a moment.</p>
      )}
    </main>
  );
}

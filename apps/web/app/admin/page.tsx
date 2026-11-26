import Link from "next/link";
import { redirect } from "next/navigation";
import { fetchMe } from "@/lib/admin-api";
import { signOut } from "./login/actions";
import { AdminNav } from "./AdminNav";
import styles from "./admin.module.css";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
    const result = await fetchMe();

    if (result.kind === "error" && result.code === "unauthenticated") redirect("/admin/login");
    if (result.kind === "error" && result.code === "mfa_required") redirect("/admin/login/code");

    return (
        <main id="main" className={styles.page}>

            {result.kind === "ok" && (
                <>
                    <AdminNav />
                    <h1 className={styles.title}>Admin</h1>
                    <p className={styles.lead}>Signed in as {result.me.email}.</p>
                    <p className={styles.hint}>Authenticator app: {result.me.mfaEnabled ? "on" : "off"}.</p>
                    <p className={styles.lead}>
                        <Link href="/admin/suits/new" className={styles.link}>Add a new suit</Link> or{" "}
                        <Link href="/admin/suits" className={styles.link}>see all suits</Link>.
                    </p>
                </>
            )}

            {result.kind === "error" && result.code === "not_admin" && (
                <>
                    <h1 className={styles.title}>Not on the owner list</h1>
                    <p className={styles.lead}>This account can sign in, but it is not an owner. Ask an owner to add you.</p>
                </>
            )}

            {result.kind === "error" && result.code !== "not_admin" && (
                <>
                    <h1 className={styles.title}>Something went wrong</h1>
                    <p className={styles.lead}>{result.message}</p>
                </>
            )}

            {result.kind === "offline" && (
                <>
                    <h1 className={styles.title}>Something went wrong</h1>
                    <p className={styles.lead}>The site is having a problem right now. Please wait a few minutes and refresh the page.</p>
                </>
            )}

            <hr className={styles.rule} />
            <form action={signOut}>
                <button type="submit" className={styles.secondary}>Sign out</button>
            </form>
        </main>
    );
}

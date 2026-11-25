import Link from "next/link";
import { SiteShell } from "@/components/site/SiteShell";
import site from "@/components/site/site.module.css";
import styles from "@/components/site/pages.module.css";

export default async function NotFound() {
  return (
    <SiteShell theme="light">
      <div className={`${site.container} ${styles.section}`}>
        <h1 className={styles.h1}>Page not found</h1>
        <p className={styles.body}>We could not find this page. The suit may no longer be in store.</p>
        <Link href="/gallery" className={styles.textLink}>See our suits</Link>
      </div>
    </SiteShell>
  );
}

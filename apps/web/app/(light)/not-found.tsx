import Link from "next/link";
import site from "@/components/site/site.module.css";
import styles from "@/components/site/pages.module.css";

export default function LightNotFound() {
    return (
        <div className={`${site.container} ${styles.section}`}>
            <h1 className={styles.h1}>Page not found</h1>
            <p className={styles.body}>This page is not on the site. The design may have been taken down.</p>
            <Link href="/gallery" className={styles.textLink}>See the gallery</Link>
        </div>
    );
}

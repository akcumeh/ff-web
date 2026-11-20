import Link from "next/link";
import type { ReactNode } from "react";
import { NavLinks } from "./NavLinks";
import styles from "./site.module.css";

export function SiteShell({ theme, children }: { theme: "light" | "dark"; children: ReactNode }) {
  return (
    <div data-theme={theme} className={styles.themeRoot}>
      <header className={styles.header}>
        <div className={`${styles.container} ${styles.headerInner}`}>
          <Link href="/" className={styles.wordmark}>Frankie Suits</Link>
          <nav aria-label="Main" className={styles.nav}>
            <NavLinks />
          </nav>
        </div>
      </header>

      <main id="main" className={styles.main}>{children}</main>

      <footer className={styles.footer}>
        <div className={`${styles.container} ${styles.footerInner}`}>
          <div>
            <p className={styles.footerLabel}>Head office</p>
            <p className={styles.footerText}>43 Martins Street (Brasas Plaza), Lagos Island</p>
            <p className={styles.footerText}><a href="tel:07081156800">07081156800</a></p>
          </div>
          <div>
            <p className={styles.footerLabel}>Branch office</p>
            <p className={styles.footerText}>No 35/37 Martins Street (Faith Plaza), Lagos Island</p>
            <p className={styles.footerText}>
              <a href="tel:07069743721">07069743721</a>, <a href="tel:08098269558">08098269558</a>
            </p>
          </div>
          <div>
            <p className={styles.footerLabel}>Email</p>
            <p className={styles.footerText}><a href="mailto:frankiefabrics@yahoo.com">frankiefabrics@yahoo.com</a></p>
          </div>
          <div>
            <p className={styles.footerLabel}>Information</p>
            <p className={styles.footerText}><Link href="/wholesale">Wholesale</Link></p>
            <p className={styles.footerText}><Link href="/delivery-and-refunds">Delivery and refunds</Link></p>
            <p className={styles.footerText}><Link href="/privacy">Privacy</Link></p>
          </div>
        </div>
        <div className={`${styles.container} ${styles.footerBottom}`}>Frankie Suits Ent. Since 2012.</div>
      </footer>
    </div>
  );
}

import styles from "./page.module.css";

// Placeholder home page so step 0 has something to deploy. Step 2 replaces it.
export default function HomePage() {
  return (
    <main id="main" className={styles.main}>
      <p className={styles.wordmark}>Frankie Suits</p>
      <h1 className={styles.headline}>Ladies&rsquo; London and Turkey suits</h1>
      <p className={styles.lead}>
        Wholesale and retail from Martins Street, Lagos Island. Since 2012.
      </p>
      <p className={styles.note}>The new site is being built.</p>
    </main>
  );
}

import { LoginForm } from "./LoginForm";
import styles from "../admin.module.css";

export default function AdminLoginPage() {
  return (
    <main id="main" className={styles.page}>
      <p className={styles.wordmark}>Frankie Suits</p>
      <h1 className={styles.title}>Owner sign in</h1>
      <p className={styles.lead}>Only owners on the list can sign in.</p>
      <LoginForm />
    </main>
  );
}

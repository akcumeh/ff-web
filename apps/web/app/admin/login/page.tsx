import { LoginForm } from "./LoginForm";
import styles from "../admin.module.css";

export default function AdminLoginPage() {
  return (
    <main id="main" className={styles.page}>
      <p className={styles.wordmark}>Frankie Suits</p>
      <h1 className={styles.title}>Admin login</h1>
      <p className={styles.lead}>Log in with your admin credentials.</p>
      <LoginForm />
    </main>
  );
}

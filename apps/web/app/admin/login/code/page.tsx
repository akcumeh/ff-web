import { CodeForm } from "./CodeForm";
import { signOut } from "../actions";
import styles from "../../admin.module.css";

export default function AdminCodePage() {
    return (
        <main id="main" className={styles.page}>
            <p className={styles.wordmark}>Frankie Suits</p>
            <h1 className={styles.title}>Authenticator code</h1>
            <p className={styles.lead}>This account has an authenticator app. Enter its code to finish signing in.</p>
            <CodeForm />
            <hr className={styles.rule} />
            <form action={signOut}>
                <button type="submit" className={styles.secondary}>Use another account</button>
            </form>
        </main>
    );
}

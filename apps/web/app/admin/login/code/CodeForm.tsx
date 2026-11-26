"use client";

import { useActionState } from "react";
import { verifyCode, type FormState } from "../actions";
import styles from "../../admin.module.css";

export function CodeForm() {
    const [state, action, pending] = useActionState<FormState, FormData>(verifyCode, {});
    const codeError = state.fieldErrors?.code;

    return (
        <form action={action} className={styles.form} noValidate>
            <div className={styles.field}>
                <label htmlFor="code" className={styles.label}>6 digit code</label>
                <input
                    id="code"
                    name="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    autoFocus
                    className={styles.input}
                    aria-invalid={Boolean(codeError)}
                    aria-describedby={codeError ? "code-error" : "code-hint"}
                />
                {codeError ? (
                    <p id="code-error" className={styles.error}>{codeError}</p>
                ) : (
                    <p id="code-hint" className={styles.hint}>Open your authenticator app and type the code for Frankie Suits.</p>
                )}
            </div>

            <p role="alert" aria-live="polite" className={styles.error}>{state.message ?? ""}</p>

            <button type="submit" className={styles.primary} disabled={pending}>
                {pending ? "Checking" : "Continue"}
            </button>
        </form>
    );
}

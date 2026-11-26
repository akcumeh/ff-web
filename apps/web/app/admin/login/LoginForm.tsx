"use client";

import { useActionState } from "react";
import { signIn, type FormState } from "./actions";
import styles from "../admin.module.css";

export function LoginForm() {
    const [state, action, pending] = useActionState<FormState, FormData>(signIn, {});
    const err = state.fieldErrors ?? {};

    return (
        <form action={action} className={styles.form} noValidate>
            <div className={styles.field}>
                <label htmlFor="email" className={styles.label}>Email</label>
                <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    required
                    defaultValue={state.email}
                    className={styles.input}
                    aria-invalid={Boolean(err.email)}
                    aria-describedby={err.email ? "email-error" : undefined}
                />
                {err.email && <p id="email-error" className={styles.error}>{err.email}</p>}
            </div>

            <div className={styles.field}>
                <label htmlFor="password" className={styles.label}>Password</label>
                <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    className={styles.input}
                    aria-invalid={Boolean(err.password)}
                    aria-describedby={err.password ? "password-error" : undefined}
                />
                {err.password && <p id="password-error" className={styles.error}>{err.password}</p>}
            </div>

            <p role="alert" aria-live="polite" className={styles.error}>{state.message ?? ""}</p>

            <button type="submit" className={styles.primary} disabled={pending}>
                {pending ? "Signing in" : "Sign in"}
            </button>
        </form>
    );
}

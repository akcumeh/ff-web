"use client";

import { useActionState, useState, useTransition } from "react";
import { confirmEnroll, startEnroll, type ConfirmState, type StartResult } from "./actions";
import styles from "../admin.module.css";

export function TotpSetup({ enabled }: { enabled: boolean }) {
    const [started, setStarted] = useState<StartResult | null>(null);
    const [starting, startTransition] = useTransition();
    const [state, confirm, confirming] = useActionState<ConfirmState, FormData>(confirmEnroll, {});

    if (enabled || state.done) {
        return <p className={styles.lead}>This is on. You will type a code from your app each time you log in.</p>;
    }

    if (!started || !started.ok) {
        return (
            <div className={styles.form}>
                <p className={styles.lead}>You can add a second check. Each time you log in, you will also type a 6-digit code from an app like Google Authenticator.</p>
                {started && !started.ok && <p role="alert" className={styles.error}>{started.message}</p>}
                <button
                    type="button"
                    className={styles.primary}
                    disabled={starting}
                    onClick={() => startTransition(async () => setStarted(await startEnroll()))}
                >
                    {starting ? "Starting" : "Turn on authenticator app"}
                </button>
            </div>
        );
    }

    return (
        <form action={confirm} className={styles.form} noValidate>
            <input type="hidden" name="factorId" value={started.factorId} />
            <p className={styles.lead}>Scan this code with your authenticator app, then type the 6 digit code it shows.</p>
            <img src={started.qrCode} alt="QR code for the authenticator app" className={styles.qr} width={200} height={200} />
            <p className={styles.secret}>Or type this key by hand: {started.secret}</p>
            <div className={styles.field}>
                <label htmlFor="code" className={styles.label}>6 digit code</label>
                <input
                    id="code"
                    name="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    required
                    className={styles.input}
                    aria-invalid={Boolean(state.message)}
                    aria-describedby={state.message ? "enroll-error" : undefined}
                />
                {state.message && <p id="enroll-error" role="alert" className={styles.error}>{state.message}</p>}
            </div>
            <button type="submit" className={styles.primary} disabled={confirming}>
                {confirming ? "Checking" : "Confirm"}
            </button>
        </form>
    );
}

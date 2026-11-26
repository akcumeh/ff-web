"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminCall } from "@/lib/admin-client";
import styles from "../admin.module.css";

export function OrderActions({ id, status }: { id: string; status: string }) {
    const router = useRouter();
    const [message, setMessage] = useState("");
    const [busy, setBusy] = useState(false);

    async function set(next: "delivered" | "cancelled") {
        if (next === "cancelled") {
            const note = status === "paid" ? " This order is paid: refund it by hand in the Paystack dashboard." : "";
            if (!window.confirm(`Cancel this order?${note}`)) return;
        }
        setBusy(true);
        const res = await adminCall("PATCH", `/orders/${id}`, { status: next });
        setBusy(false);
        if (!res.ok) setMessage(res.message);
        else router.refresh();
    }

    return (
        <div className={styles.actions}>
            {status === "paid" && (
                <button type="button" className={styles.secondary} onClick={() => set("delivered")} disabled={busy}>Mark delivered</button>
            )}
            {(status === "paid" || status === "pending") && (
                <button type="button" className={styles.secondary} onClick={() => set("cancelled")} disabled={busy}>Cancel</button>
            )}
            {message && <span role="alert" className={styles.error}>{message}</span>}
        </div>
    );
}

export function ChatStarted({ id, started }: { id: string; started: boolean }) {
    const [on, setOn] = useState(started);
    const [error, setError] = useState("");
    return (
        <label className={styles.choice}>
            <input
                type="checkbox"
                checked={on}
                onChange={async (e) => {
                    const next = e.target.checked;
                    setOn(next);
                    const res = await adminCall("PATCH", `/enquiries/${id}`, { chat_started: next });
                    if (!res.ok) {
                        setOn(!next);
                        setError(res.message);
                    }
                }}
            />
            Chat started
            {error && <span role="alert" className={styles.error}> {error}</span>}
        </label>
    );
}

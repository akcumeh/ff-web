"use client";

import { useRef, useState, type FormEvent } from "react";
import { ApiError, OrderCreate, OrderCreated } from "@ff/shared";
import { visitorCookieIfAccepted } from "@/lib/tracker";
import { EnquireLink } from "./EnquireLink";
import styles from "./buy.module.css";
import { CallUs } from "./ContactButtons";

type Variant = { id: string; colour: string; hex: string | null; size: string; in_stock: boolean };

const API = "/ffapi";

export function SuitBuy({
    slug,
    variants,
    soldOut,
    waNumber,
    enquiryMessage,
    telFallback,
}: {
    slug: string;
    variants: Variant[];
    soldOut: boolean;
    waNumber: string | null;
    enquiryMessage: string;
    telFallback: string;
}) {
    const colours = [...new Map(variants.map((v) => [v.colour, v.hex])).entries()];
    const [colour, setColour] = useState<string | null>(colours.length === 1 ? colours[0]![0] : null);
    const [size, setSize] = useState<string | null>(null);
    const [qty, setQty] = useState(1);
    const [open, setOpen] = useState(false);
    const [notice, setNotice] = useState("");
    const [fields, setFields] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);
    const pickerRef = useRef<HTMLFieldSetElement>(null);
    const noticeRef = useRef<HTMLParagraphElement>(null);

    const sizes = variants.filter((v) => v.colour === colour);
    const chosen = variants.find((v) => v.colour === colour && v.size === size && v.in_stock);
    const choiceText = chosen ? `${chosen.colour}, size ${chosen.size}` : "";

    function payNow() {
        if (!chosen) {
            setNotice("Choose a colour and a size first.");
            pickerRef.current?.querySelector<HTMLInputElement>("input")?.focus();
            return;
        }
        setNotice("");
        setOpen(true);
    }

    async function submit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!chosen) return;
        const f = new FormData(e.currentTarget);
        const cookie = visitorCookieIfAccepted();
        const candidate = {
            suit_slug: slug,
            variant_id: chosen.id,
            qty,
            customer: {
                name: String(f.get("name") ?? ""),
                phone: String(f.get("phone") ?? ""),
                email: String(f.get("email") ?? ""),
                address: String(f.get("address") ?? ""),
            },
            ...(String(f.get("notes") ?? "").trim() ? { notes: String(f.get("notes")) } : {}),
            agreed_to_terms: f.get("terms") === "on",
            ...(cookie ? { visitor_cookie: cookie } : {}),
        };
        const parsed = OrderCreate.safeParse(candidate);
        if (!parsed.success) {
            const out: Record<string, string> = {};
            for (const i of parsed.error.issues) out[String(i.path.at(-1))] ??= i.message;
            setFields(out);
            setNotice("Please check the boxes marked in red.");
            noticeRef.current?.focus();
            return;
        }
        setFields({});
        setBusy(true);
        setNotice("Taking you to the payment page.");
        try {
            const res = await fetch(`${API}/orders`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(parsed.data) });
            const body: unknown = await res.json().catch(() => null);
            if (!res.ok) {
                const err = ApiError.safeParse(body);
                setNotice(err.success ? err.data.error.message : "Something went wrong. Please try again.");
                noticeRef.current?.focus();
                return;
            }
            const created = OrderCreated.parse(body);
            const host = new URL(created.checkout_url).hostname;
            if (host !== "checkout.paystack.com" && !host.endsWith(".paystack.com") && host !== "paystack.com") {
                setNotice("Something went wrong. Please try again.");
                return;
            }
            window.location.assign(created.checkout_url);
        } catch {
            setNotice("No internet. Please check your connection and try again.");
            noticeRef.current?.focus();
        } finally {
            setBusy(false);
        }
    }

    return (
        <div data-picker="" data-choice={choiceText} className={styles.buy}>
            <fieldset ref={pickerRef} className={styles.picker}>
                <legend className={styles.legend}>Colour</legend>
                <div className={styles.options}>
                    {colours.map(([name, hex]) => (
                        <label key={name} className={styles.option}>
                            <input type="radio" name="colour" value={name} checked={colour === name} onChange={() => { setColour(name); setSize(null); }} />
                            <span className={styles.swatch} style={hex ? { background: hex } : undefined} aria-hidden="true" />
                            {name}
                        </label>
                    ))}
                </div>
            </fieldset>

            {colour && (
                <fieldset className={styles.picker}>
                    <legend className={styles.legend}>Size</legend>
                    <div className={styles.options}>
                        {sizes.map((v) => (
                            <label key={v.id} className={styles.option} data-out={!v.in_stock}>
                                <input type="radio" name="size" value={v.size} checked={size === v.size} disabled={!v.in_stock} onChange={() => setSize(v.size)} />
                                {v.size}
                                {!v.in_stock && <span className={styles.out}> sold out</span>}
                            </label>
                        ))}
                    </div>
                </fieldset>
            )}

            <div className={styles.qtyRow}>
                <label htmlFor="qty" className={styles.legend}>Quantity</label>
                <select id="qty" value={qty} onChange={(e) => setQty(Number(e.target.value))} className={styles.select}>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>{n}</option>
                    ))}
                </select>
            </div>

            <p ref={noticeRef} tabIndex={-1} role="status" aria-live="polite" className={styles.notice}>{notice}</p>

            <div className={styles.keys}>
                {soldOut ? (
                    <p className={styles.soldOut}>This suit is sold out. Ask us if we can get more.</p>
                ) : (
                    <button type="button" className={styles.primary} onClick={payNow}>Pay now</button>
                )}
                {waNumber ? (
                    <EnquireLink number={waNumber} slug={slug} baseMessage={enquiryMessage} className={styles.secondary} />
                ) : (
                    <CallUs className={styles.secondary} />
                )}
            </div>

            {open && chosen && (
                <form onSubmit={submit} className={styles.form} noValidate>
                    <h2 className={styles.formTitle}>Your details</h2>
                    <p className={styles.hint}>{chosen.colour}, size {chosen.size}, quantity {qty}.</p>
                    {[
                        { name: "name", label: "Full name", type: "text", auto: "name" },
                        { name: "phone", label: "Phone", type: "tel", auto: "tel" },
                        { name: "email", label: "Email", type: "email", auto: "email", hint: "We send your receipt here." },
                    ].map((fld) => (
                        <div key={fld.name} className={styles.field}>
                            <label htmlFor={`f-${fld.name}`} className={styles.label}>{fld.label}</label>
                            <input
                                id={`f-${fld.name}`}
                                name={fld.name}
                                type={fld.type}
                                autoComplete={fld.auto}
                                required
                                className={styles.input}
                                aria-invalid={Boolean(fields[fld.name])}
                                aria-describedby={fields[fld.name] ? `e-${fld.name}` : fld.hint ? `h-${fld.name}` : undefined}
                            />
                            {fields[fld.name] ? <p id={`e-${fld.name}`} className={styles.error}>{fields[fld.name]}</p> : fld.hint && <p id={`h-${fld.name}`} className={styles.hint}>{fld.hint}</p>}
                        </div>
                    ))}
                    <div className={styles.field}>
                        <label htmlFor="f-address" className={styles.label}>Delivery address</label>
                        <textarea id="f-address" name="address" rows={3} autoComplete="street-address" required className={styles.input} aria-invalid={Boolean(fields.address)} aria-describedby={fields.address ? "e-address" : undefined} />
                        {fields.address && <p id="e-address" className={styles.error}>{fields.address}</p>}
                    </div>
                    <div className={styles.field}>
                        <label htmlFor="f-notes" className={styles.label}>Anything else? (optional)</label>
                        <textarea id="f-notes" name="notes" rows={2} className={styles.input} />
                    </div>
                    <label className={styles.check}>
                        <input type="checkbox" name="terms" aria-invalid={Boolean(fields.agreed_to_terms)} aria-describedby={fields.agreed_to_terms ? "e-terms" : undefined} />
                        <span>
                            I have read the <a href="/delivery-and-refunds" target="_blank" rel="noopener">delivery and refunds page</a>.
                        </span>
                    </label>
                    {fields.agreed_to_terms && <p id="e-terms" className={styles.error}>{fields.agreed_to_terms}</p>}
                    <button type="submit" className={styles.primary} disabled={busy}>{busy ? "Please wait" : "Continue to payment"}</button>
                </form>
            )}
        </div>
    );
}

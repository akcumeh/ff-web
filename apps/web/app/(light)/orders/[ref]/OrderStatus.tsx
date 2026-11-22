"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatNaira, styleLabel, waLink, type OrderView } from "@ff/shared";
import { track } from "@/lib/tracker";
import styles from "@/components/site/pages.module.css";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/+$/, "");

export function OrderStatus({ initial, waNumber }: { initial: OrderView; waNumber: string | null }) {
  const [order, setOrder] = useState(initial);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (order.status !== "pending" || tries >= 10) return;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/orders/${order.ref}/verify`, { method: "POST" });
        if (res.ok) setOrder((await res.json()) as OrderView);
      } catch {
        // keep polling quietly
      }
      setTries((n) => n + 1);
    }, 3000);
    return () => clearTimeout(t);
  }, [order, tries]);

  const help = (text: string) =>
    waNumber ? (
      <a href={waLink(waNumber, text)} target="_blank" rel="noopener" className={styles.secondary}>Message us on WhatsApp</a>
    ) : (
      <a href="tel:07081156800" className={styles.secondary}>Call the head office</a>
    );

  const summary = (
    <dl className={styles.summary}>
      <dt>Design</dt>
      <dd>{styleLabel[order.suit.style]}, Ref {order.suit.ref}</dd>
      <dt>Colour and size</dt>
      <dd>{order.variant.colour}, size {order.variant.size}</dd>
      <dt>Quantity</dt>
      <dd>{order.qty}</dd>
      <dt>Amount</dt>
      <dd>{formatNaira(order.amount_kobo)}</dd>
      <dt>Reference</dt>
      <dd>{order.ref}</dd>
    </dl>
  );

  return (
    <div aria-live="polite">
      {order.status === "pending" && (
        <>
          <h1 className={styles.h1}>Checking your payment</h1>
          {summary}
          {tries >= 10 ? (
            <>
              <p className={styles.body}>We have not confirmed your payment yet. If money left your account, message us on WhatsApp and quote this reference.</p>
              {help(`Hello Frankie Suits. I paid for order ${order.ref} but the page has not confirmed it.`)}
            </>
          ) : (
            <p className={styles.body}>This usually takes a few seconds.</p>
          )}
        </>
      )}

      {(order.status === "paid" || order.status === "delivered") && (
        <>
          <h1 className={styles.h1}>{order.status === "delivered" ? "Delivered" : "We have your payment"}</h1>
          {summary}
          <p className={styles.body}>We arrange delivery with you on WhatsApp.</p>
          {waNumber ? (
            <a
              href={waLink(waNumber, `Hello Frankie Suits. I'd like to arrange delivery for order ${order.ref}.`)}
              target="_blank"
              rel="noopener"
              className={styles.primary}
              onClick={() => void track({ type: "delivery_click", order_ref: order.ref })}
            >
              Arrange delivery on WhatsApp
            </a>
          ) : (
            <a href="tel:07081156800" className={styles.primary}>Call the head office</a>
          )}
        </>
      )}

      {(order.status === "failed" || order.status === "cancelled") && (
        <>
          <h1 className={styles.h1}>This payment did not go through</h1>
          <p className={styles.body}>Nothing was taken for this order. You can try again from the design page.</p>
          <div className={styles.actions}>
            <Link href={`/suits/${order.suit.slug}`} className={styles.primary}>Back to the design</Link>
            {help(`Hello Frankie Suits. My payment for order ${order.ref} did not go through.`)}
          </div>
        </>
      )}
    </div>
  );
}

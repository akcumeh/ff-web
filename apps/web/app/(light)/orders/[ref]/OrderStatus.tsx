"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatNaira, styleLabel, waLink, type OrderView } from "@ff/shared";
import { track } from "@/lib/tracker";
import styles from "@/components/site/pages.module.css";
import { CallUs } from "@/components/site/ContactButtons";

const API = "/ffapi";

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
      <a href={waLink(waNumber, text)} target="_blank" rel="noopener" className={styles.secondary}>Chat on WhatsApp</a>
    ) : (
      <CallUs className={styles.secondary} />
    );

  const summary = (
    <dl className={styles.summary}>
      <dt>Suit</dt>
      <dd>{styleLabel[order.suit.style]}, Ref {order.suit.ref}</dd>
      <dt>Colour and size</dt>
      <dd>{order.variant.colour}, size {order.variant.size}</dd>
      <dt>Quantity</dt>
      <dd>{order.qty}</dd>
      <dt>Amount</dt>
      <dd>{formatNaira(order.amount_kobo)}</dd>
      <dt>Order number</dt>
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
              <p className={styles.body}>We have not seen your payment yet. If money left your account, chat with us on WhatsApp and send this order number.</p>
              {help(`Hello Frankie Suits. I paid for order ${order.ref} but the page has not confirmed it.`)}
            </>
          ) : (
            <p className={styles.body}>Please wait a few seconds.</p>
          )}
        </>
      )}

      {(order.status === "paid" || order.status === "delivered") && (
        <>
          <h1 className={styles.h1}>{order.status === "delivered" ? "Delivered" : "Thank you, you have paid"}</h1>
          {summary}
          <p className={styles.body}>Now tap below to agree the delivery with us on WhatsApp.</p>
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
            <CallUs className={styles.primary} />
          )}
        </>
      )}

      {(order.status === "failed" || order.status === "cancelled") && (
        <>
          <h1 className={styles.h1}>This payment did not work</h1>
          <p className={styles.body}>No money was taken. You can try again from the suit page.</p>
          <div className={styles.actions}>
            <Link href={`/suits/${order.suit.slug}`} className={styles.primary}>Back to the suit</Link>
            {help(`Hello Frankie Suits. My payment for order ${order.ref} did not go through.`)}
          </div>
        </>
      )}
    </div>
  );
}

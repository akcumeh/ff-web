import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminOrderList, EnquiryList, formatNaira, styleLabel, toWaNumber, waLink } from "@ff/shared";
import { adminGet } from "@/lib/admin-api";
import { AdminNav } from "../AdminNav";
import { ChatStarted, OrderActions } from "./OrderActions";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";

const TABS = ["paid", "pending", "delivered", "cancelled", "enquiries"] as const;
type Tab = (typeof TABS)[number];

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const raw = (await searchParams).tab;
  const tab: Tab = TABS.includes(raw as Tab) ? (raw as Tab) : "paid";

  const orders = tab === "enquiries" ? null : await adminGet(`/orders?status=${tab}`, AdminOrderList);
  const enquiries = tab === "enquiries" ? await adminGet("/enquiries", EnquiryList) : null;
  if ((orders?.kind === "error" && orders.status === 401) || (enquiries?.kind === "error" && enquiries.status === 401)) redirect("/admin/login");

  return (
    <main id="main" className={styles.page}>
      <AdminNav />
      <h1 className={styles.title}>Orders and enquiries</h1>
      <ul className={styles.nav} aria-label="Filter">
        {TABS.map((t) => (
          <li key={t}>
            <Link href={`/admin/orders?tab=${t}`} aria-current={t === tab ? "page" : undefined}>{t === "enquiries" ? "Enquiries" : t[0]!.toUpperCase() + t.slice(1)}</Link>
          </li>
        ))}
      </ul>

      {orders?.kind === "ok" && orders.data.items.length === 0 && <p className={styles.lead}>No {tab} orders.</p>}
      {orders?.kind === "ok" && orders.data.items.length > 0 && (
        <ul className={styles.packList}>
          {orders.data.items.map((o) => {
            const wa = toWaNumber(o.phone);
            const pendingAge = Date.now() - Date.parse(o.created_at);
            return (
              <li key={o.id} className={styles.packCard}>
                <h2 className={styles.label}>
                  {o.ref} <span className={styles.status}>{o.status === "pending" && pendingAge > 86400_000 ? "Abandoned" : o.status}</span>
                  {o.status === "paid" && !o.variant_in_stock && <span className={styles.badge}> Check stock</span>}
                </h2>
                <p>{new Date(o.created_at).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}</p>
                <p>
                  {styleLabel[o.suit.style]} {o.suit.ref}, {o.variant.colour}, size {o.variant.size}, qty {o.qty}, {formatNaira(o.amount_kobo)}
                </p>
                <p>
                  {o.customer_name}, <a href={`tel:${o.phone}`} className={styles.link}>{o.phone}</a>
                  {wa && (
                    <>
                      {" "}
                      <a href={waLink(wa, `Hello ${o.customer_name}, this is Frankie Suits about order ${o.ref}.`)} target="_blank" rel="noopener" className={styles.link}>Message on WhatsApp</a>
                    </>
                  )}
                </p>
                <p className={styles.hint}>{o.delivery_address}{o.notes ? `. Note: ${o.notes}` : ""}</p>
                <OrderActions id={o.id} status={o.status} />
              </li>
            );
          })}
        </ul>
      )}

      {enquiries?.kind === "ok" && (
        <>
          <p className={styles.hint}>
            Each code comes from a press of &ldquo;Ask us about this design&rdquo;. Tick it when the customer actually messaged. Chat-started rate:{" "}
            {enquiries.data.items.length ? `${Math.round((enquiries.data.items.filter((e) => e.chat_started_at).length / enquiries.data.items.length) * 100)}%` : "n/a"}.
          </p>
          <ul className={styles.list}>
            {enquiries.data.items.map((e) => (
              <li key={e.id} className={styles.row}>
                <strong>{e.code}</strong>
                <span>{e.suit_ref}, {new Date(e.created_at).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}</span>
                <ChatStarted id={e.id} started={Boolean(e.chat_started_at)} />
              </li>
            ))}
          </ul>
          {enquiries.data.items.length === 0 && <p className={styles.lead}>No enquiries yet.</p>}
        </>
      )}

      {(orders?.kind === "offline" || enquiries?.kind === "offline") && <p className={styles.error}>The site is having a problem right now. Please wait a few minutes and refresh the page.</p>}
    </main>
  );
}

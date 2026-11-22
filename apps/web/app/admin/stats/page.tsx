import Link from "next/link";
import { redirect } from "next/navigation";
import { Stats, StatsRange } from "@ff/shared";
import { adminGet } from "@/lib/admin-api";
import { AdminNav } from "../AdminNav";
import { SnapshotForm } from "./SnapshotForm";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";

const RANGES = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "12w", label: "Last 12 weeks" },
  { key: "12m", label: "Last 12 months" },
] as const;

const per100 = (r: number | null) => (r === null ? "n/a" : (r * 100).toFixed(1));

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const range = StatsRange.catch("30d").parse((await searchParams).range);
  const result = await adminGet(`/stats?range=${range}`, Stats);
  if (result.kind === "error" && result.status === 401) redirect("/admin/login");

  return (
    <main id="main" className={styles.page}>
      <p className={styles.wordmark}>Frankie Suits</p>
      <AdminNav />
      <h1 className={styles.title}>Stats</h1>
      <ul className={styles.nav} aria-label="Range">
        {RANGES.map((r) => (
          <li key={r.key}>
            <Link href={`/admin/stats?range=${r.key}`} aria-current={r.key === range ? "page" : undefined}>{r.label}</Link>
          </li>
        ))}
      </ul>

      {result.kind !== "ok" && <p className={styles.error}>{result.kind === "offline" ? "The API is not answering." : result.message}</p>}
      {result.kind === "ok" && (() => {
        const s = result.data;
        const steps = [
          { label: "Views", n: s.funnel.suit_views },
          { label: "Enquire clicks", n: s.funnel.enquire_clicks },
          { label: "Chats started", n: s.funnel.chats_started },
          { label: "Checkouts started", n: s.funnel.checkout_starts },
          { label: "Paid orders", n: s.funnel.payments },
          { label: "Delivery clicks", n: s.funnel.delivery_clicks },
        ];
        const max = Math.max(1, ...steps.map((x) => x.n));
        return (
          <div className={styles.wide}>
            <div className={styles.tiles}>
              <div className={styles.tile}>
                <p className={styles.tileNumber}>{s.traffic.suit_views_all}</p>
                <p className={styles.label}>Views</p>
                <p className={styles.hint}>Suit views by everyone. They are not people.</p>
              </div>
              <div className={styles.tile}>
                <p className={styles.tileNumber}>{s.traffic.approx_unique_visitors ?? "n/a"}</p>
                <p className={styles.label}>Approx. unique visitors</p>
                <p className={styles.hint}>Different browsers among people who pressed Accept. It undercounts.</p>
              </div>
              <div className={styles.tile}>
                <p className={styles.tileNumber}>{s.funnel.enquire_clicks}</p>
                <p className={styles.label}>Enquiries</p>
                <p className={styles.hint}>{per100(s.rates.enquiry_rate)} enquiries per 100 views. A click is not a chat.</p>
              </div>
              <div className={styles.tile}>
                <p className={styles.tileNumber}>{s.funnel.payments}</p>
                <p className={styles.label}>Paid orders</p>
                <p className={styles.hint}>{per100(s.rates.pay_rate)} orders per 100 views.</p>
              </div>
            </div>

            <section className={styles.fieldset} aria-labelledby="funnel-title">
              <h2 id="funnel-title" className={styles.legend}>Funnel</h2>
              <ul className={styles.list}>
                {steps.map((x, i) => (
                  <li key={x.label} className={styles.funnelRow}>
                    <span>{x.label}</span>
                    <span className={styles.bar} style={{ width: `${Math.max(2, (x.n / max) * 100)}%` }} aria-hidden="true" />
                    <span>
                      {x.n}
                      {i > 0 && steps[i - 1]!.n > 0 ? ` (${Math.round((x.n / steps[i - 1]!.n) * 100)}% of the step before)` : ""}
                    </span>
                  </li>
                ))}
              </ul>
              <p className={styles.hint}>Consent rate: {s.traffic.consent_rate === null ? "n/a" : `${Math.round(s.traffic.consent_rate * 100)}% of views came from people who pressed Accept`}.</p>
            </section>

            <section className={styles.fieldset} aria-labelledby="suits-title">
              <h2 id="suits-title" className={styles.legend}>By suit</h2>
              {s.by_suit.length === 0 ? (
                <p className={styles.hint}>No views in this range yet.</p>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr><th scope="col">Ref</th><th scope="col">Views</th><th scope="col">Enquiries</th><th scope="col">Paid</th></tr>
                  </thead>
                  <tbody>
                    {s.by_suit.map((r) => (
                      <tr key={r.ref}><th scope="row">{r.ref}</th><td>{r.views}</td><td>{r.enquire_clicks}</td><td>{r.payments}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className={styles.fieldset} aria-labelledby="channels-title">
              <h2 id="channels-title" className={styles.legend}>Channels</h2>
              <p>Telegram followers: {s.channels.telegram.followers ?? "not counted yet"}{s.channels.telegram.as_of ? ` (as of ${s.channels.telegram.as_of})` : ""}</p>
              <p>
                WhatsApp followers: {s.channels.whatsapp.followers ?? "not typed in yet"}
                {s.channels.whatsapp.as_of ? ` (as of ${s.channels.whatsapp.as_of})` : ""}
                {s.channels.whatsapp.stale && <span className={styles.badge}> Needs this week&rsquo;s count</span>}
              </p>
              <SnapshotForm />
              <p className={styles.hint}>
                Join clicks: {s.channels.join_clicks_by_source.map((j) => `${j.source} ${j.clicks}`).join(", ") || "none yet"}. Clicks overcount, because not every click ends in a follow.
              </p>
            </section>

            <p className={styles.hint}>
              WhatsApp packs waiting: {s.pending_packs}. AI spend this month: ${(s.ai.month_spend_usd_micro / 1e6).toFixed(2)} of ${(s.ai.cap_usd_micro / 1e6).toFixed(2)}.
            </p>
          </div>
        );
      })()}
    </main>
  );
}

import { redirect } from "next/navigation";
import { Stats, StatsRange } from "@ff/shared";
import { adminGet } from "@/lib/admin-api";
import { AdminNav } from "../AdminNav";
import { RangePicker } from "./RangePicker";
import { SnapshotForm } from "./SnapshotForm";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";

const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : null);

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
    const range = StatsRange.catch("30d").parse((await searchParams).range);
    const result = await adminGet(`/stats?range=${range}`, Stats);
    if (result.kind === "error" && result.status === 401) redirect("/admin/login");

    return (
        <main id="main" className={styles.page}>
            <AdminNav />
            <div className={styles.titleRow}>
                <h1 className={styles.title}>Stats</h1>
                <RangePicker range={range} />
            </div>

            {result.kind !== "ok" && <p className={styles.error}>{result.kind === "offline" ? "The stats could not load. Try again in a minute." : result.message}</p>}
            {result.kind === "ok" && (() => {
                const s = result.data;
                const steps = [
                    { label: "Looked at a suit", n: s.funnel.suit_views },
                    { label: "Tapped to ask on WhatsApp", n: s.funnel.enquire_clicks },
                    { label: "Started a chat with you", n: s.funnel.chats_started },
                    { label: "Went to pay", n: s.funnel.checkout_starts },
                    { label: "Paid", n: s.funnel.payments },
                    { label: "Asked about delivery", n: s.funnel.delivery_clicks },
                ];
                const max = Math.max(1, ...steps.map((x) => x.n));
                const askRate = pct(s.funnel.enquire_clicks, s.funnel.suit_views);
                const payRate = pct(s.funnel.payments, s.funnel.suit_views);
                return (
                    <div className={styles.wide}>
                        <div className={styles.tiles}>
                            <div className={styles.tile}>
                                <p className={styles.tileNumber}>{s.traffic.suit_views_all}</p>
                                <p className={styles.tileLabel}>Suit views</p>
                                <p className={styles.hint}>How many times a suit page was opened.</p>
                            </div>
                            <div className={styles.tile}>
                                <p className={styles.tileNumber}>{s.traffic.approx_unique_visitors ?? 0}</p>
                                <p className={styles.tileLabel}>Visitors</p>
                                <p className={styles.hint}>People who agreed to be counted. Some people say no, so the real number is higher.</p>
                            </div>
                            <div className={styles.tile}>
                                <p className={styles.tileNumber}>{s.funnel.enquire_clicks}</p>
                                <p className={styles.tileLabel}>WhatsApp taps</p>
                                <p className={styles.hint}>{askRate ? `${askRate} of suit views.` : "People who tapped to ask about a suit."}</p>
                            </div>
                            <div className={styles.tile}>
                                <p className={styles.tileNumber}>{s.funnel.payments}</p>
                                <p className={styles.tileLabel}>Paid orders</p>
                                <p className={styles.hint}>{payRate ? `${payRate} of suit views.` : "Orders paid on the website."}</p>
                            </div>
                        </div>

                        <section className={styles.fieldset} aria-labelledby="funnel-title">
                            <h2 id="funnel-title" className={styles.legend}>From looking to paying</h2>
                            <ul className={styles.list}>
                                {steps.map((x, i) => {
                                    const share = i > 0 ? pct(x.n, steps[i - 1]!.n) : null;
                                    return (
                                        <li key={x.label} className={styles.funnelRow}>
                                            <span>{x.label}</span>
                                            <span className={styles.bar} style={{ width: `${Math.max(2, (x.n / max) * 100)}%` }} aria-hidden="true" />
                                            <span>{x.n}{share ? ` (${share})` : ""}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>

                        <section className={styles.fieldset} aria-labelledby="suits-title">
                            <h2 id="suits-title" className={styles.legend}>Each suit</h2>
                            {s.by_suit.length === 0 ? (
                                <p className={styles.hint}>Nobody has looked at a suit in this time.</p>
                            ) : (
                                <table className={styles.table}>
                                    <thead>
                                        <tr><th scope="col">Suit</th><th scope="col">Views</th><th scope="col">WhatsApp taps</th><th scope="col">Paid</th></tr>
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
                            <h2 id="channels-title" className={styles.legend}>Your channels</h2>
                            <p>Telegram followers: {s.channels.telegram.followers ?? "not counted yet"}</p>
                            <p>
                                WhatsApp followers: {s.channels.whatsapp.followers ?? "not added yet"}
                                {s.channels.whatsapp.as_of ? ` (on ${s.channels.whatsapp.as_of})` : ""}
                            </p>
                            {s.channels.whatsapp.stale && <p className={styles.hint}>Please add this week&rsquo;s WhatsApp follower number. Open your channel to see it.</p>}
                            <SnapshotForm />
                        </section>
                    </div>
                );
            })()}
        </main>
    );
}

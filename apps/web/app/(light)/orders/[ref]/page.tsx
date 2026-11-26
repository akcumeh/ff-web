import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ORDER_REF_RE, OrderView } from "@ff/shared";
import { apiInternalUrl, whatsappNumber } from "@/lib/public-env";
import { OrderStatus } from "./OrderStatus";
import site from "@/components/site/site.module.css";
import styles from "@/components/site/pages.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your order | Frankie Suits", robots: { index: false, follow: false } };

export default async function OrderPage({ params }: { params: Promise<{ ref: string }> }) {
    const { ref } = await params;
    if (!ORDER_REF_RE.test(ref)) notFound();

    let order: OrderView | null = null;
    let missing = false;
    try {
        const res = await fetch(`${apiInternalUrl()}/orders/${ref}`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
        missing = res.status === 404;
        if (res.ok) order = OrderView.parse(await res.json());
    } catch {
        order = null;
    }
    if (missing) notFound();

    return (
        <div className={`${site.container} ${styles.section}`}>
            {order ? (
                <OrderStatus initial={order} waNumber={whatsappNumber()} />
            ) : (
                <>
                    <h1 className={styles.h1}>Your order could not be loaded</h1>
                    <p className={styles.body}>Reload the page in a moment. Your reference is {ref}.</p>
                </>
            )}
        </div>
    );
}

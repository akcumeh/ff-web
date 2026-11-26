import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderRow, OrdersRepo } from "../services/orders.ts";

const ORDER_SELECT =
    "id, ref, status, qty, amount_kobo, paid_at, created_at, customer_name, phone, email, delivery_address, notes, visitor_id, suit_id, " +
    "suits(ref, title, style, slug), suit_variants(colour, size, in_stock)";

type Raw = Omit<OrderRow, "suit" | "variant" | "variant_in_stock"> & {
    suits: OrderRow["suit"];
    suit_variants: { colour: string; size: string; in_stock: boolean };
};

const toRow = ({ suits, suit_variants, ...o }: Raw): OrderRow => ({
    ...o,
    suit: suits,
    variant: { colour: suit_variants.colour, size: suit_variants.size },
    variant_in_stock: suit_variants.in_stock,
});

function check(error: { message: string; code?: string } | null, what: string) {
    if (error) throw new Error(`${what} failed: ${error.message}`);
}

export function supabaseOrdersRepo(db: SupabaseClient): OrdersRepo {
    return {
        async suitForOrder(slug) {
            const { data, error } = await db
                .from("suits")
                .select("id, ref, title, style, slug, price_kobo, suit_variants(id, colour, size, in_stock)")
                .eq("slug", slug)
                .eq("status", "published")
                .maybeSingle();
            check(error, "suit for order");
            if (!data) return null;
            const { suit_variants, ...s } = data as unknown as { suit_variants: { id: string; colour: string; size: string; in_stock: boolean }[] } & Record<string, unknown>;
            return { ...(s as object), variants: suit_variants } as never;
        },
        async insertOrder(row) {
            const { data, error } = await db.from("orders").insert(row).select("id").single();
            check(error, "order insert");
            return data!;
        },
        async byRef(ref) {
            const { data, error } = await db.from("orders").select(ORDER_SELECT).eq("ref", ref).maybeSingle();
            check(error, "order read");
            return data ? toRow(data as unknown as Raw) : null;
        },
        async byId(id) {
            const { data, error } = await db.from("orders").select(ORDER_SELECT).eq("id", id).maybeSingle();
            check(error, "order read");
            return data ? toRow(data as unknown as Raw) : null;
        },
        async setStatus(id, status, extra = {}, onlyFrom) {
            let q = db.from("orders").update({ status, ...extra }).eq("id", id);
            if (onlyFrom) q = q.in("status", onlyFrom);
            const { data, error } = await q.select("id");
            check(error, "order status");
            return (data ?? []).length > 0;
        },
        async markPaid(id) {
            const { data, error } = await db
                .from("orders")
                .update({ status: "paid", paid_at: new Date().toISOString() })
                .eq("id", id)
                .eq("status", "pending")
                .select("id");
            check(error, "mark paid");
            return (data ?? []).length > 0;
        },
        async insertPaymentEvent(row) {
            const { error } = await db.from("payment_events").insert(row);
            if (error?.code === "23505") return "duplicate";
            check(error, "payment event");
            return "inserted";
        },
        async finishPaymentEvent(providerEventId, orderId) {
            const { error } = await db
                .from("payment_events")
                .update({ processed_at: new Date().toISOString(), order_id: orderId })
                .eq("provider_event_id", providerEventId);
            check(error, "payment event finish");
        },
        async list(status) {
            const { data, error } = await db.from("orders").select(ORDER_SELECT).eq("status", status).order("created_at", { ascending: false }).limit(200);
            check(error, "order list");
            return ((data ?? []) as unknown as Raw[]).map(toRow);
        },
    };
}

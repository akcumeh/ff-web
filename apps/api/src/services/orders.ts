import { randomInt } from "node:crypto";
import { formatNaira, styleLabel, type AdminOrder, type OrderCreate, type OrderView } from "@ff/shared";
import { HttpError } from "../lib/errors.ts";
import type { AuditEntry } from "./admin-catalogue.ts";
import { PaystackFailure, type PaystackPort } from "./paystack.ts";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export type SuitForOrder = {
  id: string;
  ref: string;
  title: string;
  style: "london" | "turkey";
  slug: string;
  price_kobo: number;
  variants: { id: string; colour: string; size: string; in_stock: boolean }[];
};

export type OrderRow = OrderView & {
  id: string;
  suit_id: string;
  visitor_id: string | null;
  created_at: string;
  customer_name: string;
  phone: string;
  email: string;
  delivery_address: string;
  notes: string | null;
  variant_in_stock: boolean;
};

export interface OrdersRepo {
  suitForOrder(slug: string): Promise<SuitForOrder | null>;
  insertOrder(row: Record<string, unknown>): Promise<{ id: string }>;
  byRef(ref: string): Promise<OrderRow | null>;
  byId(id: string): Promise<OrderRow | null>;
  setStatus(id: string, status: string, extra?: Record<string, unknown>, onlyFrom?: string[]): Promise<boolean>;
  markPaid(id: string): Promise<boolean>;
  insertPaymentEvent(row: { provider_event_id: string; event_type: string; payload: unknown }): Promise<"inserted" | "duplicate">;
  finishPaymentEvent(providerEventId: string, orderId: string | null): Promise<void>;
  list(status: string): Promise<OrderRow[]>;
}

export type OrdersDeps = {
  repo: OrdersRepo;
  paystack: PaystackPort | null;
  siteUrl: string;
  alert: (text: string) => Promise<void>;
  audit: (e: AuditEntry) => Promise<void>;
  visitorIdForCookie: (cookie: string) => Promise<string | null>;
  serverEvent: (type: "checkout_start" | "payment_success", suitId: string, visitorId: string | null) => Promise<void>;
};

export function newOrderRef(): string {
  let s = "FF-";
  for (let i = 0; i < 8; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

const view = (o: OrderRow): OrderView => ({
  ref: o.ref,
  status: o.status,
  suit: o.suit,
  variant: o.variant,
  qty: o.qty,
  amount_kobo: o.amount_kobo,
  paid_at: o.paid_at,
});

export function createOrders(deps: OrdersDeps) {
  async function confirm(order: OrderRow): Promise<void> {
    if (order.status !== "pending" || !deps.paystack) return;
    let verified;
    try {
      verified = await deps.paystack.verify(order.ref);
    } catch {
      return;
    }
    if (verified.status !== "success" || verified.reference !== order.ref) return;
    if (verified.amount !== order.amount_kobo || verified.currency !== "NGN") {
      await deps.alert(`Payment check failed for ${order.ref}: Paystack says ${verified.currency} ${verified.amount}, the order is ${order.amount_kobo}. Check it in the Paystack dashboard.`);
      return;
    }
    if (await deps.repo.markPaid(order.id)) {
      await deps.serverEvent("payment_success", order.suit_id, order.visitor_id).catch(() => {});
      await deps.alert(`Paid: ${order.ref}, ${styleLabel[order.suit.style]} ${order.suit.ref}, ${order.variant.colour} size ${order.variant.size}, qty ${order.qty}, ${formatNaira(order.amount_kobo)}.`);
    }
  }

  return {
    async create(input: OrderCreate): Promise<{ order_ref: string; checkout_url: string }> {
      if (!deps.paystack) throw new HttpError(503, "upstream_failed", "Online payment is not switched on yet. Ask us on WhatsApp.");
      const suit = await deps.repo.suitForOrder(input.suit_slug);
      if (!suit) throw new HttpError(404, "not_found", "That design is not on the site.");
      const variant = suit.variants.find((v) => v.id === input.variant_id);
      if (!variant) throw new HttpError(422, "rule_failed", "Choose a colour and a size of this design.", [{ path: "variant_id", message: "Not part of this design" }]);
      if (!variant.in_stock) throw new HttpError(422, "rule_failed", "That size has sold out. Choose another or ask us.", [{ path: "variant_id", message: "Sold out" }]);

      const ref = newOrderRef();
      const amount = suit.price_kobo * input.qty;
      const visitorId = input.visitor_cookie ? await deps.visitorIdForCookie(input.visitor_cookie) : null;
      const { id } = await deps.repo.insertOrder({
        ref,
        suit_id: suit.id,
        variant_id: variant.id,
        qty: input.qty,
        amount_kobo: amount,
        currency: "NGN",
        status: "pending",
        paystack_reference: ref,
        customer_name: input.customer.name,
        phone: input.customer.phone,
        email: input.customer.email,
        delivery_address: input.customer.address,
        notes: input.notes || null,
        visitor_id: visitorId,
      });

      try {
        const { authorizationUrl } = await deps.paystack.initialize({
          email: input.customer.email,
          amount,
          reference: ref,
          callbackUrl: `${deps.siteUrl}/orders/${ref}`,
          metadata: { order_ref: ref, suit_ref: suit.ref },
        });
        await deps.serverEvent("checkout_start", suit.id, visitorId).catch(() => {});
        return { order_ref: ref, checkout_url: authorizationUrl };
      } catch (err) {
        await deps.repo.setStatus(id, "failed");
        throw new HttpError(502, "upstream_failed", "Paystack did not answer. Try again in a moment.", [{ path: "paystack", message: err instanceof PaystackFailure ? err.code : "error" }]);
      }
    },

    async get(ref: string): Promise<OrderView> {
      const o = await deps.repo.byRef(ref);
      if (!o) throw new HttpError(404, "not_found", "No order with that reference.");
      return view(o);
    },

    async verify(ref: string): Promise<OrderView> {
      const o = await deps.repo.byRef(ref);
      if (!o) throw new HttpError(404, "not_found", "No order with that reference.");
      await confirm(o);
      return view((await deps.repo.byRef(ref))!);
    },

    async webhook(event: { event?: string; data?: { id?: number | string; reference?: string } }, raw: unknown) {
      const providerEventId = `${event.event ?? "unknown"}:${event.data?.id ?? event.data?.reference ?? "none"}`;
      if ((await deps.repo.insertPaymentEvent({ provider_event_id: providerEventId, event_type: event.event ?? "unknown", payload: raw })) === "duplicate") return;
      let orderId: string | null = null;
      if (event.event === "charge.success" && event.data?.reference) {
        const order = await deps.repo.byRef(event.data.reference);
        if (order) {
          orderId = order.id;
          await confirm(order);
        } else {
          console.warn(JSON.stringify({ level: "warn", msg: "webhook for unknown reference" }));
        }
      }
      await deps.repo.finishPaymentEvent(providerEventId, orderId);
    },

    async adminList(status: string): Promise<AdminOrder[]> {
      return (await deps.repo.list(status)).map((o) => ({
        ...view(o),
        id: o.id,
        created_at: o.created_at,
        customer_name: o.customer_name,
        phone: o.phone,
        email: o.email,
        delivery_address: o.delivery_address,
        notes: o.notes,
        variant_in_stock: o.variant_in_stock,
      }));
    },

    async adminUpdate(adminId: string, id: string, status: "delivered" | "cancelled") {
      const order = await deps.repo.byId(id);
      if (!order) throw new HttpError(404, "not_found", "No order with that id.");
      const from = status === "delivered" ? ["paid"] : ["pending", "paid"];
      const extra = status === "delivered" ? { delivered_at: new Date().toISOString() } : {};
      if (!(await deps.repo.setStatus(id, status, extra, from))) {
        throw new HttpError(409, "conflict", status === "delivered" ? "Only a paid order can be marked delivered." : "This order cannot be cancelled now.");
      }
      await deps.audit({ adminId, action: status === "delivered" ? "order.deliver" : "order.cancel", targetType: "order", targetId: order.ref });
    },
  };
}

export type Orders = ReturnType<typeof createOrders>;

import { z } from "zod";
import { SuitStyle } from "./enums.ts";

export const ORDER_REF_RE = /^FF-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/;

export const Phone = z
  .string()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^\+?[0-9]{10,15}$/, "Enter a phone number with 10 to 15 digits"));

export const OrderCreate = z.strictObject({
  suit_slug: z.string().min(1).max(80),
  variant_id: z.uuid("Choose a colour and a size"),
  qty: z.number().int().min(1).max(10),
  customer: z.strictObject({
    name: z.string().trim().min(2, "Enter your full name").max(80),
    phone: Phone,
    email: z.string().trim().max(254).pipe(z.email("Enter a valid email. Paystack sends your receipt here.")),
    address: z.string().trim().min(10, "Enter the full delivery address").max(300),
  }),
  notes: z.string().trim().max(500).optional(),
  agreed_to_terms: z.literal(true, "Tick the box to say you have read the delivery and refunds page"),
  visitor_cookie: z.string().regex(/^[a-f0-9]{32}$/).optional(),
});
export type OrderCreate = z.infer<typeof OrderCreate>;

export const OrderCreated = z.object({ order_ref: z.string(), checkout_url: z.url() });

export const OrderStatus = z.enum(["pending", "paid", "failed", "delivered", "cancelled"]);

export const OrderView = z.object({
  ref: z.string(),
  status: OrderStatus,
  suit: z.object({ ref: z.string(), title: z.string(), style: SuitStyle, slug: z.string() }),
  variant: z.object({ colour: z.string(), size: z.string() }),
  qty: z.number(),
  amount_kobo: z.number(),
  paid_at: z.string().nullable(),
});
export type OrderView = z.infer<typeof OrderView>;

export const AdminOrder = OrderView.extend({
  id: z.uuid(),
  created_at: z.string(),
  customer_name: z.string(),
  phone: z.string(),
  email: z.string(),
  delivery_address: z.string(),
  notes: z.string().nullable(),
  variant_in_stock: z.boolean(),
});
export type AdminOrder = z.infer<typeof AdminOrder>;
export const AdminOrderList = z.object({ items: z.array(AdminOrder) });
export const AdminOrderPatch = z.strictObject({ status: z.enum(["delivered", "cancelled"]) });

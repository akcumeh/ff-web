import { createHmac, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import request from "supertest";
import sharp from "sharp";
import { AdminSuitDetail, CONSENT_VERSION, OrderView } from "@ff/shared";
import { createAnalytics, type AnalyticsRepo } from "../src/services/analytics.ts";
import { createOrders, type OrderRow, type OrdersRepo } from "../src/services/orders.ts";
import { validPaystackSignature, type PaystackPort } from "../src/services/paystack.ts";
import { createTryon } from "../src/services/tryon.ts";
import { publicAnalyticsRouter } from "../src/routes/analytics.ts";
import { publicOrdersRouter, webhookRouter } from "../src/routes/orders.ts";
import { tryonRouter } from "../src/routes/tryon.ts";
import { memoryGenRepo, scriptedGemini } from "./ai-fakes.ts";
import { memoryStorage } from "./admin-fakes.ts";
import { testApp } from "./helpers.ts";

const SUIT_ID = randomUUID();
const VARIANT_ID = randomUUID();
const SOLD_OUT_ID = randomUUID();

function memoryAnalytics() {
  const anon: string[] = [];
  const events: { visitor_id: string; type: string; suit_id: string | null }[] = [];
  const enquiries = new Set<string>();
  const visitors = new Map<string, { id: string; cookie_hash: string; fp_hash: string | null; last_seen: string }>();
  let hits = 0;
  const repo: AnalyticsRepo = {
    async suitIdBySlug(slug) {
      return slug === "london-style-ln-01" ? SUIT_ID : null;
    },
    async insertEnquiry(code, suitId) {
      enquiries.add(`${code}:${suitId}`);
    },
    async countAnon(suitId, metric, source) {
      anon.push(`${metric}:${suitId ?? "site"}:${source}`);
    },
    async visitorByCookie(hash) {
      return [...visitors.values()].find((v) => v.cookie_hash === hash) ?? null;
    },
    async visitorsByFp(fp) {
      return [...visitors.values()].filter((v) => v.fp_hash === fp).map((v) => v.id);
    },
    async updateVisitor(id, patch) {
      Object.assign(visitors.get(id)!, patch);
    },
    async createVisitor(row) {
      const id = randomUUID();
      visitors.set(id, { id, cookie_hash: row.cookie_hash, fp_hash: row.fp_hash, last_seen: new Date().toISOString() });
      return id;
    },
    async insertEvent(row) {
      events.push(row);
    },
    async forgetVisitor(hash) {
      for (const [id, v] of visitors) if (v.cookie_hash === hash) visitors.delete(id);
    },
    async rateLimit(_k, _w, max) {
      hits += 1;
      return hits <= max;
    },
    async rollup() {},
    async dailyRows() {
      return [];
    },
    async approxUniques() {
      return 0;
    },
    async chatsStarted() {
      return 0;
    },
    async suitRefs() {
      return [];
    },
    async latestSnapshot() {
      return null;
    },
    async pendingPacks() {
      return 0;
    },
    async aiBudget() {
      return { spent: 0, cap: 9_000_000 };
    },
  };
  return { repo, anon, events, enquiries, visitors, resetHits: () => (hits = 0) };
}

const VISITOR_SECRET = "v".repeat(32);

function analyticsApp() {
  const mem = memoryAnalytics();
  const analytics = createAnalytics({ repo: mem.repo, visitorSecret: VISITOR_SECRET, ipSecret: "i".repeat(32) });
  const app = testApp({ publicRouters: [publicAnalyticsRouter(analytics)] });
  return { mem, analytics, app };
}

describe("POST /events", () => {
  const cookie = "a".repeat(32);

  it("counts an anonymous view on the suit and site rows, with no visitor", async () => {
    const { mem, app } = analyticsApp();
    const res = await request(app).post("/events").set("content-type", "text/plain").send(JSON.stringify({ type: "suit_view", suit_slug: "london-style-ln-01", source: "wa" }));
    expect(res.status).toBe(204);
    expect(mem.anon).toEqual([`suit_view:${SUIT_ID}:wa`]);
    expect(mem.visitors.size).toBe(0);
  });

  it("stores only hashes for an accepted visitor, and re-links by fingerprint after cookies are cleared", async () => {
    const { mem, app } = analyticsApp();
    await request(app).post("/events").send({ type: "suit_view", suit_slug: "london-style-ln-01", source: "direct", visitor: { cookie, fp: "FP1234567890abcdef", consent_version: CONSENT_VERSION } });
    const [v] = [...mem.visitors.values()];
    expect(v!.cookie_hash).toBe(createHmac("sha256", VISITOR_SECRET).update(cookie).digest("hex"));
    expect(JSON.stringify([...mem.visitors.values()])).not.toContain(cookie);
    await request(app).post("/events").send({ type: "suit_view", suit_slug: "london-style-ln-01", source: "direct", visitor: { cookie: "b".repeat(32), fp: "FP1234567890abcdef", consent_version: CONSENT_VERSION } });
    expect(mem.visitors.size).toBe(1);
    expect(mem.events).toHaveLength(2);
  });

  it("records an enquiry code even for anonymous visitors", async () => {
    const { mem, app } = analyticsApp();
    await request(app).post("/events").send({ type: "enquire_click", suit_slug: "london-style-ln-01", source: "direct", code: "K7QM" });
    expect(mem.enquiries.has(`K7QM:${SUIT_ID}`)).toBe(true);
  });

  it("drops bots and unknown suits silently, and ignores bad bodies with 204", async () => {
    const { mem, app } = analyticsApp();
    await request(app).post("/events").set("user-agent", "Googlebot/2.1").send({ type: "suit_view", suit_slug: "london-style-ln-01", source: "direct" });
    await request(app).post("/events").send({ type: "suit_view", suit_slug: "london-style-ln-99", source: "direct" });
    const bad = await request(app).post("/events").send({ type: "payment_success", source: "direct" });
    expect(bad.status).toBe(204);
    expect(mem.anon).toHaveLength(0);
  });

  it("forgets a visitor", async () => {
    const { mem, app } = analyticsApp();
    await request(app).post("/events").send({ type: "suit_view", suit_slug: "london-style-ln-01", source: "direct", visitor: { cookie, consent_version: CONSENT_VERSION } });
    expect(mem.visitors.size).toBe(1);
    expect((await request(app).post("/visitors/forget").send({ cookie })).status).toBe(204);
    expect(mem.visitors.size).toBe(0);
  });
});

function memoryOrders() {
  const orders = new Map<string, OrderRow>();
  const paymentEvents = new Set<string>();
  const repo: OrdersRepo = {
    async suitForOrder(slug) {
      if (slug !== "london-style-ln-01") return null;
      return {
        id: SUIT_ID,
        ref: "LN-01",
        title: "London style",
        style: "london",
        slug,
        price_kobo: 4_500_000,
        variants: [
          { id: VARIANT_ID, colour: "Navy", size: "42", in_stock: true },
          { id: SOLD_OUT_ID, colour: "Navy", size: "44", in_stock: false },
        ],
      };
    },
    async insertOrder(row) {
      const id = randomUUID();
      orders.set(id, {
        id,
        ref: row.ref as string,
        status: "pending",
        suit: { ref: "LN-01", title: "London style", style: "london", slug: "london-style-ln-01" },
        variant: { colour: "Navy", size: "42" },
        qty: row.qty as number,
        amount_kobo: row.amount_kobo as number,
        paid_at: null,
        suit_id: SUIT_ID,
        visitor_id: null,
        created_at: new Date().toISOString(),
        customer_name: row.customer_name as string,
        phone: row.phone as string,
        email: row.email as string,
        delivery_address: row.delivery_address as string,
        notes: null,
        variant_in_stock: true,
      });
      return { id };
    },
    async byRef(ref) {
      return [...orders.values()].find((o) => o.ref === ref) ?? null;
    },
    async byId(id) {
      return orders.get(id) ?? null;
    },
    async setStatus(id, status, _extra, from) {
      const o = orders.get(id)!;
      if (from && !from.includes(o.status)) return false;
      o.status = status as OrderRow["status"];
      return true;
    },
    async markPaid(id) {
      const o = orders.get(id)!;
      if (o.status !== "pending") return false;
      o.status = "paid";
      o.paid_at = new Date().toISOString();
      return true;
    },
    async insertPaymentEvent(row) {
      if (paymentEvents.has(row.provider_event_id)) return "duplicate";
      paymentEvents.add(row.provider_event_id);
      return "inserted";
    },
    async finishPaymentEvent() {},
    async list(status) {
      return [...orders.values()].filter((o) => o.status === status);
    },
  };
  return { repo, orders };
}

const PAYSTACK_KEY = "sk_test_" + "k".repeat(30);

function ordersApp(verifyAmount?: number) {
  const mem = memoryOrders();
  const alerts: string[] = [];
  const serverEvents: string[] = [];
  const verifyCalls: string[] = [];
  const paystack: PaystackPort = {
    async initialize(input) {
      return { authorizationUrl: `https://checkout.paystack.com/${input.reference}` };
    },
    async verify(reference) {
      verifyCalls.push(reference);
      const o = [...mem.orders.values()].find((x) => x.ref === reference)!;
      return { status: "success", amount: verifyAmount ?? o.amount_kobo, currency: "NGN", reference };
    },
  };
  const orders = createOrders({
    repo: mem.repo,
    paystack,
    siteUrl: "http://localhost:3000",
    alert: async (t) => void alerts.push(t),
    audit: async () => {},
    visitorIdForCookie: async () => null,
    serverEvent: async (type) => void serverEvents.push(type),
  });
  const app = testApp({ rawBodyRouters: [webhookRouter(orders, PAYSTACK_KEY)], publicRouters: [publicOrdersRouter(orders, async () => {})] });
  return { mem, alerts, serverEvents, verifyCalls, app };
}

const ORDER_BODY = {
  suit_slug: "london-style-ln-01",
  variant_id: VARIANT_ID,
  qty: 2,
  customer: { name: "Ada Obi", phone: "0803 123 4567", email: "ada@example.com", address: "12 Broad Street, Lagos Island" },
  agreed_to_terms: true,
  price_kobo: 1,
};

function signed(body: object) {
  const raw = JSON.stringify(body);
  return { raw, sig: createHmac("sha512", PAYSTACK_KEY).update(raw).digest("hex") };
}

describe("orders and Paystack", () => {
  it("prices the order from the database, never the browser, and returns the checkout link", async () => {
    const { mem, app, serverEvents } = ordersApp();
    const { price_kobo: _ignored, ...body } = ORDER_BODY;
    const res = await request(app).post("/orders").send(body);
    expect(res.status).toBe(201);
    expect(res.body.order_ref).toMatch(/^FF-[A-Z2-9]{8}$/);
    expect(res.body.checkout_url).toContain("checkout.paystack.com");
    const [o] = [...mem.orders.values()];
    expect(o).toMatchObject({ amount_kobo: 9_000_000, phone: "08031234567", status: "pending" });
    expect(serverEvents).toEqual(["checkout_start"]);
  });

  it("rejects a price field sent by the browser and a sold-out size", async () => {
    const { app } = ordersApp();
    expect((await request(app).post("/orders").send(ORDER_BODY)).status).toBe(400);
    const { price_kobo: _p, ...body } = ORDER_BODY;
    const sold = await request(app).post("/orders").send({ ...body, variant_id: SOLD_OUT_ID });
    expect(sold.status).toBe(422);
  });

  it("webhook: bad signature 401, valid one marks paid once, repeat delivery ignored", async () => {
    const { mem, app, alerts, serverEvents, verifyCalls } = ordersApp();
    const { price_kobo: _p, ...body } = ORDER_BODY;
    const ref = (await request(app).post("/orders").send(body)).body.order_ref as string;
    const event = { event: "charge.success", data: { id: 991, reference: ref, amount: 9_000_000 } };
    const { raw, sig } = signed(event);

    const bad = await request(app).post("/webhooks/paystack").set("content-type", "application/json").set("x-paystack-signature", "0".repeat(128)).send(raw);
    expect(bad.status).toBe(401);
    expect([...mem.orders.values()][0]!.status).toBe("pending");

    const ok = await request(app).post("/webhooks/paystack").set("content-type", "application/json").set("x-paystack-signature", sig).send(raw);
    expect(ok.status).toBe(200);
    expect([...mem.orders.values()][0]!.status).toBe("paid");
    expect(alerts[0]).toMatch(/^Paid: FF-/);
    expect(alerts[0]).not.toContain("Ada");

    await request(app).post("/webhooks/paystack").set("content-type", "application/json").set("x-paystack-signature", sig).send(raw);
    expect(verifyCalls).toHaveLength(1);
    expect(serverEvents.filter((e) => e === "payment_success")).toHaveLength(1);
  });

  it("webhook: an amount mismatch leaves the order pending and alerts", async () => {
    const { mem, app, alerts } = ordersApp(100);
    const { price_kobo: _p, ...body } = ORDER_BODY;
    const ref = (await request(app).post("/orders").send(body)).body.order_ref as string;
    const { raw, sig } = signed({ event: "charge.success", data: { id: 5, reference: ref } });
    expect((await request(app).post("/webhooks/paystack").set("content-type", "application/json").set("x-paystack-signature", sig).send(raw)).status).toBe(200);
    expect([...mem.orders.values()][0]!.status).toBe("pending");
    expect(alerts[0]).toContain("Payment check failed");
  });

  it("webhook: an unknown reference answers 200 and changes nothing", async () => {
    const { app } = ordersApp();
    const { raw, sig } = signed({ event: "charge.success", data: { id: 6, reference: "FF-ZZZZZZZZ" } });
    expect((await request(app).post("/webhooks/paystack").set("content-type", "application/json").set("x-paystack-signature", sig).send(raw)).status).toBe(200);
  });

  it("the order page status hides customer details and verify confirms a pending order", async () => {
    const { app } = ordersApp();
    const { price_kobo: _p, ...body } = ORDER_BODY;
    const ref = (await request(app).post("/orders").send(body)).body.order_ref as string;
    const view = await request(app).get(`/orders/${ref}`);
    expect(OrderView.parse(view.body).status).toBe("pending");
    expect(JSON.stringify(view.body)).not.toContain("ada@example.com");
    const verified = await request(app).post(`/orders/${ref}/verify`);
    expect(OrderView.parse(verified.body).status).toBe("paid");
    expect((await request(app).get("/orders/FF-bad")).status).toBe(404);
  });

  it("signature helper rejects different lengths", () => {
    expect(validPaystackSignature("sk_test_x", Buffer.from("{}"), "abc")).toBe(false);
  });
});

describe("changing room", () => {
  async function setup(settings: Record<string, unknown>, draws: ("ok" | "safety")[] = ["ok"]) {
    const gen = memoryGenRepo({ tryon_enabled: true, tryon_monthly_cap_usd_micro: 2_000_000, tryon_per_visitor_per_day: 3, tryon_per_address_per_day: 10, ...settings });
    const store = memoryStorage();
    store.files.set("public-suits/s1/final-1080.webp", await sharp({ create: { width: 600, height: 800, channels: 3, background: "#5b2a6e" } }).webp().toBuffer());
    const ai = scriptedGemini({ draws });
    const tryon = createTryon({
      gen: gen.repo,
      storage: store.storage,
      gemini: ai.gemini,
      suitBySlug: async (slug) => (slug === "london-style-ln-01" ? { id: SUIT_ID, final_path: "s1/final", final_widths: [480, 1080] } : null),
      visitorSecret: VISITOR_SECRET,
      ipSecret: "i".repeat(32),
      enabled: settings.tryon_enabled !== false,
      monthlyCapUsdMicro: (settings.tryon_monthly_cap_usd_micro as number | undefined) ?? 2_000_000,
    });
    const app = testApp({ rawBodyRouters: [tryonRouter(tryon, async () => {})] });
    return { gen, ai, app };
  }

  const photo = async () => (await sharp({ create: { width: 800, height: 1000, channels: 3, background: "#c8a27c" } }).jpeg().toBuffer()).toString("base64");

  it("returns a labelled preview and stores no photo or prompt", async () => {
    const { gen, ai, app } = await setup({});
    const res = await request(app).post("/tryon").send({ suit_slug: "london-style-ln-01", photo_base64: await photo(), mime: "image/jpeg", agreed: true, over_18: true });
    expect(res.status).toBe(200);
    expect(res.body.label).toBe("AI-styled preview");
    expect((await sharp(Buffer.from(res.body.image_base64, "base64")).metadata()).format).toBe("jpeg");
    expect(ai.calls.draw).toBe(1);
    const [row] = [...gen.rows.values()];
    expect(row).toMatchObject({ kind: "tryon", status: "succeeded" });
    expect(JSON.stringify(row)).not.toContain(res.body.image_base64.slice(0, 40));
    expect((row as Record<string, unknown>).final_prompt).toBeUndefined();
  });

  it("refuses without both boxes ticked, when switched off, and over the address limit", async () => {
    const off = await setup({ tryon_enabled: false });
    const body = { suit_slug: "london-style-ln-01", photo_base64: await photo(), mime: "image/jpeg", agreed: true, over_18: true };
    expect((await request(off.app).post("/tryon").send(body)).status).toBe(503);
    expect((await request(off.app).get("/config")).body).toEqual({ tryon_enabled: false });

    const on = await setup({ tryon_per_address_per_day: 1 });
    expect((await request(on.app).post("/tryon").send({ ...body, over_18: false })).status).toBe(400);
    expect((await request(on.app).post("/tryon").send(body)).status).toBe(200);
    expect((await request(on.app).post("/tryon").send(body)).status).toBe(429);
  });

  it("blocks at the changing-room budget and maps a safety block to a kind message", async () => {
    const poor = await setup({ tryon_monthly_cap_usd_micro: 0 });
    const body = { suit_slug: "london-style-ln-01", photo_base64: await photo(), mime: "image/jpeg", agreed: true, over_18: true };
    expect((await request(poor.app).post("/tryon").send(body)).status).toBe(503);
    const blocked = await setup({}, ["safety"]);
    const res = await request(blocked.app).post("/tryon").send(body);
    expect(res.status).toBe(422);
    expect([...blocked.gen.rows.values()][0]!.status).toBe("failed_safety");
  });
});

void AdminSuitDetail;

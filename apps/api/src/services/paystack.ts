import { createHmac, timingSafeEqual } from "node:crypto";

export interface PaystackPort {
  initialize(input: { email: string; amount: number; reference: string; callbackUrl: string; metadata: Record<string, string> }): Promise<{ authorizationUrl: string }>;
  verify(reference: string): Promise<{ status: string; amount: number; currency: string; reference: string }>;
}

export class PaystackFailure extends Error {
  code: string;
  constructor(code: string) {
    super(`paystack: ${code}`);
    this.code = code;
  }
}

export function createPaystack(opts: { secretKey: string; fetchImpl?: typeof fetch }): PaystackPort {
  const doFetch = opts.fetchImpl ?? fetch;
  const headers = { authorization: `Bearer ${opts.secretKey}`, "content-type": "application/json" };

  async function call<T>(path: string, init: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await doFetch(`https://api.paystack.co${path}`, { ...init, headers, signal: AbortSignal.timeout(15_000) });
    } catch {
      throw new PaystackFailure("network");
    }
    const body = (await res.json().catch(() => ({}))) as { status?: boolean; message?: string; data?: T };
    if (!res.ok || !body.status || !body.data) throw new PaystackFailure((body.message ?? `http_${res.status}`).slice(0, 120));
    return body.data;
  }

  return {
    async initialize(input) {
      const data = await call<{ authorization_url: string }>("/transaction/initialize", {
        method: "POST",
        body: JSON.stringify({
          email: input.email,
          amount: input.amount,
          currency: "NGN",
          reference: input.reference,
          callback_url: input.callbackUrl,
          metadata: input.metadata,
        }),
      });
      return { authorizationUrl: data.authorization_url };
    },
    async verify(reference) {
      return call<{ status: string; amount: number; currency: string; reference: string }>(`/transaction/verify/${encodeURIComponent(reference)}`, { method: "GET" });
    },
  };
}

export function validPaystackSignature(secretKey: string, rawBody: Buffer, header: string | undefined): boolean {
  if (!header) return false;
  const expected = Buffer.from(createHmac("sha512", secretKey).update(rawBody).digest("hex"));
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

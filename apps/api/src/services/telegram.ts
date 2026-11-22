export class TelegramFailure extends Error {
  code: string;
  constructor(code: string) {
    super(`telegram: ${code}`);
    this.code = code;
  }
}

export interface TelegramPort {
  sendPhoto(chatId: string, photo: Buffer, caption: string): Promise<{ messageId: string }>;
  sendMessage(chatId: string, text: string): Promise<void>;
  memberCount(chatId: string): Promise<number>;
}

type TgReply = { ok: boolean; result?: { message_id: number } | number; error_code?: number; description?: string; parameters?: { retry_after?: number } };

export function createTelegram(opts: {
  token: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}): TelegramPort {
  const doFetch = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const base = `https://api.telegram.org/bot${opts.token}`;

  async function call(method: string, body: () => FormData | string, json: boolean): Promise<TgReply> {
    for (let attempt = 0; attempt < 2; attempt++) {
      let reply: TgReply;
      try {
        const res = await doFetch(`${base}/${method}`, {
          method: "POST",
          headers: json ? { "content-type": "application/json" } : undefined,
          body: body(),
          signal: AbortSignal.timeout(20_000),
        });
        reply = (await res.json().catch(() => ({ ok: false, description: `http_${res.status}` }))) as TgReply;
      } catch {
        throw new TelegramFailure("network");
      }
      if (reply.ok) return reply;
      const wait = reply.parameters?.retry_after;
      if (reply.error_code === 429 && attempt === 0 && wait !== undefined && wait <= 10) {
        await sleep(wait * 1000);
        continue;
      }
      throw new TelegramFailure(reply.error_code === 429 ? "rate_limited" : (reply.description ?? "unknown").slice(0, 120));
    }
    throw new TelegramFailure("rate_limited");
  }

  return {
    async sendPhoto(chatId, photo, caption) {
      const reply = await call(
        "sendPhoto",
        () => {
          const form = new FormData();
          form.set("chat_id", chatId);
          form.set("caption", caption);
          form.set("photo", new Blob([new Uint8Array(photo)], { type: "image/jpeg" }), "suit.jpg");
          return form;
        },
        false,
      );
      const result = reply.result as { message_id?: number } | undefined;
      return { messageId: String(result?.message_id ?? "") };
    },
    async sendMessage(chatId, text) {
      await call("sendMessage", () => JSON.stringify({ chat_id: chatId, text }), true);
    },
    async memberCount(chatId) {
      const reply = await call("getChatMemberCount", () => JSON.stringify({ chat_id: chatId }), true);
      return Number(reply.result ?? 0);
    },
  };
}

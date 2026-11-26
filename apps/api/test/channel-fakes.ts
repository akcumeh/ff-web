import { randomUUID } from "node:crypto";
import type { ChannelRepo, PostRow } from "../src/services/channels.ts";
import { TelegramFailure, type TelegramPort } from "../src/services/telegram.ts";

export function memoryChannelRepo() {
    const posts = new Map<string, PostRow>();
    const repo: ChannelRepo = {
        async ensurePost(suitId, platform, caption) {
            const found = [...posts.values()].find((p) => p.suit_id === suitId && p.platform === platform);
            if (found) return { ...found };
            const row: PostRow = { id: randomUUID(), suit_id: suitId, platform, caption, status: "pending", external_id: null, error: null, posted_at: null };
            posts.set(row.id, row);
            return { ...row };
        },
        async getPost(id) {
            const p = posts.get(id);
            return p ? { ...p } : null;
        },
        async postsForSuit(suitId) {
            return [...posts.values()].filter((p) => p.suit_id === suitId);
        },
        async updatePost(id, patch) {
            Object.assign(posts.get(id)!, patch);
        },
        async pendingPacks() {
            return [...posts.values()]
                .filter((p) => p.platform === "whatsapp_pack" && p.status === "pending")
                .map((p) => ({ ...p, suit_ref: "LN-01", suit_title: "London style", suit_slug: "london-style-ln-01", final_path: "x/final" }));
        },
    };
    return { repo, posts };
}

export function fakeTelegram(script: ("ok" | "fail")[] = ["ok"]) {
    const sent: { chatId: string; caption: string; bytes: number }[] = [];
    const messages: { chatId: string; text: string }[] = [];
    const telegram: TelegramPort = {
        async sendPhoto(chatId, photo, caption) {
            const step = script.shift() ?? "ok";
            if (step === "fail") throw new TelegramFailure("Bad Request: chat not found");
            sent.push({ chatId, caption, bytes: photo.length });
            return { messageId: String(100 + sent.length) };
        },
        async sendMessage(chatId, text) {
            messages.push({ chatId, text });
        },
        async memberCount() {
            return 42;
        },
    };
    return { telegram, sent, messages };
}

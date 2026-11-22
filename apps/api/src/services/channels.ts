import { buildCaption } from "@ff/shared";
import { HttpError } from "../lib/errors.ts";
import type { AdminSuitRow, AuditEntry, StoragePort } from "./admin-catalogue.ts";
import { TelegramFailure, type TelegramPort } from "./telegram.ts";

export type PostRow = {
  id: string;
  suit_id: string;
  platform: "telegram" | "whatsapp_pack";
  caption: string;
  status: "pending" | "posted" | "failed";
  external_id: string | null;
  error: string | null;
  posted_at: string | null;
};

export type PendingPack = PostRow & { suit_ref: string; suit_title: string; suit_slug: string; final_path: string | null };

export interface ChannelRepo {
  ensurePost(suitId: string, platform: PostRow["platform"], caption: string): Promise<PostRow>;
  getPost(id: string): Promise<PostRow | null>;
  postsForSuit(suitId: string): Promise<PostRow[]>;
  updatePost(id: string, patch: Partial<PostRow>): Promise<void>;
  pendingPacks(): Promise<PendingPack[]>;
}

export type ChannelDeps = {
  repo: ChannelRepo;
  storage: StoragePort;
  telegram: TelegramPort | null;
  channelId: string | undefined;
  alertChatId: string | undefined;
  siteUrl: string;
  audit: (e: AuditEntry) => Promise<void>;
};

export const channelImagePath = (finalPath: string) => `${finalPath}-channel.jpg`;
export const packImagePath = (finalPath: string) => `${finalPath}-pack.jpg`;

export function createChannels(deps: ChannelDeps) {
  async function alert(text: string) {
    if (!deps.telegram || !deps.alertChatId) return;
    await deps.telegram.sendMessage(deps.alertChatId, text).catch(() => {});
  }

  async function postTelegram(post: PostRow, finalPath: string | null, ref: string): Promise<PostRow["status"]> {
    if (!deps.telegram || !deps.channelId) {
      await deps.repo.updatePost(post.id, { status: "failed", error: "Telegram is not set up on the server" });
      return "failed";
    }
    if (!finalPath) {
      await deps.repo.updatePost(post.id, { status: "failed", error: "No published photo" });
      return "failed";
    }
    try {
      const photo = await deps.storage.download("public-suits", channelImagePath(finalPath));
      const sent = await deps.telegram.sendPhoto(deps.channelId, photo, post.caption);
      await deps.repo.updatePost(post.id, { status: "posted", external_id: sent.messageId, error: null, posted_at: new Date().toISOString() });
      return "posted";
    } catch (err) {
      const code = err instanceof TelegramFailure ? err.code : "internal";
      await deps.repo.updatePost(post.id, { status: "failed", error: code.slice(0, 300) });
      await alert(`Telegram post for ${ref} failed: ${code}. Open the admin and press Retry.`);
      return "failed";
    }
  }

  const finalOf = (s: AdminSuitRow) => s.images.find((i) => i.kind === "final" && i.is_cover)?.storage_path ?? null;

  return {
    async afterPublish(s: AdminSuitRow, repost: boolean) {
      const caption = (platform: "telegram" | "whatsapp_pack") => buildCaption({ ...s, variants: s.variants }, platform, deps.siteUrl);
      const tg = await deps.repo.ensurePost(s.id, "telegram", caption("telegram"));
      const pack = await deps.repo.ensurePost(s.id, "whatsapp_pack", caption("whatsapp_pack"));
      if (repost) {
        await deps.repo.updatePost(tg.id, { status: "pending", caption: caption("telegram"), error: null });
        await deps.repo.updatePost(pack.id, { status: "pending", caption: caption("whatsapp_pack"), posted_at: null });
        tg.status = "pending";
        tg.caption = caption("telegram");
      }
      const telegram = tg.status === "posted" ? "posted" : await postTelegram(tg, finalOf(s), s.ref);
      return { telegram, pack: repost ? "pending" : pack.status };
    },

    async retry(adminId: string, postId: string, suit: (id: string) => Promise<AdminSuitRow | null>) {
      const post = await deps.repo.getPost(postId);
      if (!post) throw new HttpError(404, "not_found", "No post with that id.");
      if (post.platform !== "telegram") throw new HttpError(409, "conflict", "Only a Telegram post can be retried.");
      if (post.status === "posted") throw new HttpError(409, "conflict", "This post is already on Telegram.");
      const s = await suit(post.suit_id);
      const status = await postTelegram(post, s ? finalOf(s) : null, s?.ref ?? "a suit");
      await deps.audit({ adminId, action: "post.retry", targetType: "post", targetId: postId, detail: { status } });
      return (await deps.repo.getPost(postId))!;
    },

    async markPosted(adminId: string, postId: string) {
      const post = await deps.repo.getPost(postId);
      if (!post) throw new HttpError(404, "not_found", "No post with that id.");
      if (post.platform !== "whatsapp_pack") throw new HttpError(409, "conflict", "Only a WhatsApp pack is marked by hand.");
      if (post.status !== "posted") {
        await deps.repo.updatePost(postId, { status: "posted", posted_at: new Date().toISOString() });
        await deps.audit({ adminId, action: "post.mark_posted", targetType: "post", targetId: postId });
      }
      return (await deps.repo.getPost(postId))!;
    },

    postsForSuit: (suitId: string) => deps.repo.postsForSuit(suitId),

    async pending() {
      const rows = await deps.repo.pendingPacks();
      return rows.map((r) => ({
        id: r.id,
        suit_id: r.suit_id,
        suit_ref: r.suit_ref,
        suit_title: r.suit_title,
        suit_slug: r.suit_slug,
        caption: r.caption,
        image_url: r.final_path ? deps.storage.publicUrl("public-suits", packImagePath(r.final_path)) : null,
      }));
    },
  };
}

export type Channels = ReturnType<typeof createChannels>;

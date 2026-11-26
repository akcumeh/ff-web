import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChannelRepo, PendingPack, PostRow } from "../services/channels.ts";

const POST_SELECT = "id, suit_id, platform, caption, status, external_id, error, posted_at";

function check(error: { message: string } | null, what: string) {
    if (error) throw new Error(`${what} failed: ${error.message}`);
}

export function supabaseChannelRepo(db: SupabaseClient): ChannelRepo {
    return {
        async ensurePost(suitId, platform, caption) {
            const { data: existing, error: e1 } = await db.from("channel_posts").select(POST_SELECT).eq("suit_id", suitId).eq("platform", platform).maybeSingle();
            check(e1, "post lookup");
            if (existing) return existing as PostRow;
            const { data, error } = await db
                .from("channel_posts")
                .upsert({ suit_id: suitId, platform, caption, status: "pending" }, { onConflict: "suit_id,platform", ignoreDuplicates: false })
                .select(POST_SELECT)
                .single();
            check(error, "post insert");
            return data as PostRow;
        },
        async getPost(id) {
            const { data, error } = await db.from("channel_posts").select(POST_SELECT).eq("id", id).maybeSingle();
            check(error, "post read");
            return data as PostRow | null;
        },
        async postsForSuit(suitId) {
            const { data, error } = await db.from("channel_posts").select(POST_SELECT).eq("suit_id", suitId).order("platform");
            check(error, "post list");
            return (data ?? []) as PostRow[];
        },
        async updatePost(id, patch) {
            const { error } = await db.from("channel_posts").update(patch).eq("id", id);
            check(error, "post update");
        },
        async pendingPacks() {
            const { data, error } = await db
                .from("channel_posts")
                .select(`${POST_SELECT}, suits!inner(ref, title, slug, status, suit_images(storage_path, kind, is_cover))`)
                .eq("platform", "whatsapp_pack")
                .eq("status", "pending")
                .eq("suits.status", "published")
                .order("created_at", { ascending: true });
            check(error, "pending packs");
            type Raw = PostRow & { suits: { ref: string; title: string; slug: string; suit_images: { storage_path: string; kind: string; is_cover: boolean }[] } };
            return ((data ?? []) as unknown as Raw[]).map(({ suits, ...p }): PendingPack => ({
                ...p,
                suit_ref: suits.ref,
                suit_title: suits.title,
                suit_slug: suits.slug,
                final_path: suits.suit_images.find((i) => i.kind === "final" && i.is_cover)?.storage_path ?? null,
            }));
        },
    };
}

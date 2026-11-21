import type { SupabaseClient } from "@supabase/supabase-js";
import type { StoragePort } from "../services/admin-catalogue.ts";

export function supabaseStorage(db: SupabaseClient): StoragePort {
  return {
    async signUpload(bucket, path) {
      const { data, error } = await db.storage.from(bucket).createSignedUploadUrl(path);
      if (error || !data) throw new Error(`sign upload failed: ${error?.message}`);
      return { signedUrl: data.signedUrl, token: data.token };
    },
    async download(bucket, path) {
      const { data, error } = await db.storage.from(bucket).download(path);
      if (error || !data) throw new Error(`download failed: ${error?.message}`);
      return Buffer.from(await data.arrayBuffer());
    },
    async upload(bucket, path, body, contentType, cacheControl) {
      const { error } = await db.storage.from(bucket).upload(path, body, { contentType, cacheControl, upsert: true });
      if (error) throw new Error(`upload failed: ${error.message}`);
    },
    async remove(bucket, paths) {
      if (!paths.length) return;
      const { error } = await db.storage.from(bucket).remove(paths);
      if (error) throw new Error(`remove failed: ${error.message}`);
    },
    async signedUrl(bucket, path, seconds) {
      const { data, error } = await db.storage.from(bucket).createSignedUrl(path, seconds);
      if (error || !data) throw new Error(`signed url failed: ${error?.message}`);
      return data.signedUrl;
    },
    publicUrl(bucket, path) {
      return db.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    },
  };
}

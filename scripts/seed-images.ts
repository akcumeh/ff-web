import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_DB_URL ?? "http://127.0.0.1:54321";
const key = process.env.SUPABASE_SEC_KEY;
const photosDir = process.argv[2] ?? "docs/design-system/photos";

if (!key?.startsWith("sb_secret_")) {
    console.error("Set SUPABASE_SEC_KEY to the local secret key (npx supabase status).");
    process.exit(1);
}
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(url)) {
    console.error("seed-images only runs against a local Supabase.");
    process.exit(1);
}

const PHOTOS: Record<string, { file: string; alt: string }> = {
    Cream: { file: "cream-coat.jpg", alt: "Model in a long cream jacquard jacket over a matching dress" },
    Purple: { file: "purple-suit.jpg", alt: "Model in a purple skirt suit with a lace-panelled jacket" },
    Lilac: { file: "lilac-jacket.jpg", alt: "Model in a lilac herringbone jacket over a purple dress" },
};
const WIDTHS = [320, 480, 768, 1080];

const supabase = createClient(url, key, { auth: { persistSession: false } });

const { data: suits, error } = await supabase
    .from("suits")
    .select("id, ref, suit_variants(colour)")
    .order("ref");
if (error) throw error;

for (const suit of suits) {
    const colour = suit.suit_variants.map((v) => v.colour).find((c) => c in PHOTOS) ?? "Cream";
    const photo = PHOTOS[colour]!;
    const source = await readFile(join(photosDir, photo.file));
    const meta = await sharp(source).metadata();
    const fullWidth = meta.width ?? 480;
    const widths = WIDTHS.filter((w) => w <= fullWidth);
    if (!widths.includes(fullWidth) && fullWidth < 1080) widths.push(fullWidth);

    const imageId = randomUUID();
    const base = `${suit.id}/${imageId}`;
    let largest = { width: 0, height: 0 };

    for (const w of widths) {
        const { data: out, info } = await sharp(source).rotate().resize({ width: w }).webp({ quality: 78 }).toBuffer({ resolveWithObject: true });
        const { error: upError } = await supabase.storage.from("public-suits").upload(`${base}-${w}.webp`, out, {
            contentType: "image/webp",
            cacheControl: "31536000",
            upsert: true,
        });
        if (upError) throw upError;
        if (info.width > largest.width) largest = { width: info.width, height: info.height };
    }

    const blur = await sharp(source).resize({ width: 16 }).webp({ quality: 40 }).toBuffer();

    await supabase.from("suit_images").delete().eq("suit_id", suit.id);
    const { error: insError } = await supabase.from("suit_images").insert({
        id: imageId,
        suit_id: suit.id,
        kind: "final",
        bucket: "public-suits",
        storage_path: base,
        widths,
        width: largest.width,
        height: largest.height,
        blur_data: `data:image/webp;base64,${blur.toString("base64")}`,
        alt_text: photo.alt,
        is_cover: true,
    });
    if (insError) throw insError;
    console.log(`${suit.ref}: ${photo.file} -> ${widths.join(", ")}px`);
}

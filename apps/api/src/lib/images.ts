import sharp from "sharp";
import { HttpError } from "./errors.ts";

const LIMIT_INPUT_PIXELS = 40_000_000;
const ALLOWED = new Set(["jpeg", "png", "webp"]);
const PUBLIC_WIDTHS = [480, 768, 1080, 1600];

export type Processed = { data: Buffer; width: number; height: number };
export type PublicSet = { files: { w: number; data: Buffer }[]; width: number; height: number; blur: string };

export async function normalizeOriginal(input: Buffer): Promise<Processed> {
    let format: string | undefined;
    try {
        format = (await sharp(input, { limitInputPixels: LIMIT_INPUT_PIXELS }).metadata()).format;
    } catch {
        format = undefined;
    }
    if (!format || !ALLOWED.has(format)) {
        throw new HttpError(422, "rule_failed", "One of the photos is not a JPEG, PNG or WebP image.", [{ path: "images", message: "image_type" }]);
    }
    const { data, info } = await sharp(input, { limitInputPixels: LIMIT_INPUT_PIXELS })
        .rotate()
        .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
}

export async function makePublicSet(source: Buffer): Promise<PublicSet> {
    const meta = await sharp(source, { limitInputPixels: LIMIT_INPUT_PIXELS }).metadata();
    const full = meta.width ?? 1080;
    const widths = PUBLIC_WIDTHS.filter((w) => w < full);
    widths.push(Math.min(full, 1600));
    const files: PublicSet["files"] = [];
    let largest = { width: 0, height: 0 };
    for (const w of [...new Set(widths)]) {
        const { data, info } = await sharp(source).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
        files.push({ w, data });
        if (info.width >= largest.width) largest = { width: info.width, height: info.height };
    }
    const blur = await sharp(source).resize({ width: 16 }).webp({ quality: 40 }).toBuffer();
    return { files, width: largest.width, height: largest.height, blur: `data:image/webp;base64,${blur.toString("base64")}` };
}

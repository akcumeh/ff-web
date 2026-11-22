import { styleLabel } from "./enums.ts";

export type CaptionSuit = {
  style: "london" | "turkey";
  ref: string;
  slug: string;
  price_kobo: number;
  variants: { colour: string; size: string; in_stock: boolean }[];
};

export type CaptionPlatform = "telegram" | "whatsapp_pack";

const TELEGRAM_LIMIT = 1024;

export function captionPrice(kobo: number): string {
  const naira = Math.floor(kobo / 100);
  const rest = kobo % 100;
  const whole = new Intl.NumberFormat("en-NG").format(naira);
  return rest ? `₦${whole}.${String(rest).padStart(2, "0")}` : `₦${whole}`;
}

export function buildCaption(suit: CaptionSuit, platform: CaptionPlatform, siteUrl: string): string {
  const inStock = suit.variants.filter((v) => v.in_stock);
  const colours = [...new Set(inStock.map((v) => v.colour))];
  const sizes = [...new Set(inStock.map((v) => v.size))];
  const link = `${siteUrl.replace(/\/+$/, "")}/suits/${suit.slug}?src=${platform === "telegram" ? "tg" : "wa"}`;

  const render = (colourText: string) =>
    [
      `New in: ${styleLabel[suit.style]}, Ref ${suit.ref}`,
      `Colours: ${colourText}`,
      `Sizes: ${sizes.join(", ")}`,
      `Price: ${captionPrice(suit.price_kobo)}`,
      `See it and order: ${link}`,
    ].join("\n");

  const full = render(colours.join(", "));
  if (platform !== "telegram" || full.length <= TELEGRAM_LIMIT) return full;
  return render(`${colours.slice(0, 8).join(", ")} and more on the page`);
}

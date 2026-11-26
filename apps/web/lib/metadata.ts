import type { Metadata } from "next";
import { siteUrl } from "./public-env";

const DEFAULT_IMAGE = "/og-default.png";

export function buildMetadata(input: { title: string; description: string; path: string; image?: string; noindex?: boolean }): Metadata {
    const base = siteUrl();
    const url = `${base}${input.path}`;
    const title = input.title === "Frankie Suits" ? input.title : `${input.title} | Frankie Suits`;
    const image = input.image ?? `${base}${DEFAULT_IMAGE}`;
    return {
        title,
        description: input.description,
        alternates: { canonical: url },
        openGraph: { title, description: input.description, url, siteName: "Frankie Suits", type: "website", locale: "en_NG", images: [{ url: image }] },
        twitter: { card: "summary_large_image", title, description: input.description, images: [image] },
        ...(input.noindex ? { robots: { index: false, follow: false } } : {}),
    };
}

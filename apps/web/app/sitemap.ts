import type { MetadataRoute } from "next";
import { SitemapEntry } from "@ff/shared";
import { apiInternalUrl, siteUrl } from "@/lib/public-env";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const pages = ["", "/gallery", "/wholesale", "/about", "/changing-room", "/privacy", "/delivery-and-refunds"].map((p) => ({
    url: `${base}${p}`,
    changeFrequency: p === "" || p === "/gallery" ? ("daily" as const) : ("monthly" as const),
  }));
  let suits: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(`${apiInternalUrl()}/suits/sitemap`, { next: { revalidate: 3600, tags: ["suits"] }, signal: AbortSignal.timeout(10_000) });
    if (res.ok) {
      suits = SitemapEntry.array()
        .parse(await res.json())
        .map((s) => ({ url: `${base}/suits/${s.slug}`, lastModified: s.updated_at, changeFrequency: "weekly" as const }));
    }
  } catch {
    suits = [];
  }
  return [...pages, ...suits];
}

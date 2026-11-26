import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/public-env";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/orders"] }],
        sitemap: `${siteUrl()}/sitemap.xml`,
    };
}

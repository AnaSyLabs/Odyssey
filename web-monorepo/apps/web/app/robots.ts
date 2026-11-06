import type { MetadataRoute } from "next";
import { siteUrl } from "./sitemap";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/capture", "/enroll"] },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}

import type { MetadataRoute } from "next";

// Vercel sets VERCEL_PROJECT_PRODUCTION_URL (host only) on every deployment.
export const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

const pages = ["", "/docs", "/device", "/wiring", "/datasets", "/explore", "/activity", "/analytics", "/mockups"];

export default function sitemap(): MetadataRoute.Sitemap {
  return pages.map((p) => ({ url: `${siteUrl}${p}` }));
}

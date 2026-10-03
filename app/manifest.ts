import type { MetadataRoute } from "next";

/**
 * Installable app (PRD §4.27). Served at /manifest.webmanifest, which the
 * edge gate lets through: browsers fetch the manifest without the session
 * cookie, and a redirect to /login here silently makes the app uninstallable.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ursa",
    short_name: "Ursa",
    description: "Markdown notes that style themselves as you type.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    // The forest theme's canvas, so the launch screen matches the default app.
    background_color: "#11161d",
    theme_color: "#11161d",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

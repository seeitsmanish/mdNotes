import type { MetadataRoute } from "next";

/**
 * Installable app (PRD §4.27). Served at /manifest.webmanifest, which the
 * edge gate lets through: browsers fetch the manifest without the session
 * cookie, and a redirect to /login here silently makes the app uninstallable.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "mdNotes",
    short_name: "mdNotes",
    description: "Markdown notes that style themselves as you type.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    // The forest theme's canvas, so the launch screen matches the default app.
    background_color: "#11161d",
    theme_color: "#11161d",
    // The phone's share sheet lists mdNotes; what is shared opens as a preview
    // to save (PRD §4.31). GET, because a share carries no files here.
    share_target: {
      action: "/share",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
    // Long-press the home-screen icon (PRD §4.31).
    shortcuts: [
      { name: "New note", short_name: "New", url: "/?new=1", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Search notes", short_name: "Search", url: "/?search=1", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Quick note to Inbox", short_name: "Quick note", url: "/?capture=1", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

import type { Metadata, Viewport } from "next";
import "./globals.css";
// Writing typefaces (PRD §4.64): @font-face rules only; a file downloads the
// first time a note is shown in that face.
import "@fontsource-variable/literata";
import "@fontsource-variable/literata/wght-italic.css";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/400-italic.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "@fontsource-variable/nunito";
import "@fontsource-variable/nunito/wght-italic.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/400-italic.css";
import "@fontsource/ibm-plex-mono/600.css";
import type { CSSProperties } from "react";
import { headers } from "next/headers";
import { TooltipProvider } from "@/components/ui/tooltip";
import { hasSession } from "@/lib/auth/session";
import { getSettingsForRequest } from "@/lib/db/settings";
import type { AppSettings } from "@/lib/settings/schema";
import type { HeadingMode } from "@/lib/store/useUiStore";
import { appearanceVars, DARK_THEMES, isDarkTheme } from "@/lib/theme";
import { faviconHref } from "@/lib/favicon";

export const metadata: Metadata = {
  title: "mdNotes",
  description: "Markdown notes that style themselves as you type.",
  // iOS ignores most of the manifest; these make "Add to Home Screen" open
  // full-screen with the right name (PRD §4.27).
  appleWebApp: { capable: true, title: "mdNotes", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#11161d",
};

/**
 * The appearance the server knows, for a signed-in request: rendered straight
 * into <html> so the first paint is already right (PRD R6.3). Signed out, or
 * with the database unreachable, there is nothing to know and the cache below
 * takes over.
 */
async function serverAppearance(): Promise<AppSettings | null> {
  try {
    if (!(await hasSession())) return null;
    return await getSettingsForRequest();
  } catch {
    return null;
  }
}

/**
 * Before first paint, and only for what the server did not already render.
 *
 * The server's copy wins when there is one: this browser's cached theme can
 * be stale — changed on another device, or cleared — and painting the cache
 * first then correcting it was the old-theme splash. The cache still covers
 * the sign-in page. The `dark` class for shared components is settled here
 * too, including for "system", which only the browser can resolve.
 */
const THEME_BOOTSTRAP = `
(function () {
  var root = document.documentElement;
  var dark = ${JSON.stringify([...DARK_THEMES])};
  try {
    if (!root.hasAttribute("data-ursa-appearance")) {
      var stored = JSON.parse(localStorage.getItem("ursa.ui") || "{}");
      var theme = (stored && stored.state && stored.state.theme) || "forest";
      if (theme !== "system") root.setAttribute("data-theme", theme);
    }
  } catch (error) {
    root.setAttribute("data-theme", "forest");
  }
  try {
    // Hiding titles for screen sharing must hold from the first frame, or a
    // reload mid-call shows the list (PRD R59.4).
    var ui = JSON.parse(localStorage.getItem("ursa.ui") || "{}");
    if (ui && ui.state && ui.state.privacyMode) root.setAttribute("data-ursa-privacy", "");
  } catch (error) {}
  var current = root.getAttribute("data-theme");
  var isDark = current
    ? dark.indexOf(current) !== -1
    : window.matchMedia("(prefers-color-scheme: dark)").matches;
  root.classList.toggle("dark", isDark);
})();
`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Set by proxy.ts; the bootstrap is an inline script, so it must carry it
  // or the CSP refuses it (PRD §4.34).
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const settings = await serverAppearance();
  const vars = settings
    ? appearanceVars({
        brandColor: settings.brandColor,
        radius: settings.radius,
        headingMode: settings.headingMode as HeadingMode,
      })
    : null;
  const style = vars
    ? (Object.fromEntries(Object.entries(vars).filter(([, value]) => value !== null)) as CSSProperties)
    : undefined;
  const dark = settings ? isDarkTheme(settings.theme) : null;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-theme={settings && settings.theme !== "system" ? settings.theme : undefined}
      data-ursa-appearance={settings ? "server" : undefined}
      className={dark ? "dark" : undefined}
      style={style}
    >
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        {/* The tab icon in this account's theme and accent (PRD §4.60). */}
        {settings ? (
          <link rel="icon" type="image/svg+xml" href={faviconHref(settings.theme, settings.brandColor)} />
        ) : null}
      </head>
      <body className="antialiased">
        <TooltipProvider delay={400}>{children}</TooltipProvider>
      </body>
    </html>
  );
}

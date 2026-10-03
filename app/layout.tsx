import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";

export const metadata: Metadata = {
  title: "Ursa",
  description: "Tag-organised, single-pane markdown notes.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * Applies a stored theme choice before first paint. Without this the app would
 * render in the system theme and then flip, which is exactly the flash the
 * two-theme setup in globals.css is built to avoid.
 */
const THEME_BOOTSTRAP = `
try {
  var stored = JSON.parse(localStorage.getItem("ursa.ui") || "{}");
  var theme = (stored && stored.state && stored.state.theme) || "forest";
  // "system" stamps nothing, leaving prefers-color-scheme to decide.
  if (theme !== "system") document.documentElement.setAttribute("data-theme", theme);
} catch (error) {
  document.documentElement.setAttribute("data-theme", "forest");
}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="antialiased">
        <TooltipProvider delay={400}>{children}</TooltipProvider>
      </body>
    </html>
  );
}

/**
 * The tab icon, drawn in the current theme (PRD §4.60).
 *
 * The same page-with-a-folded-corner as `app/icon.svg`, recoloured: the tile
 * is the theme's canvas, the page its brand (or the chosen accent), and the
 * text lines are cut back out in canvas so they read at 16px. The server
 * renders it into <head> from the saved settings, so the first paint already
 * has the right icon; the client swaps it when the appearance changes.
 *
 * The installed app's home-screen icon comes from the manifest and is fixed
 * by the operating system at install time, so it stays the forest icon.
 */

export interface ThemeColours {
  canvas: string;
  brand: string;
}

/** Each theme's canvas and brand, as in globals.css. */
const LIGHT: ThemeColours = { canvas: "#ffffff", brand: "#cf4136" };
const FOREST: ThemeColours = { canvas: "#11161d", brand: "#6ee7a8" };
const GRAPHITE: ThemeColours = { canvas: "#242428", brand: "#ef5f55" };

export const THEME_COLOURS: Record<string, ThemeColours> = {
  light: LIGHT,
  forest: FOREST,
  sepia: { canvas: "#fcf5e9", brand: "#ad4f1d" },
  graphite: GRAPHITE,
  midnight: { canvas: "#101014", brand: "#ff6b5e" },
};

/** The fold is the page colour in shadow: brand pulled a third toward black. */
export function shade(hex: string, amount = 0.32): string {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? [...clean].map((c) => c + c).join("") : clean;
  const parts = [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16));
  if (parts.some(Number.isNaN)) return hex;
  return `#${parts
    .map((value) => Math.round(value * (1 - amount)).toString(16).padStart(2, "0"))
    .join("")}`;
}

const SHAPES = (tile: string, page: string, fold: string, line: string) =>
  `<rect width="64" height="64" rx="14" ${tile}/>` +
  `<path d="M19 9H39L49 19V51a4 4 0 0 1-4 4H19a4 4 0 0 1-4-4V13a4 4 0 0 1 4-4Z" ${page}/>` +
  `<path d="M39 9V16a3 3 0 0 0 3 3H49Z" ${fold}/>` +
  `<rect x="21" y="27" width="22" height="3.6" rx="1.8" ${line}/>` +
  `<rect x="21" y="35" width="22" height="3.6" rx="1.8" ${line}/>` +
  `<rect x="21" y="43" width="14" height="3.6" rx="1.8" ${line}/>`;

const HEX = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i;

/**
 * The icon's SVG source. "system" carries both palettes and lets the
 * browser's prefers-color-scheme pick, since only the browser knows which
 * applies; an SVG favicon honours its own media queries.
 */
export function faviconSvg(theme: string, brandColor: string | null): string {
  const accent = brandColor && HEX.test(brandColor) ? brandColor : null;
  const open = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">`;
  if (theme === "system") {
    // The system theme's dark half is graphite, as in globals.css.
    const light = LIGHT;
    const dark = GRAPHITE;
    const lb = accent ?? light.brand;
    const db = accent ?? dark.brand;
    const style =
      `<style>.t,.l{fill:${light.canvas}}.p{fill:${lb}}.f{fill:${shade(lb)}}` +
      `@media (prefers-color-scheme: dark){.t,.l{fill:${dark.canvas}}.p{fill:${db}}.f{fill:${shade(db)}}}</style>`;
    return `${open}${style}${SHAPES('class="t"', 'class="p"', 'class="f"', 'class="l"')}</svg>`;
  }
  const colours = THEME_COLOURS[theme] ?? FOREST;
  const brand = accent ?? colours.brand;
  const fill = (colour: string) => `fill="${colour}"`;
  return `${open}${SHAPES(fill(colours.canvas), fill(brand), fill(shade(brand)), fill(colours.canvas))}</svg>`;
}

export function faviconHref(theme: string, brandColor: string | null): string {
  return `data:image/svg+xml,${encodeURIComponent(faviconSvg(theme, brandColor))}`;
}

/**
 * Points every tab icon the page declares at the themed one. The static
 * `/icon.svg` and `/favicon.ico` links stay in the markup for crawlers and
 * the signed-out page; browsers use whichever icon link is current.
 */
export function applyFavicon(doc: Document, theme: string, brandColor: string | null): void {
  const href = faviconHref(theme, brandColor);
  const links = doc.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]');
  for (const link of links) {
    if (link.getAttribute("href") !== href) {
      link.setAttribute("href", href);
      link.setAttribute("type", "image/svg+xml");
      link.removeAttribute("sizes");
    }
  }
}

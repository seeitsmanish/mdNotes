/**
 * Colour tweaks are applied as inline custom properties on <html>, layered over
 * whichever theme block is active. Nothing here redefines a theme — it only
 * overrides the three tokens the appearance panel exposes.
 */

import type { HeadingMode } from "./store/useUiStore";

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return 0.5;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * What reads on top of a brand-coloured surface. A mint accent needs dark text
 * where a deep red needs white, so this is computed rather than guessed.
 */
export function onBrand(hex: string): string {
  return luminance(hex) > 0.45 ? "#10151b" : "#ffffff";
}

export interface AppearanceOverrides {
  brandColor: string | null;
  radius: number;
  headingMode: HeadingMode;
}

/** The CSS custom properties an appearance sets on <html>; null removes one. */
export type AppearanceVars = Record<"--brand" | "--on-brand" | "--radius" | "--heading", string | null>;

/**
 * What the appearance overrides become, as custom properties. One function for
 * both sides: the server renders these into <html> so the first paint is
 * already right, and the client applies the same values when a setting
 * changes. Two implementations would drift, and a drift is a flash.
 */
export function appearanceVars(overrides: AppearanceOverrides): AppearanceVars {
  const { brandColor, radius, headingMode } = overrides;
  return {
    // --brand-soft, --row-active and --selection are derived from --brand in
    // globals.css, so overriding the brand carries them along automatically.
    "--brand": brandColor ?? null,
    "--on-brand": brandColor ? onBrand(brandColor) : null,
    "--radius": `${radius}rem`,
    "--heading":
      headingMode === "brand" ? "var(--brand)" : headingMode === "text" ? "var(--ink)" : null,
  };
}

export function applyAppearance(root: HTMLElement, overrides: AppearanceOverrides): void {
  for (const [name, value] of Object.entries(appearanceVars(overrides))) {
    if (value === null) root.style.removeProperty(name);
    else root.style.setProperty(name, value);
  }
}

/**
 * Themes that use the dark variant of shared components. "system" is neither:
 * it follows prefers-color-scheme, which only the browser knows.
 */
export const DARK_THEMES = new Set(["forest", "graphite", "midnight"]);

export function isDarkTheme(theme: string): boolean | null {
  return theme === "system" ? null : DARK_THEMES.has(theme);
}

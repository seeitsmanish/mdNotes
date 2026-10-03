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

export function applyAppearance(root: HTMLElement, overrides: AppearanceOverrides): void {
  const { brandColor, radius, headingMode } = overrides;

  if (brandColor) {
    root.style.setProperty("--brand", brandColor);
    root.style.setProperty("--on-brand", onBrand(brandColor));
    // --brand-soft, --row-active and --selection are derived from --brand in
    // globals.css, so overriding the brand carries them along automatically.
  } else {
    root.style.removeProperty("--brand");
    root.style.removeProperty("--on-brand");
  }

  root.style.setProperty("--radius", `${radius}rem`);

  if (headingMode === "brand") root.style.setProperty("--heading", "var(--brand)");
  else if (headingMode === "text") root.style.setProperty("--heading", "var(--ink)");
  else root.style.removeProperty("--heading");
}

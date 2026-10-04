/**
 * The shape and the allowed values of synced appearance.
 *
 * Pure on purpose: this is the validation boundary for an untrusted
 * request body, and it must be testable without a database.
 */

/**
 * The one settings row. Reads are forgiving — a brand new database has no row
 * yet, and appearance must never be the reason the app fails to render.
 */

export interface AppSettings {
  theme: string;
  brandColor: string | null;
  radius: number;
  headingMode: string;
  editorWidth: string;
  editorPadding: string;
  editorFont: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "forest",
  brandColor: null,
  radius: 0.625,
  headingMode: "theme",
  editorWidth: "regular",
  editorPadding: "medium",
  editorFont: "sans",
};

const SINGLETON = "singleton";

const ALLOWED = {
  theme: ["system", "forest", "light", "sepia", "graphite", "midnight"],
  headingMode: ["theme", "brand", "text"],
  editorWidth: ["narrow", "regular", "wide", "full"],
  editorPadding: ["none", "small", "medium", "large"],
  editorFont: ["sans", "serif", "mono", "literata", "atkinson", "nunito", "plex"],
} as const;

/** A hex colour, or null. Anything else is rejected rather than stored. */
function cleanBrand(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : undefined;
}

/**
 * Narrow an untrusted patch to the fields and values actually allowed. The
 * values end up as CSS custom properties, so an unchecked string here would be
 * a style injection.
 */
export function sanitise(patch: unknown): Partial<AppSettings> {
  if (typeof patch !== "object" || patch === null) return {};
  const input = patch as Record<string, unknown>;
  const out: Partial<AppSettings> = {};

  for (const [key, options] of Object.entries(ALLOWED) as Array<
    [keyof typeof ALLOWED, readonly string[]]
  >) {
    const value = input[key];
    if (typeof value === "string" && options.includes(value)) {
      out[key] = value as never;
    }
  }

  const brand = cleanBrand(input.brandColor);
  if (brand !== undefined) out.brandColor = brand;

  if (typeof input.radius === "number" && Number.isFinite(input.radius)) {
    out.radius = Math.min(1.5, Math.max(0, input.radius));
  }

  return out;
}

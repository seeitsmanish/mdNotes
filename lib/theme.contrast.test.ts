import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { luminance } from "./theme";

/**
 * Small text must reach WCAG AA contrast (4.5:1) in every theme (PRD §4.36).
 * Reads the real stylesheet, so a palette edit that breaks contrast fails
 * here instead of shipping unreadable timestamps.
 */

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function block(selector: RegExp): Record<string, string> {
  const match = selector.exec(css);
  if (!match) throw new Error(`no block for ${selector}`);
  const start = match.index + match[0].length;
  const body = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6});/g)].map((m) => [m[1], m[2]]));
}

function hex(value: string): [number, number, number] {
  return [1, 3, 5].map((i) => Number.parseInt(value.slice(i, i + 2), 16)) as [number, number, number];
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** --row-active is color-mix(in srgb, var(--brand) 13%, var(--list)). */
function rowActive(brand: string, list: string): string {
  const [b, l] = [hex(brand), hex(list)];
  return `#${b.map((c, i) => Math.round(c * 0.13 + (l[i] ?? 0) * 0.87).toString(16).padStart(2, "0")).join("")}`;
}

const THEMES: Array<[string, RegExp]> = [
  ["light", /:root\[data-theme="light"\]\s*\{/],
  ["forest", /:root\[data-theme="forest"\]\s*\{/],
  ["sepia", /:root\[data-theme="sepia"\]\s*\{/],
  ["graphite", /:root\[data-theme="graphite"\]\s*\{/],
  ["midnight", /:root\[data-theme="midnight"\]\s*\{/],
];

describe("theme contrast", () => {
  for (const [name, selector] of THEMES) {
    it(`${name}: secondary and faint text reach 4.5:1 on every surface`, () => {
      const t = block(selector);
      const surfaces = {
        canvas: t.canvas,
        list: t.list,
        raised: t.raised,
        "selected row": rowActive(t.brand ?? "#000000", t.list ?? "#000000"),
      };
      for (const token of ["ink-soft", "ink-faint"]) {
        for (const [surface, background] of Object.entries(surfaces)) {
          expect.soft(
            ratio(t[token] ?? "#000000", background ?? "#ffffff"),
            `${name} --${token} on ${surface}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
  }
});

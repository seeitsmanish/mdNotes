import { describe, expect, it } from "vitest";
import { THEMES } from "@/lib/store/useUiStore";
import { faviconHref, faviconSvg, shade, THEME_COLOURS } from "./favicon";

describe("faviconSvg", () => {
  it("knows the colours of every fixed theme", () => {
    for (const { value } of THEMES) {
      if (value !== "system") expect(THEME_COLOURS[value]).toBeDefined();
    }
  });

  it("draws the page in the theme's brand on its canvas", () => {
    const svg = faviconSvg("sepia", null);
    expect(svg).toContain('fill="#fcf5e9"');
    expect(svg).toContain('fill="#ad4f1d"');
  });

  it("uses the chosen accent over the theme's brand", () => {
    const svg = faviconSvg("forest", "#e5484d");
    expect(svg).toContain('fill="#e5484d"');
    expect(svg).not.toContain("#6ee7a8");
  });

  it("ignores an accent that is not a colour, so nothing can be injected", () => {
    const svg = faviconSvg("forest", '"/><script>');
    expect(svg).not.toContain("script");
    expect(svg).toContain("#6ee7a8");
  });

  it("lets the browser pick for the system theme", () => {
    const svg = faviconSvg("system", null);
    expect(svg).toContain("prefers-color-scheme: dark");
    expect(svg).toContain("#cf4136");
    expect(svg).toContain("#ef5f55");
  });

  it("falls back to forest for an unknown theme", () => {
    expect(faviconSvg("nope", null)).toBe(faviconSvg("forest", null));
  });

  it("is a data URL", () => {
    expect(faviconHref("light", null)).toMatch(/^data:image\/svg\+xml,%3Csvg/);
  });
});

describe("shade", () => {
  it("darkens toward black", () => {
    expect(shade("#ffffff", 0.5)).toBe("#808080");
    expect(shade("#000")).toBe("#000000");
  });
});

import { describe, expect, it } from "vitest";
import { sanitise } from "./schema";

/**
 * These values end up as CSS custom properties on <html>, so anything that
 * survives `sanitise` is effectively trusted. That makes this the security
 * boundary for the settings endpoint, not just a validation nicety.
 */
describe("sanitise", () => {
  it("keeps values from the allowed set", () => {
    expect(sanitise({ theme: "midnight", editorFont: "serif" })).toEqual({
      theme: "midnight",
      editorFont: "serif",
    });
  });

  it("drops values outside the allowed set", () => {
    expect(sanitise({ theme: "neon", headingMode: "rainbow" })).toEqual({});
  });

  it("drops unknown keys entirely", () => {
    expect(sanitise({ isAdmin: true, theme: "light" })).toEqual({ theme: "light" });
  });

  it("accepts a six-digit hex accent and lowercases it", () => {
    expect(sanitise({ brandColor: "#A78BFA" })).toEqual({ brandColor: "#a78bfa" });
  });

  it("accepts null to mean 'use the theme's own accent'", () => {
    expect(sanitise({ brandColor: null })).toEqual({ brandColor: null });
  });

  it("rejects a CSS expression smuggled in as a colour", () => {
    for (const attack of [
      "red; background: url(https://evil.test)",
      "var(--anything)",
      "#fff",
      "javascript:alert(1)",
      "expression(alert(1))",
    ]) {
      expect(sanitise({ brandColor: attack })).toEqual({});
    }
  });

  it("clamps radius into range", () => {
    expect(sanitise({ radius: 99 })).toEqual({ radius: 1.5 });
    expect(sanitise({ radius: -4 })).toEqual({ radius: 0 });
  });

  it("drops a non-finite radius rather than storing NaN", () => {
    expect(sanitise({ radius: Number.NaN })).toEqual({});
    expect(sanitise({ radius: "0.5" })).toEqual({});
  });

  it("survives junk input", () => {
    expect(sanitise(null)).toEqual({});
    expect(sanitise("nope")).toEqual({});
    expect(sanitise([])).toEqual({});
  });
});

import { describe, expect, it } from "vitest";
import { THEMES } from "@/lib/store/useUiStore";
import { appearanceVars, isDarkTheme, onBrand } from "./theme";

describe("appearanceVars", () => {
  it("sets the brand and the text that reads on it", () => {
    expect(appearanceVars({ brandColor: "#e5484d", radius: 0.5, headingMode: "theme" })).toEqual({
      "--brand": "#e5484d",
      "--on-brand": onBrand("#e5484d"),
      "--radius": "0.5rem",
      "--heading": null,
    });
  });

  it("removes the brand override when the theme's own is wanted", () => {
    const vars = appearanceVars({ brandColor: null, radius: 0.625, headingMode: "brand" });
    expect(vars["--brand"]).toBeNull();
    expect(vars["--on-brand"]).toBeNull();
    expect(vars["--heading"]).toBe("var(--brand)");
  });
});

describe("isDarkTheme", () => {
  it("agrees with the theme list the appearance panel uses", () => {
    for (const theme of THEMES) {
      expect(isDarkTheme(theme.value)).toBe(theme.value === "system" ? null : theme.dark);
    }
  });
});

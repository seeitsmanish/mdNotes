import { describe, expect, it } from "vitest";
import { parseCallout } from "./callout";

describe("parseCallout", () => {
  it("reads the type and uses its label as the title", () => {
    const c = parseCallout("> [!warning]");
    expect(c).toMatchObject({ type: "warning", title: "Warning", custom: false, markerFrom: 2, markerTo: 12 });
  });

  it("keeps a written title and covers the space after the marker", () => {
    const line = "> [!tip] Use the slash menu";
    const c = parseCallout(line)!;
    expect(c.title).toBe("Use the slash menu");
    expect(c.custom).toBe(true);
    expect(line.slice(c.markerTo)).toBe("Use the slash menu");
    expect(line.slice(c.markerFrom, c.markerTo)).toBe("[!tip] ");
  });

  it("maps Obsidian spellings, ignoring case and fold signs", () => {
    expect(parseCallout(">[!INFO]")?.type).toBe("note");
    expect(parseCallout("> [!danger]- Hot")?.type).toBe("caution");
    expect(parseCallout("> [!faq]+")?.type).toBe("question");
  });

  it("leaves plain quotes and unknown types alone", () => {
    expect(parseCallout("> just a quote")).toBeNull();
    expect(parseCallout("> [!banana] what")).toBeNull();
    expect(parseCallout("[!note] not in a quote")).toBeNull();
  });
});

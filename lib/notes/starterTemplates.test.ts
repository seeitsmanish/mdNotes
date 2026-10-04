import { describe, expect, it } from "vitest";
import { deriveTitle } from "@/lib/markdown/derive";
import { STARTER_TEMPLATES, starterTitle } from "./starterTemplates";

describe("STARTER_TEMPLATES", () => {
  it("each has a distinct heading that becomes its title", () => {
    const titles = STARTER_TEMPLATES.map(starterTitle);
    expect(new Set(titles).size).toBe(titles.length);
    for (const body of STARTER_TEMPLATES) expect(deriveTitle(body)).toBe(starterTitle(body));
  });
  it("includes the Daily note that today's note starts from", () => {
    expect(STARTER_TEMPLATES.map(starterTitle)).toContain("Daily note");
  });
});

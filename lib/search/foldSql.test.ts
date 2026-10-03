import { describe, expect, it } from "vitest";
import { FOLD_FROM, FOLD_TO, containsPattern } from "./foldSql";
import { fold } from "./rank";

/** What Postgres translate() does, so the table can be tested without one. */
function translate(text: string): string {
  const map = new Map([...FOLD_FROM].map((ch, i) => [ch, FOLD_TO[i]]));
  return [...text].map((ch) => map.get(ch) ?? ch).join("");
}

describe("SQL fold table", () => {
  it("pairs every character with exactly one replacement", () => {
    expect([...FOLD_FROM]).toHaveLength([...FOLD_TO].length);
  });

  it("agrees with fold() on every character it maps", () => {
    [...FOLD_FROM].forEach((ch, i) => expect(fold(ch)).toBe(FOLD_TO[i]));
  });

  it.each([
    ["Café Lumière", "cafe"],
    ["crème brûlée", "creme brulee"],
    ["ÉCOLE", "ecole"],
    ["Ångström", "angstrom"],
    ["São Paulo", "sao paulo"],
    ["Łódź", "odz"],
  ])("lets %j match the folded term %j case-insensitively", (text, term) => {
    expect(translate(text).toLowerCase()).toContain(fold(term).split(" ")[0]);
  });
});

describe("containsPattern", () => {
  it("wraps a term for ILIKE", () => {
    expect(containsPattern("cafe")).toBe("%cafe%");
  });

  it("matches LIKE metacharacters literally", () => {
    expect(containsPattern("100%_done\\")).toBe("%100\\%\\_done\\\\%");
  });
});

import { describe, expect, it } from "vitest";
import { CHECKBOX_EM, hangingPrefix } from "./hangingIndent";

describe("hangingPrefix", () => {
  it.each([
    ["14. How will you prevent a malicious npm dependency", "14. "],
    ["1) first", "1) "],
    ["- bullet", "- "],
    ["* star", "* "],
    ["  - nested bullet", "  - "],
    ["    3. nested number", "    3. "],
    ["\t- tabbed", "    - "],
  ])("hangs %j by the visible prefix %j", (line, text) => {
    expect(hangingPrefix(line)).toEqual({ text, extraEm: 0 });
  });

  it("hangs a to-do by the checkbox, not by the hidden dash and brackets", () => {
    expect(hangingPrefix("- [ ] buy milk")).toEqual({ text: "  ", extraEm: CHECKBOX_EM });
    expect(hangingPrefix("  - [x] done")).toEqual({ text: "    ", extraEm: CHECKBOX_EM });
  });

  it.each([
    ["plain paragraph"],
    ["14.no space after the number"],
    ["# heading"],
    ["> - quoted list"],
    ["-"],
    ["14. "],
  ])("leaves %j alone", (line) => {
    expect(hangingPrefix(line)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { composeShared } from "./compose";

describe("composeShared", () => {
  it("makes a heading, the text and the link", () => {
    expect(
      composeShared({ title: "Event loop explained", text: "Great walkthrough of microtasks", url: "https://example.com/loop" }),
    ).toBe("# Event loop explained\n\nGreat walkthrough of microtasks\n\nhttps://example.com/loop\n");
  });

  it("pulls the link out of the text, as Chrome on Android sends it", () => {
    expect(composeShared({ title: "Article", text: "Read this https://example.com/a", url: "" })).toBe(
      "# Article\n\nRead this\n\nhttps://example.com/a\n",
    );
  });

  it("does not repeat the link when it is in both fields", () => {
    const out = composeShared({ text: "https://example.com/x", url: "https://example.com/x" });
    expect(out.match(/example\.com\/x/g)).toHaveLength(1);
    expect(out.startsWith("# example.com")).toBe(true);
  });

  it("uses the first line of plain shared text as the heading", () => {
    expect(composeShared({ text: "How would you design a rate limiter?\nThey asked at Gartner." })).toBe(
      "# How would you design a rate limiter?\n\nThey asked at Gartner.\n",
    );
  });

  it("drops text that only repeats the title", () => {
    expect(composeShared({ title: "Same", text: "Same" })).toBe("# Same\n");
  });

  it("produces an empty note for an empty share", () => {
    expect(composeShared({})).toBe("\n");
  });
});

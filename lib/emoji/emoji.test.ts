import { describe, expect, it } from "vitest";
import { ALL_EMOJI, emojiQuery, searchEmoji } from "./emoji";

describe("emojiQuery", () => {
  it("opens on :word after a space or at line start", () => {
    expect(emojiQuery(":fi")).toEqual({ offset: 0, query: "fi" });
    expect(emojiQuery("done :che")).toEqual({ offset: 5, query: "che" });
  });

  it("leaves times, URLs, highlights and one-letter codes alone", () => {
    expect(emojiQuery("at 10:30")).toBeNull();
    expect(emojiQuery("https://x")).toBeNull();
    expect(emojiQuery("::hl")).toBeNull();
    expect(emojiQuery("word:ab")).toBeNull();
    expect(emojiQuery(":a")).toBeNull();
    expect(emojiQuery(":)")).toBeNull();
  });
});

describe("searchEmoji", () => {
  it("puts shortcode prefixes first, then matching words", () => {
    expect(searchEmoji("fire")[0]!.e).toBe("🔥");
    expect(searchEmoji("done").map((e) => e.e)).toContain("✅");
    expect(searchEmoji("thumbsup")[0]!.e).toBe("👍");
  });

  it("has unique shortcodes", () => {
    const names = ALL_EMOJI.map((e) => e.n);
    expect(new Set(names).size).toBe(names.length);
  });
});

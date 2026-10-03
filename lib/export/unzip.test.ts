import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { readEntryCapped } from "./unzip";

async function entryOf(content: string) {
  const zip = new JSZip();
  zip.file("note.md", content);
  const reloaded = await JSZip.loadAsync(await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }));
  const entry = reloaded.file("note.md");
  if (!entry) throw new Error("missing entry");
  return entry;
}

describe("readEntryCapped", () => {
  it("returns an entry under the cap whole", async () => {
    expect(await readEntryCapped(await entryOf("# Hello\n\nworld"), 1024)).toBe("# Hello\n\nworld");
  });

  it("decodes multi-byte characters split across chunks", async () => {
    const text = "Café ünïcödé 日本語 ".repeat(20_000);
    expect(await readEntryCapped(await entryOf(text), 10 * 1024 * 1024)).toBe(text);
  });

  it("gives up on an entry that inflates past the cap — the zip-bomb case", async () => {
    const bomb = "a".repeat(8 * 1024 * 1024); // compresses to a few KB
    const entry = await entryOf(bomb);
    expect(await readEntryCapped(entry, 2 * 1024 * 1024)).toBeNull();
  });

  it("accepts an entry exactly at the cap", async () => {
    expect(await readEntryCapped(await entryOf("abcd"), 4)).toBe("abcd");
  });
});

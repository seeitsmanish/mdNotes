import { describe, expect, it } from "vitest";
import { archiveEntryId, fromArchive, referencedIds, toArchive } from "./attachments";

const A = "cmusr53c70000ab7dqym3sfww";
const B = "cmust62os0000zm7d12txk1ja";

describe("export links", () => {
  const body = `# Trip\n\n![beach](/api/attachments/${A})\n\nagain ![](/api/attachments/${A}) and ![x](/api/attachments/${B})`;

  it("lists each referenced image once", () => {
    expect(referencedIds(body)).toEqual([A, B]);
  });

  it("rewrites app URLs to archive paths with the right extension", () => {
    const out = toArchive(body, new Map([[A, "image/webp"], [B, "image/png"]]));
    expect(out).toContain(`![beach](attachments/${A}.webp)`);
    expect(out).toContain(`![x](attachments/${B}.png)`);
    expect(out).not.toContain("/api/attachments/");
  });

  it("leaves a link alone when its image no longer exists", () => {
    expect(toArchive(body, new Map([[A, "image/webp"]]))).toContain(`/api/attachments/${B}`);
  });

  it("round-trips through import with new ids", () => {
    const exported = toArchive(body, new Map([[A, "image/webp"], [B, "image/png"]]));
    const restored = fromArchive(exported, new Map([[A, "newid0000000000000000000a"], [B, "newid0000000000000000000b"]]));
    expect(restored).toBe(
      body.replaceAll(A, "newid0000000000000000000a").replaceAll(B, "newid0000000000000000000b"),
    );
  });

  it("accepts ./attachments paths written by other tools", () => {
    expect(fromArchive(`![](./attachments/${A}.jpg)`, new Map([[A, "z0000000000000000000000z"]]))).toBe(
      "![](/api/attachments/z0000000000000000000000z)",
    );
  });

  it("does not touch text that merely looks similar", () => {
    const text = "see /api/attachments/ for details, or attachments/notes.md";
    expect(toArchive(text, new Map())).toBe(text);
    expect(fromArchive(text, new Map())).toBe(text);
  });
});

describe("archiveEntryId", () => {
  it("reads the id from an exported image's path", () => {
    expect(archiveEntryId(`attachments/${A}.webp`)).toBe(A);
    expect(archiveEntryId(`ursa-notes/attachments/${A}.png`)).toBe(A);
  });

  it("ignores everything else", () => {
    expect(archiveEntryId("attachments/readme.md")).toBeNull();
    expect(archiveEntryId(`notes/${A}.webp`)).toBeNull();
  });
});

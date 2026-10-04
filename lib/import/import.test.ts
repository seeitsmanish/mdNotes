import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { enexToNote, parseEnex } from "./enex";
import { keepToNote, labelTag, parseKeep } from "./keep";

describe("Google Keep", () => {
  const json = JSON.stringify({
    title: "Groceries",
    listContent: [{ text: "Milk", isChecked: true }, { text: "Eggs", isChecked: false }],
    labels: [{ name: "home" }, { name: "weekly shop" }],
    isPinned: true,
    isArchived: false,
    isTrashed: false,
    attachments: [{ filePath: "pic.jpg", mimetype: "image/jpeg" }],
    createdTimestampUsec: 1_700_000_000_000_000,
    userEditedTimestampUsec: 1_700_000_100_000_000,
  });

  it("recognises a Keep note and turns it into markdown", () => {
    const note = keepToNote(parseKeep(json)!, (path) => (path === "pic.jpg" ? "/api/attachments/abc" : null))!;
    expect(note.body).toBe("# Groceries\n\n- [x] Milk\n- [ ] Eggs\n\n![](/api/attachments/abc)\n\n#home #weekly shop#\n");
    expect(note.pinned).toBe(true);
    expect(note.createdAt?.getTime()).toBe(1_700_000_000_000);
  });

  it("skips trashed notes and other JSON", () => {
    expect(keepToNote({ ...JSON.parse(json), isTrashed: true }, () => null)).toBeNull();
    expect(parseKeep('{"foo": 1}')).toBeNull();
    expect(parseKeep("not json")).toBeNull();
  });

  it("writes labels as tags", () => {
    expect(labelTag("travel")).toBe("#travel");
    expect(labelTag("to read")).toBe("#to read#");
  });
});

describe("Evernote", () => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const hash = createHash("md5").update(png).digest("hex");
  const enex = `<?xml version="1.0" encoding="UTF-8"?>
<en-export><note><title>Trip &amp; plans</title><created>20231004T120000Z</created><tag>travel</tag>
<content><![CDATA[<?xml version="1.0"?><!DOCTYPE en-note SYSTEM "x"><en-note><h2>Packing</h2><div><en-todo checked="true"/>Passport</div><div><en-todo/>Charger</div><p>See <b>this</b> <a href="https://example.com">site</a></p><en-media type="image/png" hash="${hash}"/></en-note>]]></content>
<resource><data encoding="base64">${png.toString("base64")}</data><mime>image/png</mime></resource></note></en-export>`;

  it("reads title, date, tags, body and attachments", () => {
    const [note] = parseEnex(enex);
    expect(note!.title).toBe("Trip & plans");
    expect(note!.created?.toISOString()).toBe("2023-10-04T12:00:00.000Z");
    expect(note!.tags).toEqual(["travel"]);
    expect(note!.resources[0]!.hash).toBe(hash);
  });

  it("converts the body to markdown with to-dos and images", () => {
    const [note] = parseEnex(enex);
    const out = enexToNote(note!, (h) => (h === hash ? "/api/attachments/img1" : null))!;
    expect(out.body).toContain("# Trip & plans");
    expect(out.body).toContain("## Packing");
    expect(out.body).toContain("- [x] Passport");
    expect(out.body).toContain("- [ ] Charger");
    expect(out.body).toContain("**this** [site](https://example.com)");
    expect(out.body).toContain("![](/api/attachments/img1)");
    expect(out.body).toContain("#travel");
  });
});

import { relativeImages, resolveRelative, rewriteImages, stripNotionId } from "./relative";

describe("relative images (Notion, Obsidian)", () => {
  it("resolves paths relative to the note, decoding spaces", () => {
    expect(resolveRelative("Export/Trip abc.md", "Trip%20abc/Untitled.png")).toBe("Export/Trip abc/Untitled.png");
    expect(resolveRelative("a/b/note.md", "../img/x.png")).toBe("a/img/x.png");
    expect(resolveRelative("note.md", "https://x.y/a.png")).toBeNull();
    expect(resolveRelative("note.md", "/api/attachments/x")).toBeNull();
    expect(resolveRelative("note.md", "../../x.png")).toBeNull();
  });
  it("finds and rewrites only images it has", () => {
    const body = "![a](img/one.png) ![b](https://e.com/x.png) ![c](img/two.png)";
    expect(relativeImages("n.md", body).map((i) => i.path)).toEqual(["img/one.png", "img/two.png"]);
    expect(rewriteImages("n.md", body, new Map([["img/one.png", "/api/attachments/new1"]]))).toBe(
      "![a](/api/attachments/new1) ![b](https://e.com/x.png) ![c](img/two.png)",
    );
  });
  it("drops Notion's id from names", () => {
    expect(stripNotionId("Trip plan 0123456789abcdef0123456789abcdef.md")).toBe("Trip plan.md");
  });
});

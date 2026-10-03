import { describe, expect, it } from "vitest";
import { parse, serialise } from "./frontmatter";

describe("serialise", () => {
  it("writes the fields it was given", () => {
    const out = serialise({ id: "abc", createdAt: "2026-01-01T00:00:00.000Z", pinned: true }, "# Hi");
    expect(out).toContain("id: abc");
    expect(out).toContain("created: 2026-01-01T00:00:00.000Z");
    expect(out).toContain("pinned: true");
    expect(out.endsWith("# Hi")).toBe(true);
  });

  it("omits pinned when false, rather than writing noise", () => {
    expect(serialise({ pinned: false }, "x")).not.toContain("pinned");
  });
});

describe("parse", () => {
  it("round-trips what serialise wrote", () => {
    const meta = {
      id: "n1",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-02-02T00:00:00.000Z",
      pinned: true,
    };
    const body = "# Title\n\nSome *body* text.\n";
    const parsed = parse(serialise(meta, body));
    expect(parsed.meta).toEqual(meta);
    expect(parsed.body).toBe(body);
  });

  it("treats a file with no frontmatter as all body (R16.4)", () => {
    const body = "# Just a note\n\ncontent";
    expect(parse(body)).toEqual({ meta: {}, body });
  });

  it("does not mistake a horizontal rule for frontmatter", () => {
    const body = "Some text\n\n---\n\nmore text";
    expect(parse(body).body).toBe(body);
  });

  it("returns the whole file when the fence is never closed", () => {
    const body = "---\nid: x\nnever closed";
    expect(parse(body).body).toBe(body);
  });

  it("keeps body text that itself contains ---", () => {
    const parsed = parse(serialise({ id: "a" }, "intro\n\n---\n\noutro"));
    expect(parsed.body).toBe("intro\n\n---\n\noutro");
  });

  it("ignores unknown keys rather than failing", () => {
    expect(parse("---\ntags: [a, b]\nid: x\n---\n\nbody").meta.id).toBe("x");
  });

  it("strips a BOM", () => {
    expect(parse("﻿---\nid: x\n---\n\nbody").meta.id).toBe("x");
  });

  it("handles CRLF line endings", () => {
    expect(parse("---\r\nid: x\r\n---\r\n\r\nbody").meta.id).toBe("x");
  });

  it("unquotes a quoted value", () => {
    expect(parse('---\nid: "a: b"\n---\n\nx').meta.id).toBe("a: b");
  });
});

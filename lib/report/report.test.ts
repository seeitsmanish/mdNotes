import { describe, expect, it } from "vitest";
import { createDeduper, normaliseReport } from "./report";

describe("normaliseReport", () => {
  it("keeps a well-formed report", () => {
    expect(
      normaliseReport({ message: "boom", stack: "at x", source: "window", path: "/", release: "1.20.0" }),
    ).toEqual({ message: "boom", stack: "at x", source: "window", path: "/", release: "1.20.0" });
  });

  it("drops the query and hash from the path, so shared text never reaches the logs", () => {
    expect(normaliseReport({ message: "x", path: "/share?text=my+secret#y" })?.path).toBe("/share");
  });

  it("bounds every field", () => {
    const report = normaliseReport({ message: "m".repeat(5000), stack: "s".repeat(50_000) });
    expect(report?.message).toHaveLength(500);
    expect(report?.stack).toHaveLength(4000);
  });

  it.each([[null], ["text"], [{}], [{ message: "   " }], [{ message: 42 }]])("refuses %j", (payload) => {
    expect(normaliseReport(payload)).toBeNull();
  });

  it("does not accept an absolute URL as a path", () => {
    expect(normaliseReport({ message: "x", path: "https://evil.example/x" })?.path).toBe("/");
  });
});

describe("createDeduper", () => {
  it("lets a key through once per window", () => {
    let t = 0;
    const once = createDeduper(60_000, () => t);
    expect(once("save failed")).toBe(true);
    expect(once("save failed")).toBe(false);
    expect(once("other")).toBe(true);
    t = 60_000;
    expect(once("save failed")).toBe(true);
  });
});

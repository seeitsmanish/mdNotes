import { describe, expect, it } from "vitest";
import { CURRENT_RELEASE, RELEASES } from "./releases";

/**
 * The changelog is hand-written, so these guard the mistakes hand-writing
 * actually makes: a duplicated version, an entry added in the wrong place, or a
 * release shipped with no notes.
 */

const SEMVER = /^\d+\.\d+\.\d+$/;

function rank(version: string): number {
  const [major = 0, minor = 0, patch = 0] = version.split(".").map(Number);
  return major * 1_000_000 + minor * 1_000 + patch;
}

describe("RELEASES", () => {
  it("is not empty", () => {
    expect(RELEASES.length).toBeGreaterThan(0);
  });

  it("uses valid semver throughout", () => {
    for (const release of RELEASES) expect(release.version).toMatch(SEMVER);
  });

  it("has unique versions", () => {
    const versions = RELEASES.map((r) => r.version);
    expect(new Set(versions).size).toBe(versions.length);
  });

  it("is ordered newest first", () => {
    const ranks = RELEASES.map((r) => rank(r.version));
    expect([...ranks].sort((a, b) => b - a)).toEqual(ranks);
  });

  it("uses ISO dates that parse", () => {
    for (const release of RELEASES) {
      expect(release.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(release.date))).toBe(false);
    }
  });

  it("gives every release a title and at least one change", () => {
    for (const release of RELEASES) {
      expect(release.title.trim().length).toBeGreaterThan(0);
      expect(release.changes.length).toBeGreaterThan(0);
      for (const change of release.changes) expect(change.trim().length).toBeGreaterThan(0);
    }
  });

  it("points CURRENT_RELEASE at the newest entry", () => {
    expect(CURRENT_RELEASE).toBe(RELEASES[0]);
  });

  it("matches the version in package.json", async () => {
    const pkg = (await import("../../package.json")) as unknown as { version: string };
    expect(CURRENT_RELEASE.version).toBe(pkg.version);
  });
});

import { describe, expect, it } from "vitest";
import { buildCsp, createNonce } from "./csp";

describe("buildCsp", () => {
  const csp = buildCsp("abc123==", { dev: false });

  it("allows scripts only by nonce, never inline", () => {
    const scripts = csp.split("; ").find((d) => d.startsWith("script-src")) ?? "";
    expect(scripts).toContain("'nonce-abc123=='");
    expect(scripts).toContain("'strict-dynamic'");
    expect(scripts).not.toContain("'unsafe-inline'");
    expect(scripts).not.toContain("'unsafe-eval'");
  });

  it("keeps the fences from v1.11.2", () => {
    for (const directive of ["connect-src 'self'", "frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'"]) {
      expect(csp).toContain(directive);
    }
  });

  it("allows eval and the dev socket only in development", () => {
    const dev = buildCsp("n", { dev: true });
    expect(dev).toContain("'unsafe-eval'");
    expect(dev).toContain("ws:");
  });
});

describe("createNonce", () => {
  it("is fresh every time and long enough to be unguessable", () => {
    const a = createNonce();
    const b = createNonce();
    expect(a).not.toBe(b);
    expect(atob(a)).toHaveLength(16);
  });
});

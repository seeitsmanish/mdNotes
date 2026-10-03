import { describe, expect, it } from "vitest";
import type { Question } from "./questions";
import { isDue, order, parseMemories, rate, restFor, tally } from "./schedule";

const DAY = 86_400_000;
const NOW = 1_800_000_000_000;
const q = (id: string): Question => ({ id, prompt: id, detail: "" });
const fixed = () => 0.5;

describe("order", () => {
  it("asks blank, then shaky, then unseen, then due nailed; resting nailed last", () => {
    const memories = {
      nailedResting: { rating: "nailed" as const, at: NOW - DAY / 2, streak: 1 },
      nailedDue: { rating: "nailed" as const, at: NOW - 3 * DAY, streak: 1 },
      shaky: { rating: "shaky" as const, at: NOW, streak: 0 },
      blank: { rating: "blank" as const, at: NOW, streak: 0 },
    };
    const qs = ["nailedResting", "unseen", "nailedDue", "shaky", "blank"].map(q);
    expect(order(qs, memories, NOW, fixed).map((x) => x.id)).toEqual([
      "blank",
      "shaky",
      "unseen",
      "nailedDue",
      "nailedResting",
    ]);
  });

  it("shuffles within a tier", () => {
    let n = 0;
    const descending = () => 1 - (n++ % 10) / 10;
    expect(order(["a", "b", "c"].map(q), {}, NOW, descending).map((x) => x.id)).toEqual(["c", "b", "a"]);
  });
});

describe("rate", () => {
  it("doubles the rest with each nailed answer in a row, capped at a month", () => {
    let m = rate(undefined, "nailed", NOW);
    expect(m.streak).toBe(1);
    m = rate(m, "nailed", NOW);
    m = rate(m, "nailed", NOW);
    expect(m.streak).toBe(3);
    expect(restFor(m.streak)).toBe(4 * DAY);
    expect(restFor(20)).toBe(30 * DAY);
  });

  it("resets the streak on anything but nailed", () => {
    expect(rate({ rating: "nailed", at: NOW, streak: 5 }, "shaky", NOW).streak).toBe(0);
  });

  it("makes a nailed answer due again once its rest is over", () => {
    const m = rate(undefined, "nailed", NOW);
    expect(isDue(m, NOW + DAY - 1)).toBe(false);
    expect(isDue(m, NOW + DAY)).toBe(true);
  });
});

describe("tally", () => {
  it("counts each rating, unseen and due", () => {
    const memories = { a: { rating: "nailed" as const, at: NOW, streak: 1 }, b: { rating: "blank" as const, at: NOW, streak: 0 } };
    expect(tally(["a", "b", "c"].map(q), memories, NOW)).toEqual({ nailed: 1, shaky: 0, blank: 1, unseen: 1, due: 2 });
  });
});

describe("parseMemories", () => {
  it("keeps valid entries and drops anything malformed", () => {
    const raw = JSON.stringify({
      ok: { rating: "shaky", at: 1, streak: 0 },
      badRating: { rating: "great", at: 1, streak: 0 },
      missing: { rating: "blank" },
      nothing: null,
    });
    expect(parseMemories(raw)).toEqual({ ok: { rating: "shaky", at: 1, streak: 0 } });
  });

  it.each([[null], ["not json"], ["[]"], ["42"]])("returns {} for %j", (raw) => {
    expect(parseMemories(raw)).toEqual({});
  });
});

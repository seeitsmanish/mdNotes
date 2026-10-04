import { describe, expect, it } from "vitest";
import { createOutbox, type KeyValueStore, replayPlan } from "./outbox";

function memoryStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
}

describe("outbox", () => {
  it("keeps the newest text per note, oldest note first", () => {
    const box = createOutbox(memoryStore());
    box.put("b", "one", 3, 2);
    box.put("a", "x", 1, 1);
    box.put("b", "two", 3, 3);
    expect(box.all().map((e) => [e.id, e.body])).toEqual([["a", "x"], ["b", "two"]]);
  });

  it("settles only the text the server confirmed", () => {
    const box = createOutbox(memoryStore());
    box.put("a", "typed more", 1);
    box.settle("a", "typed");
    expect(box.all()).toHaveLength(1);
    box.settle("a", "typed more");
    expect(box.all()).toHaveLength(0);
  });

  it("never throws: no storage, full storage, corrupt entries", () => {
    expect(createOutbox(null).all()).toEqual([]);
    const full = memoryStore();
    full.setItem = () => {
      throw new Error("QuotaExceeded");
    };
    expect(() => createOutbox(full).put("a", "x", 1)).not.toThrow();
    const corrupt = memoryStore();
    corrupt.setItem("ursa-outbox:z", "{not json");
    corrupt.setItem("other", "ignored");
    expect(createOutbox(corrupt).all()).toEqual([]);
  });
});

describe("replayPlan", () => {
  const entry = { id: "a", body: "offline text", base: 4, at: 1 };
  it("drops what the server already has", () => {
    expect(replayPlan(entry, { body: "offline text", version: 5 })).toBe("drop");
  });
  it("sends anything else through the versioned save", () => {
    expect(replayPlan(entry, { body: "older", version: 4 })).toBe("send");
    expect(replayPlan(entry, { body: "changed elsewhere", version: 9 })).toBe("send");
  });
  it("recreates a note that was deleted, unless the text is empty", () => {
    expect(replayPlan(entry, null)).toBe("recreate");
    expect(replayPlan({ ...entry, body: "  " }, null)).toBe("drop");
  });
});

import { describe, expect, it, vi } from "vitest";
import { createGate } from "./gate";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("createGate", () => {
  it("ignores a second run of the same key while the first is in flight", async () => {
    const gate = createGate();
    const pending = deferred<string>();
    const action = vi.fn(() => pending.promise);

    const first = gate.run("create", action);
    const second = gate.run("create", action);
    const third = gate.run("create", action);
    expect(action).toHaveBeenCalledTimes(1);

    pending.resolve("note-1");
    expect(await first).toBe("note-1");
    expect(await second).toBeUndefined();
    expect(await third).toBeUndefined();
  });

  it("runs different keys at the same time", async () => {
    const gate = createGate();
    const a = deferred<void>();
    const b = deferred<void>();
    const runA = gate.run("pin:a", () => a.promise);
    const runB = gate.run("pin:b", () => b.promise);
    expect(gate.keys().sort()).toEqual(["pin:a", "pin:b"]);
    a.resolve();
    b.resolve();
    await Promise.all([runA, runB]);
    expect(gate.keys()).toEqual([]);
  });

  it("allows the key again once the run has finished", async () => {
    const gate = createGate();
    const action = vi.fn(async () => "ok");
    await gate.run("create", action);
    await gate.run("create", action);
    expect(action).toHaveBeenCalledTimes(2);
  });

  it("reports a failure instead of throwing, and frees the key", async () => {
    const onError = vi.fn();
    const gate = createGate({ onError });
    const result = await gate.run("trash:x", async () => {
      throw new Error("offline");
    });
    expect(result).toBeUndefined();
    expect(onError).toHaveBeenCalledWith("trash:x", expect.objectContaining({ message: "offline" }));
    expect(gate.has("trash:x")).toBe(false);
  });

  it("tells the UI when the set of running keys changes", async () => {
    const onChange = vi.fn();
    const gate = createGate({ onChange });
    await gate.run("create", async () => undefined);
    expect(onChange.mock.calls).toEqual([[["create"]], [[]]]);
  });
});

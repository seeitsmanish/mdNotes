import { describe, expect, it } from "vitest";
import { chordAction, keyAction, type KeyPress } from "./keys";

const press = (key: string, code: string, mods: Partial<Omit<KeyPress, "key" | "code">> = {}): KeyPress => ({
  key,
  code,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
});

describe("keyAction on a Mac", () => {
  const mac = (p: KeyPress) => keyAction(p, true);
  it("splits with ⌘\\ and down with ⌘⇧\\", () => {
    expect(mac(press("\\", "Backslash", { metaKey: true }))).toEqual({ kind: "splitRight" });
    expect(mac(press("|", "Backslash", { metaKey: true, shiftKey: true }))).toEqual({ kind: "splitDown" });
  });
  it("⌘0 is the list, ⌘1…⌘9 the groups, ⌃1…⌃9 the tabs", () => {
    expect(mac(press("0", "Digit0", { metaKey: true }))).toEqual({ kind: "focusList" });
    expect(mac(press("3", "Digit3", { metaKey: true }))).toEqual({ kind: "focusGroup", n: 3 });
    expect(mac(press("2", "Digit2", { ctrlKey: true }))).toEqual({ kind: "tabAt", n: 2 });
    expect(mac(press("¡", "Digit1", { altKey: true }))).toEqual({ kind: "tabAt", n: 1 });
  });
  it("steps tabs with ⌥⌘→, ⌘⇧] and ⌃PageDown", () => {
    expect(mac(press("ArrowRight", "ArrowRight", { metaKey: true, altKey: true }))).toEqual({ kind: "nextTab" });
    expect(mac(press("}", "BracketRight", { metaKey: true, shiftKey: true }))).toEqual({ kind: "nextTab" });
    expect(mac(press("PageUp", "PageUp", { ctrlKey: true }))).toEqual({ kind: "previousTab" });
  });
  it("moves a tab between groups with ⌃⌘→", () => {
    expect(mac(press("ArrowLeft", "ArrowLeft", { metaKey: true, ctrlKey: true }))).toEqual({ kind: "moveToPreviousGroup" });
  });
  it("closes with ⌘W or ⌥W (whatever character ⌥ makes) and reopens with ⌥⇧T", () => {
    expect(mac(press("w", "KeyW", { metaKey: true }))).toEqual({ kind: "closeTab" });
    expect(mac(press("∑", "KeyW", { altKey: true }))).toEqual({ kind: "closeTab" });
    expect(mac(press("ˇ", "KeyT", { altKey: true, shiftKey: true }))).toEqual({ kind: "reopenTab" });
  });
  it("flips with ⌥⌘0 and leaves ordinary typing alone", () => {
    expect(mac(press("º", "Digit0", { metaKey: true, altKey: true }))).toEqual({ kind: "flipLayout" });
    expect(mac(press("a", "KeyA"))).toBeNull();
    expect(mac(press("w", "KeyW"))).toBeNull();
    expect(mac(press("1", "Digit1"))).toBeNull();
  });
});

describe("keyAction elsewhere", () => {
  const pc = (p: KeyPress) => keyAction(p, false);
  it("uses Ctrl for ⌘, Alt for the n-th tab and Ctrl+Alt to move between groups", () => {
    expect(pc(press("\\", "Backslash", { ctrlKey: true }))).toEqual({ kind: "splitRight" });
    expect(pc(press("2", "Digit2", { ctrlKey: true }))).toEqual({ kind: "focusGroup", n: 2 });
    expect(pc(press("2", "Digit2", { altKey: true }))).toEqual({ kind: "tabAt", n: 2 });
    expect(pc(press("ArrowRight", "ArrowRight", { ctrlKey: true, altKey: true }))).toEqual({ kind: "moveToNextGroup" });
    expect(pc(press(")", "Digit0", { shiftKey: true, altKey: true }))).toEqual({ kind: "flipLayout" });
  });
});

describe("chordAction after ⌘K", () => {
  const chord = (p: KeyPress) => chordAction(p, true);
  it("maps VS Code's second keys", () => {
    expect(chord(press("\\", "Backslash", { metaKey: true }))).toEqual({ kind: "splitDown" });
    expect(chord(press("w", "KeyW"))).toBeNull();
    expect(chord(press("w", "KeyW", { metaKey: true }))).toEqual({ kind: "closeAll" });
    expect(chord(press("m", "KeyM", { metaKey: true }))).toEqual({ kind: "maximize" });
    expect(chord(press("Enter", "Enter"))).toEqual({ kind: "keepOpen" });
    expect(chord(press("Enter", "Enter", { shiftKey: true }))).toEqual({ kind: "togglePin" });
    expect(chord(press("ArrowUp", "ArrowUp", { metaKey: true }))).toEqual({ kind: "focusSide", side: "up" });
    expect(chord(press("x", "KeyX"))).toBeNull();
  });
});

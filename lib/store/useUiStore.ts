"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Nothing is written to localStorage until the saved state has been read
 * back (PRD R59.5). Child components' effects run before Shell's, and any
 * store update made then (selecting a pane, a note) used to save the
 * *defaults*, which the rehydrate a moment later read back — silently
 * resetting device-only settings (pane width, focus mode, outline, reading
 * mode, hidden titles) on every reload.
 */
let hydrated = false;
const guardedStorage = createJSONStorage(() => ({
  getItem: (key: string) => localStorage.getItem(key),
  setItem: (key: string, value: string) => {
    if (hydrated) localStorage.setItem(key, value);
  },
  removeItem: (key: string) => localStorage.removeItem(key),
}));
import type { NoteFilter } from "@/lib/types";
import { closeTab, EMPTY_TABS, mergeTabs, moveTab, openTab, type TabSet } from "@/lib/tabs/tabs";
import type { NoteColor } from "@/lib/notes/colors";

/**
 * UI state only. Notes are fetched, never mirrored here — a store that also
 * caches server data is a second source of truth for the same rows.
 *
 * Layout, theme and typography persist per browser; selection and search do not.
 */

export type ThemeChoice = "system" | "forest" | "light" | "sepia" | "graphite" | "midnight";

export const THEMES: Array<{ value: ThemeChoice; label: string; dark: boolean }> = [
  { value: "forest", label: "Forest", dark: true },
  { value: "system", label: "System", dark: false },
  { value: "light", label: "Light", dark: false },
  { value: "sepia", label: "Sepia", dark: false },
  { value: "graphite", label: "Graphite", dark: true },
  { value: "midnight", label: "Midnight", dark: true },
];

export type EditorWidth = "narrow" | "regular" | "wide" | "full";
export type EditorFont = "sans" | "serif" | "mono" | "literata" | "atkinson" | "nunito" | "plex";

/**
 * Typefaces for writing (PRD §4.64). The first three are the device's own;
 * the rest ship with the app (self-hosted, so the CSP and offline use hold)
 * and only download once picked.
 */
export const EDITOR_FONTS: Array<{ value: EditorFont; label: string; css: string }> = [
  { value: "sans", label: "Sans", css: "var(--font-sans)" },
  { value: "serif", label: "Serif", css: "var(--font-serif)" },
  { value: "mono", label: "Mono", css: "var(--font-mono)" },
  { value: "literata", label: "Literata", css: '"Literata Variable", var(--font-serif)' },
  { value: "atkinson", label: "Atkinson", css: '"Atkinson Hyperlegible", var(--font-sans)' },
  { value: "nunito", label: "Nunito", css: '"Nunito Variable", var(--font-sans)' },
  { value: "plex", label: "Plex Mono", css: '"IBM Plex Mono", var(--font-mono)' },
];

export const EDITOR_WIDTHS: Array<{ value: EditorWidth; label: string; rem: number }> = [
  { value: "narrow", label: "Narrow", rem: 34 },
  { value: "regular", label: "Regular", rem: 44 },
  { value: "wide", label: "Wide", rem: 56 },
  { value: "full", label: "Full", rem: 0 },
];

/**
 * The editor's horizontal gutter. This is a real knob only because the text
 * column is left-aligned: centre it and the centring slack swallows the gutter,
 * so the control would appear to do nothing on a wide window.
 */
export type EditorPadding = "none" | "small" | "medium" | "large";

export const EDITOR_PADDINGS: Array<{ value: EditorPadding; label: string; rem: number }> = [
  { value: "none", label: "None", rem: 0.5 },
  { value: "small", label: "S", rem: 1.5 },
  { value: "medium", label: "M", rem: 3 },
  { value: "large", label: "L", rem: 6 },
];

export const FONT_SIZE = { min: 13, max: 22, step: 1 } as const;
export const RADIUS = { min: 0, max: 1.5, step: 0.125 } as const;

/** Headings take the brand colour in Forest; other themes use body ink. */
export type HeadingMode = "theme" | "brand" | "text";

/** Swatches for the colour tweaker. `null` means "whatever the theme says". */
export const BRAND_SWATCHES: Array<{ value: string; label: string }> = [
  { value: "#6ee7a8", label: "Mint" },
  { value: "#cf4136", label: "Red" },
  { value: "#e8894a", label: "Amber" },
  { value: "#5b9cf8", label: "Blue" },
  { value: "#a78bfa", label: "Violet" },
  { value: "#f472b6", label: "Pink" },
  { value: "#34d399", label: "Emerald" },
  { value: "#facc15", label: "Yellow" },
];
export const LIST_BOUNDS = { min: 260, max: 520 } as const;

/** Which pane the narrow layout is showing. */
export type MobilePane = "list" | "editor";

/** The second note pane (PRD §4.80): beside the first, or below it. */
export interface SplitState {
  dir: "right" | "down";
  tabs: TabSet;
  /** The first pane's share of the space, 0.2–0.8. */
  ratio: number;
}

export type NotePane = "main" | "split";

interface UiState {
  filter: NoteFilter;
  query: string;
  selectedNoteId: string | null;
  mobilePane: MobilePane;
  /** Notes open as tabs in the main pane; the shown one is selectedNoteId (§4.80). */
  mainTabs: string[];
  split: SplitState | null;
  /** The pane notes open into: the one last clicked or typed in. */
  focusedPane: NotePane;
  /** Wide enough for tabs and a split; set by the shell. Phones show one note. */
  splitAvailable: boolean;

  listWidth: number;
  focusMode: boolean;
  paletteOpen: boolean;
  settingsOpen: boolean;
  /** Release notes the user has not opened yet (PRD R7.3). */
  unseenRelease: boolean;
  shortcutsOpen: boolean;
  outlineOpen: boolean;
  /** Notes open read-only: no keyboard, no format bar, links open on a tap (§4.58). */
  readingMode: boolean;
  /** The note list and other titles blurred, for screen sharing (§4.59). */
  privacyMode: boolean;
  /** Turn privacyMode on whenever the page goes to the background (§4.62). */
  autoPrivacy: boolean;
  /** Fade every paragraph but the one being written (§4.64). */
  focusDim: boolean;
  /** Show only notes with this colour label (§4.65). Not kept across reloads. */
  colorFilter: NoteColor | null;
  /** Gesture ticks on Android, and on iPhones that allow them (§4.67). */
  haptics: boolean;
  /** Minutes without activity before titles hide; 0 is never (§4.68). */
  idleHideMinutes: number;
  /** Keep the line being typed centred (§4.71). */
  typewriterMode: boolean;

  theme: ThemeChoice;
  editorWidth: EditorWidth;
  editorPadding: EditorPadding;
  fontSize: number;
  editorFont: EditorFont;

  /** Colour tweaks layered over the active theme. */
  brandColor: string | null;
  radius: number;
  headingMode: HeadingMode;

  setFilter: (filter: NoteFilter) => void;
  setQuery: (query: string) => void;
  selectNote: (id: string | null) => void;
  /** Open a note in the focused pane: in its tab if it has one, else in a new tab or the shown one. */
  openNote: (id: string, options?: { newTab?: boolean; pane?: NotePane }) => void;
  closeTab: (pane: NotePane, id: string) => void;
  /** A note trashed or deleted: its tabs go, in both panes. */
  closeEverywhere: (id: string) => void;
  reorderTab: (pane: NotePane, id: string, to: number) => void;
  openSplit: (dir: "right" | "down") => void;
  closeSplit: () => void;
  setFocusedPane: (pane: NotePane) => void;
  setSplitRatio: (ratio: number) => void;
  setSplitAvailable: (available: boolean) => void;
  setMobilePane: (pane: MobilePane) => void;
  setListWidth: (width: number) => void;
  toggleFocusMode: () => void;
  setPaletteOpen: (open: boolean) => void;
  setUnseenRelease: (unseen: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  toggleOutline: () => void;
  toggleReadingMode: () => void;
  togglePrivacyMode: () => void;
  setAutoPrivacy: (on: boolean) => void;
  toggleFocusDim: () => void;
  setColorFilter: (color: NoteColor | null) => void;
  setHaptics: (on: boolean) => void;
  setIdleHideMinutes: (minutes: number) => void;
  setTypewriterMode: (on: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setTheme: (theme: ThemeChoice) => void;
  setEditorWidth: (width: EditorWidth) => void;
  setEditorPadding: (padding: EditorPadding) => void;
  setFontSize: (size: number) => void;
  setEditorFont: (font: EditorFont) => void;
  setBrandColor: (color: string | null) => void;
  setRadius: (radius: number) => void;
  setHeadingMode: (mode: HeadingMode) => void;
  resetAppearance: () => void;
  /** Server state wins over the localStorage cache on load (PRD R6.3). */
  applyServerSettings: (settings: SyncedSettings) => void;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(value)));

type TabFields = Pick<UiState, "selectedNoteId" | "mobilePane" | "mainTabs" | "split" | "focusedPane" | "splitAvailable">;

/**
 * Nothing shown in the main pane (a filter changed, back to the list). A lone
 * tab goes with it, so the next note replaces it rather than opening a second
 * tab; with several, they stay to come back to.
 */
const clearMain = (state: TabFields): Partial<TabFields> => ({
  selectedNoteId: null,
  mobilePane: "list",
  mainTabs: state.mainTabs.length <= 1 ? [] : state.mainTabs,
});

const mainSet = (state: TabFields): TabSet => ({ ids: state.mainTabs, active: state.selectedNoteId });

/** The main pane showing `tabs`, as store fields. */
const showMain = (tabs: TabSet): Partial<TabFields> => ({
  mainTabs: tabs.ids,
  selectedNoteId: tabs.active,
  mobilePane: tabs.active ? "editor" : "list",
});

/**
 * Where a note opens (PRD §4.80): its own tab if it has one in either pane,
 * else the pane asked for, else the focused one. Without room for a split,
 * everything is the main pane.
 */
function route(state: TabFields, id: string, newTab: boolean, pane?: NotePane): Partial<TabFields> {
  const split = state.splitAvailable ? state.split : null;
  if (split?.tabs.ids.includes(id)) {
    return { split: { ...split, tabs: { ...split.tabs, active: id } }, focusedPane: "split" };
  }
  if (state.mainTabs.includes(id) || !split) {
    return { ...showMain(openTab(mainSet(state), id, newTab)), focusedPane: "main" };
  }
  const target = pane ?? state.focusedPane;
  if (target === "split") {
    return { split: { ...split, tabs: openTab(split.tabs, id, newTab) }, focusedPane: "split" };
  }
  return { ...showMain(openTab(mainSet(state), id, newTab)), focusedPane: "main" };
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      filter: "all",
      query: "",
      selectedNoteId: null,
      mobilePane: "list",
      mainTabs: [],
      split: null,
      focusedPane: "main",
      splitAvailable: false,

      listWidth: 320,
      focusMode: false,
      paletteOpen: false,
      settingsOpen: false,
      unseenRelease: false,
      shortcutsOpen: false,
      outlineOpen: true,
      readingMode: false,
      privacyMode: false,
      autoPrivacy: true,
      focusDim: false,
      colorFilter: null,
      haptics: true,
      idleHideMinutes: 5,
      typewriterMode: false,

      theme: "forest",
      editorWidth: "regular",
      editorPadding: "medium",
      fontSize: 17,
      editorFont: "sans",

      brandColor: null,
      radius: 0.625,
      headingMode: "theme",

      setFilter: (filter) => set((state) => ({ filter, ...clearMain(state) })),
      setQuery: (query) => set({ query }),
      selectNote: (id) =>
        set((state) => (id ? route(state, id, false) : clearMain(state))),
      openNote: (id, options) => set((state) => route(state, id, options?.newTab ?? false, options?.pane)),
      closeTab: (pane, id) =>
        set((state) => {
          if (pane === "main") return showMain(closeTab(mainSet(state), id));
          if (!state.split) return {};
          return { split: { ...state.split, tabs: closeTab(state.split.tabs, id) } };
        }),
      closeEverywhere: (id) =>
        set((state) => ({
          ...showMain(closeTab(mainSet(state), id)),
          ...(state.split ? { split: { ...state.split, tabs: closeTab(state.split.tabs, id) } } : {}),
        })),
      reorderTab: (pane, id, to) =>
        set((state) => {
          if (pane === "main") return { mainTabs: moveTab(mainSet(state), id, to).ids };
          if (!state.split) return {};
          return { split: { ...state.split, tabs: moveTab(state.split.tabs, id, to) } };
        }),
      openSplit: (dir) =>
        set((state) => ({
          split: state.split ? { ...state.split, dir } : { dir, tabs: EMPTY_TABS, ratio: 0.5 },
          focusedPane: "split",
        })),
      closeSplit: () =>
        set((state) =>
          state.split
            ? { ...showMain(mergeTabs(mainSet(state), state.split.tabs)), split: null, focusedPane: "main" }
            : {},
        ),
      setFocusedPane: (focusedPane) => set((state) => (state.focusedPane === focusedPane ? {} : { focusedPane })),
      setSplitRatio: (ratio) =>
        set((state) =>
          state.split ? { split: { ...state.split, ratio: Math.min(0.8, Math.max(0.2, ratio)) } } : {},
        ),
      setSplitAvailable: (splitAvailable) =>
        set((state) => (state.splitAvailable === splitAvailable ? {} : { splitAvailable })),
      setMobilePane: (mobilePane) => set({ mobilePane }),
      setListWidth: (width) => set({ listWidth: clamp(width, LIST_BOUNDS.min, LIST_BOUNDS.max) }),
      toggleFocusMode: () => set((state) => ({ focusMode: !state.focusMode })),
      setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
      setUnseenRelease: (unseenRelease) => set({ unseenRelease }),
      setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
      toggleOutline: () => set((state) => ({ outlineOpen: !state.outlineOpen })),
      toggleReadingMode: () => set((state) => ({ readingMode: !state.readingMode })),
      togglePrivacyMode: () => set((state) => ({ privacyMode: !state.privacyMode })),
      setAutoPrivacy: (autoPrivacy) => set({ autoPrivacy }),
      toggleFocusDim: () => set((state) => ({ focusDim: !state.focusDim })),
      setHaptics: (haptics) => set({ haptics }),
      setIdleHideMinutes: (idleHideMinutes) => set({ idleHideMinutes }),
      setTypewriterMode: (typewriterMode) => set({ typewriterMode }),
      setColorFilter: (colorFilter) => set((state) => ({ colorFilter, ...clearMain(state) })),
      setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
      setTheme: (theme) => set({ theme }),
      setEditorWidth: (editorWidth) => set({ editorWidth }),
      setEditorPadding: (editorPadding) => set({ editorPadding }),
      setFontSize: (size) => set({ fontSize: clamp(size, FONT_SIZE.min, FONT_SIZE.max) }),
      setEditorFont: (editorFont) => set({ editorFont }),
      setBrandColor: (brandColor) => set({ brandColor }),
      setRadius: (radius) =>
        set({ radius: Math.min(RADIUS.max, Math.max(RADIUS.min, radius)) }),
      setHeadingMode: (headingMode) => set({ headingMode }),
      resetAppearance: () =>
        set({ brandColor: null, radius: 0.625, headingMode: "theme", fontSize: 17 }),
      applyServerSettings: (settings) => set(settings),
    }),
    {
      name: "ursa.ui",
      // The server has no localStorage, so reading it during the first render
      // would make SSR and hydration disagree about pane width and theme.
      // Shell rehydrates on mount instead; see its useEffect.
      skipHydration: true,
      storage: guardedStorage,
      onRehydrateStorage: () => () => {
        hydrated = true;
      },
      partialize: (state) => ({
        listWidth: state.listWidth,
        theme: state.theme,
        editorWidth: state.editorWidth,
        editorPadding: state.editorPadding,
        brandColor: state.brandColor,
        radius: state.radius,
        headingMode: state.headingMode,
        fontSize: state.fontSize,
        editorFont: state.editorFont,
        focusMode: state.focusMode,
        outlineOpen: state.outlineOpen,
        readingMode: state.readingMode,
        privacyMode: state.privacyMode,
        autoPrivacy: state.autoPrivacy,
        focusDim: state.focusDim,
        haptics: state.haptics,
        idleHideMinutes: state.idleHideMinutes,
        typewriterMode: state.typewriterMode,
      }),
    },
  ),
);

/** The appearance that follows the user between devices (PRD R6.1). */
export interface SyncedSettings {
  theme: ThemeChoice;
  brandColor: string | null;
  radius: number;
  headingMode: HeadingMode;
  editorWidth: EditorWidth;
  editorPadding: EditorPadding;
  editorFont: EditorFont;
}

export function selectSynced(state: {
  theme: ThemeChoice;
  brandColor: string | null;
  radius: number;
  headingMode: HeadingMode;
  editorWidth: EditorWidth;
  editorPadding: EditorPadding;
  editorFont: EditorFont;
}): SyncedSettings {
  return {
    theme: state.theme,
    brandColor: state.brandColor,
    radius: state.radius,
    headingMode: state.headingMode,
    editorWidth: state.editorWidth,
    editorPadding: state.editorPadding,
    editorFont: state.editorFont,
  };
}

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
import * as W from "@/lib/workbench/workbench";
import type { Side } from "@/lib/workbench/layout";
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


interface UiState {
  filter: NoteFilter;
  query: string;
  selectedNoteId: string | null;
  mobilePane: MobilePane;
  /**
   * Editor groups and their tabs (PRD §4.81). On a wide screen the note shown
   * in the active group is selectedNoteId; a phone shows only that note.
   */
  wb: W.Workbench;
  /** Wide enough for tabs and groups; set by the shell. */
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
  /** Open a note in the active group (or `group`, or a new group on `side`). */
  openNote: (id: string, options?: { group?: string; side?: Side; preview?: boolean; index?: number }) => void;
  /** Apply any workbench action (lib/workbench/workbench.ts). */
  workbench: (action: (wb: W.Workbench) => W.Workbench) => void;
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

/**
 * A new workbench, and on a wide screen the note its active group shows as
 * the selection. On a phone the selection is whatever was last opened, and
 * going back to the list clears it without touching the tabs.
 */
function commit(state: Pick<UiState, "splitAvailable">, wb: W.Workbench, opened?: string) {
  if (state.splitAvailable) {
    const shown = W.shownNote(wb);
    return { wb, selectedNoteId: shown, ...(shown ? { mobilePane: "editor" as const } : {}) };
  }
  return { wb, ...(opened ? { selectedNoteId: opened, mobilePane: "editor" as const } : {}) };
}


export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      filter: "all",
      query: "",
      selectedNoteId: null,
      mobilePane: "list",
      wb: W.initialWorkbench(),
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

      // On a phone a new filter shows the list; on a wide screen the open notes stay open.
      setFilter: (filter) =>
        set((state) => (state.splitAvailable ? { filter } : { filter, selectedNoteId: null, mobilePane: "list" })),
      setQuery: (query) => set({ query }),
      selectNote: (id) =>
        set((state) => {
          if (id) return commit(state, W.openNote(state.wb, id), id);
          // Back to the list (a phone). On a wide screen the groups stay as they are.
          return state.splitAvailable ? {} : { selectedNoteId: null, mobilePane: "list" };
        }),
      openNote: (id, options) => set((state) => commit(state, W.openNote(state.wb, id, options), id)),
      workbench: (action) => set((state) => commit(state, action(state.wb))),
      setSplitAvailable: (splitAvailable) =>
        set((state) => {
          if (state.splitAvailable === splitAvailable) return {};
          // Growing wide: show the active group's note. Shrinking: keep what is shown.
          return splitAvailable ? { splitAvailable, ...commit({ splitAvailable }, state.wb) } : { splitAvailable };
        }),
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
      setColorFilter: (colorFilter) =>
        set((state) =>
          state.splitAvailable ? { colorFilter } : { colorFilter, selectedNoteId: null, mobilePane: "list" },
        ),
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
        // The editor layout comes back after a reload, as in VS Code (§4.81).
        wb: { ...state.wb, closed: [], maximized: null },
      }),
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<UiState>;
        return { ...current, ...stored, wb: W.restore(stored.wb) };
      },
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

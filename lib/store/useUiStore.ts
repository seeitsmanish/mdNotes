"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { NoteFilter } from "@/lib/types";

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
export type EditorFont = "sans" | "serif" | "mono";

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

  listWidth: number;
  focusMode: boolean;
  paletteOpen: boolean;
  settingsOpen: boolean;

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
  setMobilePane: (pane: MobilePane) => void;
  setListWidth: (width: number) => void;
  toggleFocusMode: () => void;
  setPaletteOpen: (open: boolean) => void;
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
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(value)));

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      filter: "all",
      query: "",
      selectedNoteId: null,
      mobilePane: "list",

      listWidth: 320,
      focusMode: false,
      paletteOpen: false,
      settingsOpen: false,

      theme: "forest",
      editorWidth: "regular",
      editorPadding: "medium",
      fontSize: 17,
      editorFont: "sans",

      brandColor: null,
      radius: 0.625,
      headingMode: "theme",

      setFilter: (filter) => set({ filter, selectedNoteId: null, mobilePane: "list" }),
      setQuery: (query) => set({ query }),
      selectNote: (id) => set({ selectedNoteId: id, mobilePane: id ? "editor" : "list" }),
      setMobilePane: (mobilePane) => set({ mobilePane }),
      setListWidth: (width) => set({ listWidth: clamp(width, LIST_BOUNDS.min, LIST_BOUNDS.max) }),
      toggleFocusMode: () => set((state) => ({ focusMode: !state.focusMode })),
      setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
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
    }),
    {
      name: "ursa.ui",
      // The server has no localStorage, so reading it during the first render
      // would make SSR and hydration disagree about pane width and theme.
      // Shell rehydrates on mount instead; see its useEffect.
      skipHydration: true,
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
      }),
    },
  ),
);

"use client";

import { useEffect, useRef, useState } from "react";
import {
  DownloadIcon,
  ImageOffIcon,
  LogOutIcon,
  MonitorSmartphoneIcon,
  RotateCcwIcon,
  SmartphoneIcon,
  UploadIcon,
} from "lucide-react";
import { installApp, useInstallMode } from "@/lib/pwa/install";
import { toast } from "sonner";
import { useUnseenRelease, WhatsNew } from "./WhatsNew";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { clearOfflineData } from "@/lib/pwa/offlineData";
import {
  BRAND_SWATCHES,
  EDITOR_PADDINGS,
  EDITOR_WIDTHS,
  FONT_SIZE,
  RADIUS,
  THEMES,
  EDITOR_FONTS,
  type HeadingMode,
  useUiStore,
} from "@/lib/store/useUiStore";

/**
 * Appearance: theme, colour tweaks, layout and type.
 *
 * Everything here writes one store value, which lands on <html> or the editor
 * host as a custom property — no component re-themes itself.
 */

const FONTS = EDITOR_FONTS;

const ON_OFF: Array<{ value: "on" | "off"; label: string }> = [
  { value: "off", label: "Off" },
  { value: "on", label: "On" },
];

const IDLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "0", label: "Never" },
  { value: "1", label: "1 min" },
  { value: "5", label: "5 min" },
  { value: "15", label: "15 min" },
];

const HEADINGS: Array<{ value: HeadingMode; label: string }> = [
  { value: "theme", label: "Theme" },
  { value: "brand", label: "Accent" },
  { value: "text", label: "Text" },
];

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** PRD §4.30. A failed request still leaves this device signed out locally. */
async function signOut(everywhere: boolean): Promise<void> {
  try {
    const response = await fetch(`/api/auth/logout${everywhere ? "?everywhere=true" : ""}`, { method: "POST" });
    if (!response.ok) throw new Error(`Sign-out failed (${response.status}).`);
  } catch (error) {
    if (everywhere) {
      toast.error("Couldn’t sign out the other devices.", {
        description: error instanceof Error ? error.message : undefined,
      });
      return;
    }
  }
  await clearOfflineData();
  window.location.href = "/login";
}

export function SettingsPanel() {
  const { unseen, markSeen } = useUnseenRelease();
  // Unused images (PRD §4.35): counted when the panel opens; the button only
  // appears when there is something to clean up.
  const [unused, setUnused] = useState<{ count: number; bytes: number } | null>(null);
  const [cleaning, setCleaning] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/attachments/unused")
      .then((response) => (response.ok ? response.json() : null))
      .then((value: { count: number; bytes: number } | null) => !cancelled && setUnused(value))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  const cleanUp = async () => {
    if (!unused || cleaning) return;
    const size = formatSize(unused.bytes);
    const noun = unused.count === 1 ? "image" : "images";
    if (!window.confirm(`Permanently delete ${unused.count} ${noun} (${size}) that no note or saved version uses? This cannot be undone.`)) {
      return;
    }
    setCleaning(true);
    try {
      const response = await fetch("/api/attachments/unused", { method: "DELETE" });
      if (!response.ok) throw new Error(`Clean-up failed (${response.status}).`);
      const { deleted, bytes } = (await response.json()) as { deleted: number; bytes: number };
      toast(`Deleted ${deleted} unused ${deleted === 1 ? "image" : "images"}, freeing ${formatSize(bytes)}.`);
      setUnused({ count: 0, bytes: 0 });
    } catch (error) {
      toast.error("Couldn’t clean up images.", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setCleaning(false);
    }
  };
  const installMode = useInstallMode();
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);

  async function runImport(files: FileList | null) {
    if (!files || files.length === 0) return;
    setImporting(true);

    const body = new FormData();
    for (const file of Array.from(files)) body.append("files", file);

    try {
      const response = await fetch("/api/import", { method: "POST", body });
      const result = (await response.json()) as {
        imported?: number;
        images?: number;
        skipped?: Array<{ path: string; reason: string }>;
        error?: string;
      };

      if (!response.ok) {
        toast.error(result.error ?? "Import failed.");
        return;
      }

      const skipped = result.skipped?.length ?? 0;
      // A silent import is indistinguishable from a broken one (R9.4).
      toast.success(
        `Imported ${result.imported} ${result.imported === 1 ? "note" : "notes"}` +
          (result.images ? ` and ${result.images} ${result.images === 1 ? "image" : "images"}.` : ".") +
          (skipped > 0 ? ` Skipped ${skipped}.` : ""),
        skipped > 0
          ? { description: result.skipped!.slice(0, 5).map((s) => `${s.path} — ${s.reason}`).join("\n") }
          : undefined,
      );
      // The list is server-rendered, so it needs a reload to show the new notes.
      setTimeout(() => window.location.reload(), 1200);
    } catch {
      toast.error("Could not reach the server.");
    } finally {
      setImporting(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const editorWidth = useUiStore((s) => s.editorWidth);
  const setEditorWidth = useUiStore((s) => s.setEditorWidth);
  const editorPadding = useUiStore((s) => s.editorPadding);
  const setEditorPadding = useUiStore((s) => s.setEditorPadding);
  const fontSize = useUiStore((s) => s.fontSize);
  const setFontSize = useUiStore((s) => s.setFontSize);
  const editorFont = useUiStore((s) => s.editorFont);
  const setEditorFont = useUiStore((s) => s.setEditorFont);
  const autoPrivacy = useUiStore((s) => s.autoPrivacy);
  const focusDim = useUiStore((s) => s.focusDim);
  const haptics = useUiStore((s) => s.haptics);
  const idleHideMinutes = useUiStore((s) => s.idleHideMinutes);
  const setIdleHideMinutes = useUiStore((s) => s.setIdleHideMinutes);
  const setHaptics = useUiStore((s) => s.setHaptics);
  const toggleFocusDim = useUiStore((s) => s.toggleFocusDim);
  const setAutoPrivacy = useUiStore((s) => s.setAutoPrivacy);
  const brandColor = useUiStore((s) => s.brandColor);
  const setBrandColor = useUiStore((s) => s.setBrandColor);
  const customAccent =
    brandColor !== null && !BRAND_SWATCHES.some((swatch) => swatch.value.toLowerCase() === brandColor.toLowerCase());
  const radius = useUiStore((s) => s.radius);
  const setRadius = useUiStore((s) => s.setRadius);
  const headingMode = useUiStore((s) => s.headingMode);
  const setHeadingMode = useUiStore((s) => s.setHeadingMode);
  const resetAppearance = useUiStore((s) => s.resetAppearance);

  return (
    <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
      {/* First, not last: below the fold of a long panel nobody found it. */}
      <WhatsNew unseen={unseen} onOpen={markSeen} />
      <Separator className="-mt-2" />
      <OptionGroup
        label="Theme"
        value={theme}
        options={THEMES}
        columns={3}
        onChange={setTheme}
      />

      <Separator />

      <Field label="Accent">
        <div className="flex flex-wrap items-center gap-1.5">
          <Swatch
            active={brandColor === null}
            onClick={() => setBrandColor(null)}
            title="Use the theme's own accent"
          >
            <span className="text-[0.6rem] font-medium text-muted-foreground">Auto</span>
          </Swatch>

          {BRAND_SWATCHES.map((swatch) => (
            <Swatch
              key={swatch.value}
              active={brandColor?.toLowerCase() === swatch.value.toLowerCase()}
              onClick={() => setBrandColor(swatch.value)}
              title={swatch.label}
            >
              <span className="size-4 rounded-full" style={{ background: swatch.value }} aria-hidden />
            </Swatch>
          ))}

          <label
            className={`relative size-7 cursor-pointer overflow-hidden rounded-md border ${
              customAccent ? "border-transparent ring-2 ring-ink ring-offset-2 ring-offset-popover" : "border-border"
            }`}
            title={customAccent ? `Custom colour (${brandColor})` : "Custom colour"}
          >
            <span className="sr-only">Custom accent colour</span>
            <span
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  "conic-gradient(from 180deg, #f87171, #fbbf24, #34d399, #60a5fa, #a78bfa, #f87171)",
              }}
            />
            {/* A custom pick shows its own colour in the middle, so the chosen accent is visible. */}
            {customAccent && (
              <span
                aria-hidden
                className="absolute inset-[5px] rounded-full ring-2 ring-white/80"
                style={{ background: brandColor ?? undefined }}
              />
            )}
            <input
              type="color"
              value={brandColor ?? "#6ee7a8"}
              onChange={(event) => setBrandColor(event.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>
      </Field>

      <OptionGroup
        label="Headings"
        value={headingMode}
        options={HEADINGS}
        columns={3}
        onChange={setHeadingMode}
      />

      <Field label={`Radius — ${radius}rem`}>
        <Slider
          value={[radius]}
          min={RADIUS.min}
          max={RADIUS.max}
          step={RADIUS.step}
          onValueChange={(value) => setRadius((Array.isArray(value) ? value[0] : value) ?? RADIUS.min)}
          aria-label="Corner radius"
        />
      </Field>

      <Separator />

      <OptionGroup
        label="Width"
        value={editorWidth}
        options={EDITOR_WIDTHS}
        columns={4}
        onChange={setEditorWidth}
      />

      <OptionGroup
        label="Padding"
        value={editorPadding}
        options={EDITOR_PADDINGS}
        columns={4}
        onChange={setEditorPadding}
      />

      <Field label={`Text size — ${fontSize}px`}>
        <Slider
          value={[fontSize]}
          min={FONT_SIZE.min}
          max={FONT_SIZE.max}
          step={FONT_SIZE.step}
          onValueChange={(value) =>
            setFontSize((Array.isArray(value) ? value[0] : value) ?? FONT_SIZE.min)
          }
          aria-label="Editor text size"
        />
      </Field>

      <OptionGroup
        label="Typeface"
        value={editorFont}
        options={FONTS}
        columns={4}
        onChange={setEditorFont}
      />

      <OptionGroup
        label="Fade other paragraphs while writing"
        value={focusDim ? "on" : "off"}
        options={ON_OFF}
        columns={2}
        onChange={(value) => {
          if ((value === "on") !== focusDim) toggleFocusDim();
        }}
      />

      <OptionGroup
        label="Vibrate on gestures (phones)"
        value={haptics ? "on" : "off"}
        options={ON_OFF}
        columns={2}
        onChange={(value) => setHaptics(value === "on")}
      />

      {/* PRD §4.62: leaving the tab blurs note titles until Show. */}
      <OptionGroup
        label="Hide titles when I leave the tab"
        value={autoPrivacy ? "on" : "off"}
        options={ON_OFF}
        columns={2}
        onChange={(value) => setAutoPrivacy(value === "on")}
      />

      <OptionGroup
        label="Hide titles when idle"
        value={String(idleHideMinutes)}
        options={IDLE_OPTIONS}
        columns={4}
        onChange={(value) => setIdleHideMinutes(Number(value))}
      />

      <Separator />

      <Button variant="ghost" size="sm" onClick={resetAppearance} className="justify-start px-2">
        <RotateCcwIcon />
        Reset appearance
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="justify-start px-2"
        // The shell owns exporting: locked notes need the passcode first (PRD R69.7).
        onClick={() => window.dispatchEvent(new Event("ursa:export"))}
      >
        <DownloadIcon />
        Export all notes
      </Button>

      <input
        ref={fileInput}
        type="file"
        accept=".zip,.md,.markdown,.mdown,.txt"
        multiple
        hidden
        onChange={(event) => void runImport(event.target.files)}
      />
      <Button
        variant="ghost"
        size="sm"
        className="justify-start px-2"
        disabled={importing}
        onClick={() => fileInput.current?.click()}
      >
        <UploadIcon />
        {importing ? "Importing…" : "Import notes"}
      </Button>

      {unused && unused.count > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="justify-start px-2"
          disabled={cleaning}
          onClick={() => void cleanUp()}
        >
          <ImageOffIcon />
          {cleaning
            ? "Cleaning up…"
            : `Clean up ${unused.count} unused ${unused.count === 1 ? "image" : "images"} (${formatSize(unused.bytes)})`}
        </Button>
      )}

      {installMode !== "installed" && (
        <Button variant="ghost" size="sm" className="justify-start px-2" onClick={() => void installApp()}>
          <SmartphoneIcon />
          Install as an app
        </Button>
      )}

      <Separator className="my-1" />

      <Button variant="ghost" size="sm" className="justify-start px-2" onClick={() => void signOut(false)}>
        <LogOutIcon />
        Sign out
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="justify-start px-2"
        onClick={() => {
          if (
            window.confirm(
              "Sign out on every device, including this one? Anyone using a copied sign-in will be locked out too.",
            )
          ) {
            void signOut(true);
          }
        }}
      >
        <MonitorSmartphoneIcon />
        Sign out everywhere
      </Button>
    </div>
  );
}

/**
 * Base UI's ToggleGroup is array-valued even when single-select, so the
 * array/scalar translation lives here rather than at six call sites.
 */
function OptionGroup<T extends string>({
  label,
  value,
  options,
  columns,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string; css?: string }>;
  columns: number;
  onChange: (value: T) => void;
}) {
  return (
    <Field label={label}>
      <ToggleGroup
        value={[value]}
        onValueChange={(next) => {
          const picked = next[0] as T | undefined;
          if (picked) onChange(picked);
        }}
        variant="outline"
        className="grid w-full gap-1"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            // The chosen option must be obvious at a glance (PRD R61.7): the
            // shared toggle's pressed fill is a near-invisible grey.
            className="text-xs aria-pressed:border-brand aria-pressed:bg-brand-soft aria-pressed:font-semibold aria-pressed:text-brand data-[pressed]:border-brand data-[pressed]:bg-brand-soft data-[pressed]:font-semibold data-[pressed]:text-brand"
            style={option.css ? { fontFamily: option.css } : undefined}
          >
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </Field>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function Swatch({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      aria-label={title}
      className={`flex size-7 items-center justify-center rounded-md border transition-colors ${
        active ? "border-transparent ring-2 ring-ink ring-offset-2 ring-offset-popover" : "border-border hover:border-border-strong"
      }`}
    >
      {children}
    </button>
  );
}

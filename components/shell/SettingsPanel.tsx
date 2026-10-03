"use client";

import { useRef, useState } from "react";
import { DownloadIcon, RotateCcwIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { useUnseenRelease, WhatsNew } from "./WhatsNew";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  BRAND_SWATCHES,
  EDITOR_PADDINGS,
  EDITOR_WIDTHS,
  FONT_SIZE,
  RADIUS,
  THEMES,
  type EditorFont,
  type HeadingMode,
  useUiStore,
} from "@/lib/store/useUiStore";

/**
 * Appearance: theme, colour tweaks, layout and type.
 *
 * Everything here writes one store value, which lands on <html> or the editor
 * host as a custom property — no component re-themes itself.
 */

const FONTS: Array<{ value: EditorFont; label: string; css: string }> = [
  { value: "sans", label: "Sans", css: "var(--font-sans)" },
  { value: "serif", label: "Serif", css: "var(--font-serif)" },
  { value: "mono", label: "Mono", css: "var(--font-mono)" },
];

const HEADINGS: Array<{ value: HeadingMode; label: string }> = [
  { value: "theme", label: "Theme" },
  { value: "brand", label: "Accent" },
  { value: "text", label: "Text" },
];

export function SettingsPanel() {
  const { unseen, markSeen } = useUnseenRelease();
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
        `Imported ${result.imported} ${result.imported === 1 ? "note" : "notes"}.` +
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
  const brandColor = useUiStore((s) => s.brandColor);
  const setBrandColor = useUiStore((s) => s.setBrandColor);
  const radius = useUiStore((s) => s.radius);
  const setRadius = useUiStore((s) => s.setRadius);
  const headingMode = useUiStore((s) => s.headingMode);
  const setHeadingMode = useUiStore((s) => s.setHeadingMode);
  const resetAppearance = useUiStore((s) => s.resetAppearance);

  return (
    <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
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
              active={brandColor === swatch.value}
              onClick={() => setBrandColor(swatch.value)}
              title={swatch.label}
            >
              <span className="size-4 rounded-full" style={{ background: swatch.value }} aria-hidden />
            </Swatch>
          ))}

          <label
            className="relative size-7 cursor-pointer overflow-hidden rounded-md border border-border"
            title="Custom colour"
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
        columns={3}
        onChange={setEditorFont}
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
        onClick={() => {
          const link = document.createElement("a");
          link.href = "/api/export";
          link.download = "ursa-notes.zip";
          document.body.append(link);
          link.click();
          link.remove();
        }}
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

      <WhatsNew unseen={unseen} onOpen={markSeen} />
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
            className="text-xs"
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
        active ? "border-brand ring-2 ring-brand/35" : "border-border hover:border-border-strong"
      }`}
    >
      {children}
    </button>
  );
}

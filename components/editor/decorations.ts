import { syntaxTree } from "@codemirror/language";
import { type Range, RangeSet } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { safeExternalUrl } from "@/lib/security/urls";
import { hangingPrefix } from "./hangingIndent";
import { openLightbox } from "./lightbox";

let measureCanvas: CanvasRenderingContext2D | null = null;

/**
 * Pixel width of a list item's prefix in the editor's own font, so wrapped
 * lines hang exactly under the text (PRD R2.10). Measured rather than guessed
 * in `ch`: in a proportional face "14. " is nowhere near four zeros wide.
 */
function prefixWidth(view: EditorView, text: string, extraEm: number): number {
  const style = getComputedStyle(view.contentDOM);
  measureCanvas ??= document.createElement("canvas").getContext("2d");
  const fontSize = parseFloat(style.fontSize) || 16;
  if (!measureCanvas) return text.length * fontSize * 0.5 + extraEm * fontSize;
  measureCanvas.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  return measureCanvas.measureText(text).width + extraEm * fontSize;
}

/**
 * Live markdown styling, driven by the Lezer syntax tree.
 *
 * The tree is parsed incrementally by CodeMirror, so an edit re-parses the
 * changed region rather than the whole note, and decorations are built only
 * over `view.visibleRanges`.
 *
 * Syntax markers are replaced away unless the caret is on their line, which is
 * the reveal-on-edit behaviour that makes single-pane markdown readable.
 */

const HIDE = Decoration.replace({});

/**
 * Where a hidden mark's replacement ends. An opening `## ` takes its space
 * with it: left behind, that space — set at the heading's larger size — pushed
 * every heading a few pixels right of the paragraphs under it.
 */
export function headingMarkEnd(
  doc: { lineAt(pos: number): { from: number; to: number; text: string } },
  name: string,
  from: number,
  to: number,
): number {
  if (name !== "HeaderMark") return to;
  const line = doc.lineAt(from);
  // Only the opening mark: the first non-blank thing on its line.
  if (line.text.slice(0, from - line.from).trim() !== "") return to;
  let end = to;
  while (end < line.to && (line.text[end - line.from] === " " || line.text[end - line.from] === "\t")) end += 1;
  return end;
}

/** Punctuation that disappears when the caret is elsewhere. */
const HIDDEN_MARKS = new Set([
  "HeaderMark",
  "EmphasisMark",
  "StrikethroughMark",
  "HighlightMark",
  "SlashEmphasisMark",
  "LinkMark",
  "QuoteMark",
  "URL",
  "LinkTitle",
  "CodeMark",
  "WikiLinkMark",
  "SpoilerMark",
]);

const HEADING_LINE: Record<string, string> = {
  ATXHeading1: "ursa-h1",
  ATXHeading2: "ursa-h2",
  ATXHeading3: "ursa-h3",
  ATXHeading4: "ursa-h4",
  ATXHeading5: "ursa-h5",
  ATXHeading6: "ursa-h6",
  SetextHeading1: "ursa-h1",
  SetextHeading2: "ursa-h2",
};

/** The box just clicked, so its replacement widget can pop (PRD §4.48). */
let lastToggle: { from: number; at: number } | null = null;

class CheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly from: number,
    readonly to: number,
  ) {
    super();
  }

  eq(other: CheckboxWidget): boolean {
    return other.checked === this.checked && other.from === this.from;
  }

  toDOM(view: EditorView): HTMLElement {
    const box = document.createElement("input");
    box.type = "checkbox";
    box.className = "ursa-checkbox";
    box.checked = this.checked;
    box.setAttribute("aria-label", this.checked ? "Mark as not done" : "Mark as done");
    if (this.checked && lastToggle && lastToggle.from === this.from && Date.now() - lastToggle.at < 600) {
      box.classList.add("ursa-pop");
    }

    box.addEventListener("mousedown", (event) => {
      event.preventDefault();
      lastToggle = { from: this.from, at: Date.now() };
      view.dispatch({
        changes: { from: this.from, to: this.to, insert: this.checked ? "[ ]" : "[x]" },
      });
    });

    return box;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

class RuleWidget extends WidgetType {
  eq(): boolean {
    return true;
  }

  toDOM(): HTMLElement {
    const rule = document.createElement("span");
    rule.className = "ursa-rule";
    rule.setAttribute("aria-hidden", "true");
    return rule;
  }
}

/**
 * The language chip that stands in for ```json. With the fence's backticks
 * hidden, the chip is the only thing on that line — so a code block reads as a
 * labelled container rather than a row of grey punctuation.
 */
/**
 * A note's image, shown in place of its markdown when the caret is elsewhere
 * (PRD §4.24). Only this app's attachments and https images are drawn —
 * anything else stays as text.
 */
class ImageWidget extends WidgetType {
  constructor(
    readonly src: string,
    readonly alt: string,
  ) {
    super();
  }

  eq(other: ImageWidget): boolean {
    return other.src === this.src && other.alt === this.alt;
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement("span");
    wrap.className = "ursa-image";
    const img = document.createElement("img");
    img.src = this.src;
    img.alt = this.alt;
    img.loading = "lazy";
    img.decoding = "async";
    img.draggable = false;
    // The line's height changes when the image arrives; tell the editor.
    img.addEventListener("load", () => view.requestMeasure());
    img.addEventListener("error", () => wrap.classList.add("ursa-image-broken"));
    // A tap opens the viewer instead of revealing the markdown (PRD §4.50).
    img.addEventListener("mousedown", (event) => {
      if (event.button !== 0 || wrap.classList.contains("ursa-image-broken")) return;
      event.preventDefault();
      event.stopPropagation();
      openLightbox({
        src: this.src,
        alt: this.alt,
        onEdit: () => {
          const at = view.posAtDOM(wrap);
          view.dispatch({ selection: { anchor: view.state.doc.lineAt(at).to }, scrollIntoView: true });
          view.focus();
        },
      });
    });
    wrap.append(img);
    return wrap;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

function drawableImage(src: string): boolean {
  return /^\/api\/attachments\/[a-z0-9]{20,40}$/.test(src) || /^https:\/\//i.test(src);
}

class LangWidget extends WidgetType {
  constructor(readonly lang: string) {
    super();
  }

  eq(other: LangWidget): boolean {
    return other.lang === this.lang;
  }

  toDOM(): HTMLElement {
    const chip = document.createElement("span");
    chip.className = "ursa-lang";
    chip.textContent = this.lang;
    return chip;
  }
}

function activeLines(view: EditorView): Set<number> {
  const lines = new Set<number>();
  for (const range of view.state.selection.ranges) {
    const from = view.state.doc.lineAt(range.from).number;
    const to = view.state.doc.lineAt(range.to).number;
    for (let line = from; line <= to; line += 1) lines.add(line);
  }
  return lines;
}

function buildDecorations(view: EditorView): DecorationSet {
  const ranges: Range<Decoration>[] = [];
  const active = activeLines(view);
  const { doc } = view.state;

  const seenLines = new Set<string>();
  const lineClass = (from: number, to: number, cls: string) => {
    const first = doc.lineAt(from).number;
    const last = doc.lineAt(Math.min(to, doc.length)).number;
    for (let number = first; number <= last; number += 1) {
      const key = `${number}:${cls}`;
      if (seenLines.has(key)) continue;
      seenLines.add(key);
      ranges.push(Decoration.line({ class: cls }).range(doc.line(number).from));
    }
  };

  const isRevealed = (from: number, to: number) => {
    const first = doc.lineAt(from).number;
    const last = doc.lineAt(Math.min(to, doc.length)).number;
    for (let line = first; line <= last; line += 1) if (active.has(line)) return true;
    return false;
  };

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        const name = node.name;

        const heading = HEADING_LINE[name];
        if (heading) {
          lineClass(node.from, node.to, heading);
          return;
        }

        switch (name) {
          case "ListItem": {
            // Wrapped lines continue under the item's text, not under its
            // number. Descends afterwards so the marker is still styled.
            const line = doc.lineAt(node.from);
            const prefix = hangingPrefix(line.text);
            if (prefix) {
              const px = prefixWidth(view, prefix.text, prefix.extraEm).toFixed(2);
              ranges.push(
                Decoration.line({
                  attributes: {
                    style: `padding-left: calc(var(--line-pad) + ${px}px); text-indent: -${px}px`,
                  },
                }).range(line.from),
              );
            }
            break;
          }

          case "Blockquote":
            lineClass(node.from, node.to, "ursa-quote");
            return;

          case "FencedCode":
          case "CodeBlock": {
            // The block's first and last rows carry the rounded edges and the
            // vertical padding, so it reads as one container.
            const first = doc.lineAt(node.from).number;
            const last = doc.lineAt(Math.min(node.to, doc.length)).number;
            for (let number = first; number <= last; number += 1) {
              const classes = ["ursa-codeblock"];
              if (number === first) classes.push("ursa-code-top");
              if (number === last) classes.push("ursa-code-bottom");
              const key = `${number}:code`;
              if (seenLines.has(key)) continue;
              seenLines.add(key);
              ranges.push(
                Decoration.line({ class: classes.join(" ") }).range(doc.line(number).from),
              );
            }
            return;
          }

          case "Table":
            // Only the being-edited case lives here. The rendered table is a
            // block decoration, which CodeMirror requires to come from a
            // StateField — see tableField.ts.
            if (isRevealed(node.from, node.to)) lineClass(node.from, node.to, "ursa-table");
            return;

          case "CodeInfo": {
            if (!isRevealed(node.from, node.to)) {
              ranges.push(
                Decoration.replace({
                  widget: new LangWidget(view.state.sliceDoc(node.from, node.to)),
                }).range(node.from, node.to),
              );
            }
            return;
          }

          case "HorizontalRule": {
            if (!isRevealed(node.from, node.to) && node.to > node.from) {
              ranges.push(
                Decoration.replace({ widget: new RuleWidget() }).range(node.from, node.to),
              );
            }
            return;
          }

          case "ListMark": {
            // A todo already shows a checkbox, so its bullet is noise. Lezer
            // nests these as ListItem > ListMark + Task > TaskMarker.
            const isTask = node.node.parent?.getChild("Task") != null;
            if (isTask) {
              ranges.push(HIDE.range(node.from, node.to));
            } else {
              ranges.push(
                Decoration.mark({ class: "ursa-list-marker" }).range(node.from, node.to),
              );
            }
            return;
          }

          case "TaskMarker": {
            const text = view.state.sliceDoc(node.from, node.to);
            const checked = /\[[xX]\]/.test(text);
            if (checked) lineClass(node.from, node.to, "ursa-todo-done");
            ranges.push(
              Decoration.replace({
                widget: new CheckboxWidget(checked, node.from, node.to),
              }).range(node.from, node.to),
            );
            return;
          }

          case "WikiLink": {
            // The target text carries the title so a click can resolve it
            // without re-parsing from the DOM.
            const inner = view.state.sliceDoc(node.from + 2, node.to - 2);
            ranges.push(
              Decoration.mark({
                class: "ursa-wikilink-target",
                attributes: { "data-ursa-wikilink": inner.trim() },
              }).range(node.from + 2, node.to - 2),
            );
            return;
          }

          case "Image": {
            if (isRevealed(node.from, node.to)) return;
            const urlNode = node.node.getChild("URL");
            if (!urlNode) return;
            const src = view.state.sliceDoc(urlNode.from, urlNode.to).trim();
            if (!drawableImage(src)) return;
            const text = view.state.sliceDoc(node.from, node.to);
            const alt = /^!\[([^\]]*)\]/.exec(text)?.[1] ?? "";
            ranges.push(
              Decoration.replace({ widget: new ImageWidget(src, alt) }).range(node.from, node.to),
            );
            return false;
          }

          case "Spoiler": {
            // Hidden until its line is being edited — the same bargain as
            // every other marker, so clicking the line is how you peek.
            if (!isRevealed(node.from, node.to)) {
              ranges.push(
                Decoration.mark({
                  class: "ursa-spoiler",
                  attributes: { title: "Click to reveal" },
                }).range(node.from, node.to),
              );
            }
            return;
          }

          case "BearTag": {
            ranges.push(
              Decoration.mark({
                class: "ursa-tag-pill",
                attributes: { "data-ursa-tag": view.state.sliceDoc(node.from, node.to) },
              }).range(node.from, node.to),
            );
            return;
          }

          default:
            break;
        }

        if (HIDDEN_MARKS.has(name) && node.to > node.from && !isRevealed(node.from, node.to)) {
          ranges.push(HIDE.range(node.from, headingMarkEnd(doc, name, node.from, node.to)));
        }
      },
    });
  }

  return RangeSet.of(ranges, true);
}

export interface MarkdownStyleOptions {
  onLinkClick?: (href: string) => void;
  /** A wiki-link was clicked; the shell decides whether to open or create. */
  onWikiLink?: (title: string) => void;
  /** A #tag was tapped on a line that is not being edited (PRD R40.3). */
  onTag?: (tag: string) => void;
}

/** `##work` and `#multi word#` search as `#work` and `#multi word`. */
export function tagQuery(raw: string): string {
  const inner = raw.replace(/^#+/, "").replace(/#$/, "").trim();
  return inner ? `#${inner}` : "";
}

export function markdownStyling(options: MarkdownStyleOptions = {}) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged || update.selectionSet) {
          this.decorations = buildDecorations(update.view);
        }
      }
    },
    {
      decorations: (plugin) => plugin.decorations,
      eventHandlers: {
        mousedown(event: MouseEvent, view: EditorView) {
          // Wiki-links are plain clicks: they go to another note in the same
          // app, so requiring a modifier would just be friction.
          const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(
            "[data-ursa-wikilink]",
          );
          if (target && options.onWikiLink) {
            const title = target.dataset.ursaWikilink;
            if (title) {
              event.preventDefault();
              options.onWikiLink(title);
              return true;
            }
          }

          // A tag searches for itself — unless its line is being edited, where
          // a tap has to place the caret like anywhere else.
          const tag = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-ursa-tag]");
          if (tag && options.onTag && !event.metaKey && !event.ctrlKey) {
            const at = view.posAtDOM(tag);
            const line = view.state.doc.lineAt(at);
            const editing = view.hasFocus && view.state.selection.ranges.some(
              (range) => range.head >= line.from && range.head <= line.to,
            );
            const query = tagQuery(tag.dataset.ursaTag ?? "");
            if (!editing && query) {
              event.preventDefault();
              options.onTag(query);
              return true;
            }
          }

          if (!event.metaKey && !event.ctrlKey) return false;

          const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
          if (pos === null) return false;

          const raw = linkAt(view, pos);
          if (!raw) return false;

          // Notes come from imports, so their links are untrusted: only
          // http(s) and mailto are ever opened (docs/SECURITY-AUDIT.md A2).
          event.preventDefault();
          const href = safeExternalUrl(raw);
          if (!href) return true;
          (options.onLinkClick ??
            ((url: string) => window.open(url, "_blank", "noopener,noreferrer")))(href);
          return true;
        },
      },
    },
  );
}

/** The URL of the link or autolink under `pos`, if there is one. */
function linkAt(view: EditorView, pos: number): string | null {
  let node = syntaxTree(view.state).resolveInner(pos, 1);

  while (node.parent) {
    if (node.name === "Link" || node.name === "Autolink" || node.name === "URL") break;
    node = node.parent;
  }

  if (node.name === "URL" || node.name === "Autolink") {
    return view.state.sliceDoc(node.from, node.to).replace(/^<|>$/g, "");
  }

  if (node.name === "Link") {
    const url = node.getChild("URL");
    if (url) return view.state.sliceDoc(url.from, url.to);
  }

  return null;
}

import {
  autocompletion,
  startCompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { syntaxTree } from "@codemirror/language";
import type { EditorView } from "@codemirror/view";
import { pickImages } from "./imagePaste";
import { emojiSource } from "./emojiComplete";
import { noteTitles, peekTitles, wikiSource } from "./wikiComplete";

/**
 * The `/` menu (PRD §4.41): type `/` at the start of a line for a list of
 * blocks, keep typing to narrow it, Enter or tap to insert. It writes the same
 * markdown the keyboard would — on a phone there is no ⌘B, and the format bar
 * only holds so much.
 */

const CARET = "‸";

export interface SlashItem {
  id: string;
  label: string;
  /** Extra words it answers to: `/h1`, `/check`, `/hr`. */
  keywords: string;
  /** Text that replaces `/query`, with `‸` marking where the caret lands. */
  insert?: string;
  /** Instead of text: something that needs the view, like a file picker. */
  run?: (view: EditorView, at: number) => void;
  /** Runs after the insert — Link to note goes straight on to its titles. */
  then?: (view: EditorView) => void;
}

export const SLASH_ITEMS: SlashItem[] = [
  { id: "h1", label: "Heading 1", keywords: "h1 title", insert: "# ‸" },
  { id: "h2", label: "Heading 2", keywords: "h2 subtitle", insert: "## ‸" },
  { id: "h3", label: "Heading 3", keywords: "h3", insert: "### ‸" },
  { id: "todo", label: "To-do", keywords: "check checkbox task", insert: "- [ ] ‸" },
  { id: "bullet", label: "Bulleted list", keywords: "ul list bullet", insert: "- ‸" },
  { id: "numbered", label: "Numbered list", keywords: "ol list number", insert: "1. ‸" },
  { id: "quote", label: "Quote", keywords: "blockquote", insert: "> ‸" },
  { id: "code", label: "Code block", keywords: "fence pre snippet", insert: "```‸\n\n```" },
  { id: "table", label: "Table", keywords: "grid", insert: "| ‸Column‸ | Column |\n| --- | --- |\n|  |  |" },
  { id: "divider", label: "Divider", keywords: "hr rule line separator", insert: "---\n‸" },
  { id: "spoiler", label: "Spoiler", keywords: "hide answer secret", insert: "||‸||" },
  { id: "link", label: "Link", keywords: "url", insert: "[‸](url)" },
  { id: "wikilink", label: "Link to note", keywords: "wiki note backlink", insert: "[[‸]]", then: startCompletion },
  { id: "image", label: "Image", keywords: "picture photo upload", run: (view, at) => pickImages(view, at) },
];

/** Where the query starts and what it is, or null if `/` is not opening a line. */
export function slashQuery(textBeforeCaret: string): { offset: number; query: string } | null {
  // Words may follow (`/link to`), but not a space straight after the slash.
  const match = /^(\s*)\/((?:[\w-]+ ?)*)$/.exec(textBeforeCaret);
  if (!match) return null;
  return { offset: match[1]!.length, query: match[2]!.toLowerCase() };
}

/**
 * Items matching a query. Every word typed must start a word of the item's
 * label or keywords; items whose label matches the first word come first.
 */
export function matchItems(query: string, items: SlashItem[] = SLASH_ITEMS): SlashItem[] {
  const typed = query.trim().split(/\s+/).filter(Boolean);
  if (typed.length === 0) return items;
  const words = (s: string) => s.toLowerCase().split(/[\s-]+/);
  const matches = items.filter((item) => {
    const all = [...words(item.label), ...words(item.keywords)];
    return typed.every((t) => all.some((w) => w.startsWith(t)));
  });
  const first = typed[0]!;
  const byLabel = matches.filter((item) => words(item.label).some((w) => w.startsWith(first)));
  return [...byLabel, ...matches.filter((item) => !byLabel.includes(item))];
}

/**
 * Splits an insert template into its text and where the selection lands: one
 * `‸` is the caret, two select what lies between them (a placeholder that
 * typing replaces).
 */
export function template(insert: string): { text: string; anchor: number; head: number } {
  // Not `|`: tables and spoilers are made of pipes.
  const parts = insert.split(CARET);
  const text = parts.join("");
  if (parts.length === 1) return { text, anchor: text.length, head: text.length };
  const anchor = parts[0]!.length;
  const head = parts.length > 2 ? anchor + parts[1]!.length : anchor;
  return { text, anchor, head };
}

function inCode(context: CompletionContext): boolean {
  for (let node: ReturnType<typeof syntaxTree>["topNode"] | null = syntaxTree(context.state).resolveInner(context.pos, -1); node; node = node.parent) {
    if (node.name === "FencedCode" || node.name === "CodeBlock" || node.name === "InlineCode") return true;
  }
  return false;
}

export function slashSource(context: CompletionContext): CompletionResult | null {
  const line = context.state.doc.lineAt(context.pos);
  const found = slashQuery(line.text.slice(0, context.pos - line.from));
  if (!found || inCode(context)) return null;
  const from = line.from + found.offset;

  const options: Completion[] = matchItems(found.query).map((item, index) => ({
    label: item.label,
    boost: -index,
    apply: (view, _completion, start, end) => {
      if (item.run) {
        view.dispatch({ changes: { from: start, to: end }, selection: { anchor: start } });
        item.run(view, start);
        return;
      }
      const { text, anchor, head } = template(item.insert ?? "");
      view.dispatch({
        changes: { from: start, to: end, insert: text },
        selection: { anchor: start + anchor, head: start + head },
        scrollIntoView: true,
        userEvent: "input.format",
      });
      // After this completion has closed, or the new one would be swallowed.
      if (item.then) setTimeout(() => item.then?.(view), 0);
    },
  }));
  if (options.length === 0) return null;
  // We filter ourselves (keywords count), so no validFor: the source runs
  // again on every keystroke rather than CodeMirror re-filtering by label.
  return { from, options, filter: false };
}

/** The editor's one autocomplete: `/` blocks, `[[` titles (§4.45), `:` emoji (§4.49). */
export const slashMenu = autocompletion({
  override: [slashSource, wikiSource(noteTitles, peekTitles), emojiSource],
  icons: false,
  closeOnBlur: true,
  activateOnTyping: true,
  activateOnTypingDelay: 0,
  aboveCursor: false,
  optionClass: () => "ursa-slash-option",
  tooltipClass: () => "ursa-slash-menu",
});

import type { Completion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { emojiQuery, searchEmoji } from "@/lib/emoji/emoji";

/** `:fire` → 🔥 (PRD §4.49): suggestions after a colon, replacing the code. */
export function emojiSource(context: CompletionContext): CompletionResult | null {
  const line = context.state.doc.lineAt(context.pos);
  const found = emojiQuery(line.text.slice(0, context.pos - line.from));
  if (!found) return null;
  const options: Completion[] = searchEmoji(found.query, 12).map((emoji, index) => ({
    label: `${emoji.e}  ${emoji.n}`,
    boost: -index,
    apply: (view, _c, from, to) => {
      view.dispatch({
        changes: { from, to, insert: emoji.e },
        selection: { anchor: from + emoji.e.length },
        userEvent: "input.complete",
      });
    },
  }));
  if (options.length === 0) return null;
  return { from: line.from + found.offset, options, filter: false };
}

"use client";

import { useEffect, useState } from "react";
import { EditorView } from "@codemirror/view";
import { activeHeading, type OutlineItem, readOutline } from "@/components/editor/outline";

/**
 * Headings of the open note (PRD §4.14).
 *
 * Reads from the live editor state rather than the saved body, so the outline
 * tracks what you are typing, not what was last persisted.
 */

const MIN_HEADINGS = 2;

export function Outline({ view, open }: { view: EditorView | null; open: boolean }) {
  const [items, setItems] = useState<OutlineItem[]>([]);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    if (!view || !open) {
      setItems([]);
      return;
    }

    const refresh = () => {
      const next = readOutline(view.state);
      setItems(next);
      setActive(activeHeading(next, view.state.selection.main.head));
    };

    refresh();
    // CodeMirror owns its own update cycle, so React is told about changes by
    // polling the view rather than by subscribing from inside a render.
    const timer = setInterval(refresh, 400);
    return () => clearInterval(timer);
  }, [view, open]);

  // An outline of one item is furniture, not a feature (R14.3).
  if (!open || items.length < MIN_HEADINGS) return null;

  const smallest = Math.min(...items.map((item) => item.level));

  return (
    <aside className="hidden w-56 flex-none overflow-y-auto border-l border-border bg-list/50 px-2 py-3 @[1100px]:block">
      <h2 className="px-2 pb-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-ink-faint">
        Outline
      </h2>
      <ul className="flex flex-col">
        {items.map((item) => (
          <li key={`${item.from}-${item.text}`}>
            <button
              type="button"
              onClick={() => {
                if (!view) return;
                view.dispatch({
                  selection: { anchor: item.from },
                  effects: EditorView.scrollIntoView(item.from, { y: "start", yMargin: 24 }),
                });
                view.focus();
              }}
              style={{ paddingLeft: `${0.5 + (item.level - smallest) * 0.6}rem` }}
              className={`block w-full truncate rounded-md py-1 pr-2 text-left text-[0.74rem] leading-snug transition-colors ${
                active === item.from
                  ? "bg-brand-soft font-medium text-brand"
                  : "text-ink-soft hover:bg-row-hover hover:text-ink"
              }`}
              title={item.text}
            >
              {item.text}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}

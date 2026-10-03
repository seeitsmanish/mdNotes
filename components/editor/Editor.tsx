"use client";

import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownKeymap, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { syntaxHighlighting } from "@codemirror/language";
import { BearMarkup } from "./bearMarkup";
import { ursaHighlightStyle } from "./highlightStyle";
import { markdownStyling } from "./decorations";
import { tableField } from "./tableField";
import { smartPaste, ursaKeymap } from "./commands";
import { calcField } from "./calcField";
import { imagePaste } from "./imagePaste";

/**
 * The single-pane markdown editor.
 *
 * Structure comes from Lezer's markdown parser, which also parses the contents
 * of a fenced block in whatever language it declares — that is what gives
 * ```json real syntax highlighting rather than grey text.
 */

export interface EditorStats {
  words: number;
  characters: number;
}

interface EditorProps {
  noteId: string | null;
  initialBody: string;
  readOnly?: boolean;
  onChange: (noteId: string, body: string) => void;
  onBlur?: () => void;
  onStats?: (stats: EditorStats) => void;
  onWikiLink?: (title: string) => void;
  /** Hands the live view out so the format bar can run commands against it. */
  onReady?: (view: EditorView | null) => void;
}

export function Editor({
  noteId,
  initialBody,
  readOnly = false,
  onChange,
  onBlur,
  onStats,
  onWikiLink,
  onReady,
}: EditorProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const view = useRef<EditorView | null>(null);

  // Callbacks live in a ref so changing one never rebuilds the editor state.
  const handlers = useRef({ onChange, onBlur, onStats, onWikiLink, noteId });
  handlers.current = { onChange, onBlur, onStats, onWikiLink, noteId };

  useEffect(() => {
    if (!host.current) return;

    const instance = new EditorView({
      parent: host.current,
      state: buildState(initialBody, readOnly, handlers),
    });
    view.current = instance;
    handlers.current.onStats?.(measure(initialBody));
    onReady?.(instance);

    return () => {
      onReady?.(null);
      instance.destroy();
      view.current = null;
    };
    // Built once; note changes are applied by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const instance = view.current;
    if (!instance) return;
    instance.setState(buildState(initialBody, readOnly, handlers));
    handlers.current.onStats?.(measure(initialBody));
    if (!readOnly && noteId) instance.focus();
  }, [noteId, initialBody, readOnly]);

  return <div ref={host} className="h-full overflow-hidden" tabIndex={-1} data-ursa-editor="" />;
}

type Handlers = {
  current: {
    onChange: (noteId: string, body: string) => void;
    onBlur?: () => void;
    onStats?: (stats: EditorStats) => void;
    onWikiLink?: (title: string) => void;
    noteId: string | null;
  };
};

export function measure(body: string): EditorStats {
  const words = body.trim().length === 0 ? 0 : body.trim().split(/\s+/).length;
  return { words, characters: body.length };
}

function buildState(body: string, readOnly: boolean, handlers: Handlers): EditorState {
  return EditorState.create({
    doc: body,
    extensions: [
      history(),
      // markdownKeymap first: it owns Enter, so lists and quotes continue onto
      // the next line instead of dropping their marker.
      keymap.of([...ursaKeymap, ...markdownKeymap, ...historyKeymap, ...defaultKeymap]),
      markdown({
        base: markdownLanguage,
        codeLanguages: languages,
        extensions: BearMarkup,
        addKeymap: false,
      }),
      syntaxHighlighting(ursaHighlightStyle),
      tableField,
      calcField,
      markdownStyling({
        onWikiLink: (title) => handlers.current.onWikiLink?.(title),
      }),
      smartPaste,
      imagePaste,
      EditorView.lineWrapping,
      // The editable surface is a textbox to assistive tech; give it a name.
      EditorView.contentAttributes.of({ "aria-label": "Note text" }),
      placeholder(readOnly ? "" : "Start writing."),
      EditorState.readOnly.of(readOnly),
      EditorView.editable.of(!readOnly),
      EditorView.updateListener.of((update) => {
        if (!update.docChanged) {
          if (update.focusChanged && !update.view.hasFocus) handlers.current.onBlur?.();
          return;
        }
        const next = update.state.doc.toString();
        const id = handlers.current.noteId;
        if (id) handlers.current.onChange(id, next);
        handlers.current.onStats?.(measure(next));
      }),
    ],
  });
}

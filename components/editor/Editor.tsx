"use client";

import { useEffect, useRef } from "react";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownKeymap, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { foldKeymap, syntaxHighlighting } from "@codemirror/language";
import { BearMarkup } from "./bearMarkup";
import { ursaHighlightStyle } from "./highlightStyle";
import { markdownStyling } from "./decorations";
import { headingFold } from "./headingFold";
import { searchHighlight, highlightSearch } from "./searchHighlight";
import { slashMenu } from "./slashMenu";
import { currentNoteId } from "./wikiComplete";
import { tableField } from "./tableField";
import { smartPaste, ursaKeymap } from "./commands";
import { calcField } from "./calcField";
import { imagePaste } from "./imagePaste";
import { linkTitles } from "./linkTitles";

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
  onTag?: (tag: string) => void;
  /** The active search, whose hits are marked and jumped to on open (§4.43). */
  highlight?: string;
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
  onTag,
  highlight = "",
  onReady,
}: EditorProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const view = useRef<EditorView | null>(null);

  // Callbacks live in a ref so changing one never rebuilds the editor state.
  const handlers = useRef({ onChange, onBlur, onStats, onWikiLink, onTag, noteId });
  handlers.current = { onChange, onBlur, onStats, onWikiLink, onTag, noteId };

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

  const shownNote = useRef<string | null>(noteId);
  const readOnlyRef = useRef(readOnly);
  const highlightRef = useRef(highlight);
  highlightRef.current = highlight;

  useEffect(() => {
    const instance = view.current;
    if (!instance) return;
    instance.setState(buildState(initialBody, readOnlyRef.current, handlers));
    handlers.current.onStats?.(measure(initialBody));
    // A different note glides in rather than snapping (PRD §4.48).
    if (noteId && noteId !== shownNote.current) glide(instance.dom);
    shownNote.current = noteId;
    // Opened from a search: land on the first hit rather than the top.
    if (highlightRef.current.trim()) highlightSearch(instance, highlightRef.current, true);
    if (!readOnlyRef.current && noteId) instance.focus();
  }, [noteId, initialBody]);

  // Read-only switches in place (reading mode, PRD §4.58): rebuilding the
  // state from initialBody would show text older than what was just typed.
  useEffect(() => {
    readOnlyRef.current = readOnly;
    view.current?.dispatch({ effects: editability.reconfigure(editable(readOnly)) });
  }, [readOnly]);

  // The search changing while a note is open re-marks it without moving the caret.
  useEffect(() => {
    if (view.current) highlightSearch(view.current, highlight, false);
  }, [highlight]);

  return <div ref={host} className="h-full overflow-hidden" tabIndex={-1} data-ursa-editor="" />;
}

type Handlers = {
  current: {
    onChange: (noteId: string, body: string) => void;
    onBlur?: () => void;
    onStats?: (stats: EditorStats) => void;
    onWikiLink?: (title: string) => void;
    onTag?: (tag: string) => void;
    noteId: string | null;
  };
};

function glide(element: HTMLElement): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  element.animate(
    [
      { opacity: 0, transform: "translateY(8px)" },
      { opacity: 1, transform: "none" },
    ],
    { duration: 220, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
  );
}

export function measure(body: string): EditorStats {
  const words = body.trim().length === 0 ? 0 : body.trim().split(/\s+/).length;
  return { words, characters: body.length };
}

const editability = new Compartment();

function editable(readOnly: boolean): Extension {
  return [
    placeholder(readOnly ? "" : "Start writing."),
    EditorState.readOnly.of(readOnly),
    EditorView.editable.of(!readOnly),
  ];
}

function buildState(body: string, readOnly: boolean, handlers: Handlers): EditorState {
  return EditorState.create({
    doc: body,
    extensions: [
      history(),
      // markdownKeymap first: it owns Enter, so lists and quotes continue onto
      // the next line instead of dropping their marker.
      keymap.of([...ursaKeymap, ...markdownKeymap, ...historyKeymap, ...foldKeymap, ...defaultKeymap]),
      markdown({
        base: markdownLanguage,
        codeLanguages: languages,
        extensions: BearMarkup,
        addKeymap: false,
      }),
      syntaxHighlighting(ursaHighlightStyle),
      tableField,
      searchHighlight,
      headingFold,
      calcField,
      markdownStyling({
        onWikiLink: (title) => handlers.current.onWikiLink?.(title),
        onTag: (tag) => handlers.current.onTag?.(tag),
      }),
      smartPaste,
      linkTitles,
      imagePaste,
      slashMenu,
      currentNoteId.of(handlers.current.noteId),
      EditorView.lineWrapping,
      // The editable surface is a textbox to assistive tech; give it a name.
      EditorView.contentAttributes.of({ "aria-label": "Note text" }),
      editability.of(editable(readOnly)),
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

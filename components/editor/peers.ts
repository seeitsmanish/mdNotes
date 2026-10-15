import { Annotation, Transaction } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

/**
 * One note in two editor groups (PRD §4.81). Each group has its own editor,
 * with its own caret, scroll and undo; what is typed in one is applied to the
 * others at once, so they never hold different text and never save over each
 * other. Changes arriving from a peer are marked so they are not sent back,
 * and kept out of this editor's undo history, as VS Code does.
 */

const fromPeer = Annotation.define<boolean>();
const byNote = new Map<string, Set<EditorView>>();

export function joinPeers(noteId: string, view: EditorView): () => void {
  let set = byNote.get(noteId);
  if (!set) byNote.set(noteId, (set = new Set()));
  set.add(view);
  return () => {
    set.delete(view);
    if (set.size === 0) byNote.delete(noteId);
  };
}

/** Text to start a new editor with: a peer's, which may be ahead of the saved copy. */
export function peerText(noteId: string): string | undefined {
  const first = byNote.get(noteId)?.values().next().value;
  return first?.state.doc.toString();
}

export function syncPeers(noteIdOf: () => string | null) {
  return EditorView.updateListener.of((update) => {
    if (!update.docChanged) return;
    const id = noteIdOf();
    const peers = id ? byNote.get(id) : undefined;
    if (!peers || peers.size < 2) return;
    for (const tr of update.transactions) {
      if (!tr.docChanged || tr.annotation(fromPeer)) continue;
      for (const peer of peers) {
        if (peer === update.view) continue;
        // After this update finishes: a view may not be updated from inside
        // another's update cycle.
        queueMicrotask(() => {
          const annotations = [fromPeer.of(true), Transaction.addToHistory.of(false)];
          if (peer.state.doc.length === tr.startState.doc.length) {
            peer.dispatch({ changes: tr.changes, annotations });
          } else {
            // Out of step somehow: take the whole text rather than guess.
            const text = update.view.state.doc.toString();
            if (peer.state.doc.toString() !== text) {
              peer.dispatch({ changes: { from: 0, to: peer.state.doc.length, insert: text }, annotations });
            }
          }
        });
      }
    }
  });
}

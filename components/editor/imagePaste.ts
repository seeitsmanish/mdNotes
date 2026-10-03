import { EditorView } from "@codemirror/view";
import { toast } from "sonner";
import { isImageFile, uploadImage } from "@/lib/attachments/upload";

/**
 * Paste or drop images into a note (PRD §4.24).
 *
 * Each image is inserted at once as a placeholder, then swapped for ordinary
 * markdown — `![name](/api/attachments/<id>)` — when its upload lands. The
 * placeholder carries a unique token so it can be found again even after the
 * user has kept typing around it.
 */

let sequence = 0;

function altFrom(file: File): string {
  const stem = file.name.replace(/\.[a-z0-9]+$/i, "").replace(/[[\]]/g, "").trim();
  return stem && !/^image$/i.test(stem) ? stem : "image";
}

export function insertImages(view: EditorView, files: File[], at?: number): boolean {
  const images = files.filter(isImageFile);
  if (images.length === 0) return false;

  const pos = at ?? view.state.selection.main.head;
  const tokens = images.map(() => `![Uploading image ${(sequence += 1)}…]()`);
  const line = view.state.doc.lineAt(pos);
  // Images read best on a line of their own.
  const before = pos === line.from ? "" : "\n";
  const insert = `${before}${tokens.join("\n")}\n`;
  view.dispatch({
    changes: { from: pos, insert },
    selection: { anchor: pos + insert.length },
    userEvent: "input.paste",
  });

  images.forEach((file, index) => {
    const token = tokens[index] ?? "";
    const replace = (text: string) => {
      const from = view.state.doc.toString().indexOf(token);
      if (from === -1) return; // the user deleted the placeholder: respect that
      view.dispatch({ changes: { from, to: from + token.length + (text === "" ? 1 : 0), insert: text } });
    };
    uploadImage(file)
      .then(({ url }) => replace(`![${altFrom(file)}](${url})`))
      .catch((error: unknown) => {
        replace("");
        toast.error(`Could not add “${file.name || "image"}”.`, {
          description: error instanceof Error ? error.message : undefined,
        });
      });
  });
  return true;
}

export const imagePaste = EditorView.domEventHandlers({
  paste(event, view) {
    const files = [...(event.clipboardData?.files ?? [])];
    if (!files.some(isImageFile)) return false;
    event.preventDefault();
    return insertImages(view, files);
  },
  drop(event, view) {
    const files = [...(event.dataTransfer?.files ?? [])];
    if (!files.some(isImageFile)) return false;
    event.preventDefault();
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.selection.main.head;
    return insertImages(view, files, view.state.doc.lineAt(pos).to);
  },
});

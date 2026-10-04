import { EditorSelection } from "@codemirror/state";
import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { blockAt, moveBlock } from "@/lib/editor/blocks";
import { haptic } from "@/lib/gestures/haptics";

/**
 * Drag to reorder (PRD §4.70). A grip sits beside the line under the mouse —
 * or, on a touch screen, the caret's line — and dragging it carries the
 * whole block (a list item with its children, a paragraph, a heading, a code
 * block) to where a drop line shows. One transaction, so one undo puts it back.
 */

const GRIP_SIZE = 22;

class DragHandle {
  grip: HTMLButtonElement;
  marker: HTMLDivElement;
  line: number | null = null;
  drag: { block: [number, number]; target: number | null; pointer: number } | null = null;
  hovering = false;

  constructor(readonly view: EditorView) {
    this.grip = document.createElement("button");
    this.grip.type = "button";
    this.grip.className = "ursa-grip";
    this.grip.setAttribute("aria-label", "Drag to move this block");
    this.grip.tabIndex = -1;
    this.grip.textContent = "⋮⋮";
    this.marker = document.createElement("div");
    this.marker.className = "ursa-drop-line";
    this.marker.hidden = true;
    view.dom.append(this.grip, this.marker);

    this.grip.addEventListener("pointerdown", this.start);
    view.contentDOM.addEventListener("mousemove", this.hover);
    view.dom.addEventListener("mouseleave", this.leave);
    view.scrollDOM.addEventListener("scroll", this.reposition, { passive: true });
    this.place(null);
  }

  update(update: ViewUpdate) {
    if (this.drag) return;
    if (update.docChanged || update.geometryChanged) this.reposition();
    // Touch has no hover: follow the caret instead.
    if (update.selectionSet && !this.hovering) {
      const head = update.state.doc.lineAt(update.state.selection.main.head).number - 1;
      this.place(update.view.hasFocus ? head : null);
    }
    if (update.focusChanged && !update.view.hasFocus && !this.hovering) this.place(null);
  }

  destroy() {
    this.grip.remove();
    this.marker.remove();
    this.view.contentDOM.removeEventListener("mousemove", this.hover);
    this.view.dom.removeEventListener("mouseleave", this.leave);
    this.view.scrollDOM.removeEventListener("scroll", this.reposition);
  }

  lines(): string[] {
    return this.view.state.doc.toString().split("\n");
  }

  hover = (event: MouseEvent) => {
    if (this.drag) return;
    this.hovering = true;
    const pos = this.view.posAtCoords({ x: event.clientX, y: event.clientY });
    this.place(pos === null ? null : this.view.state.doc.lineAt(pos).number - 1);
  };

  leave = (event: MouseEvent) => {
    if (this.drag || this.grip.contains(event.relatedTarget as Node)) return;
    this.hovering = false;
    this.place(null);
  };

  reposition = () => this.place(this.line);

  /** Shows the grip beside the first line of the block containing line `index` (0-based). */
  place(index: number | null) {
    const { view } = this;
    const block = index === null || view.state.readOnly ? null : blockAt(this.lines(), index);
    if (!block) {
      this.line = null;
      this.grip.hidden = true;
      return;
    }
    this.line = block[0];
    const from = view.state.doc.line(block[0] + 1).from;
    const coords = view.coordsAtPos(from);
    const host = view.dom.getBoundingClientRect();
    const content = view.contentDOM.getBoundingClientRect();
    const scroller = view.scrollDOM.getBoundingClientRect();
    if (!coords || coords.bottom < scroller.top || coords.top > scroller.bottom) {
      this.grip.hidden = true;
      return;
    }
    this.grip.hidden = false;
    // A phone has no margin to the left of the text, so there the grip sits at
    // the right edge, away from where a line is tapped to edit it.
    const touch = window.matchMedia("(hover: none)").matches;
    const size = touch ? 28 : GRIP_SIZE;
    const height = coords.bottom - coords.top;
    this.grip.style.top = `${coords.top - host.top + (height - size) / 2}px`;
    const room = content.left - host.left;
    this.grip.style.left = touch || room < size ? `${host.width - size - 10}px` : `${room - size + 2}px`;
  }

  /** The line index a drop at `y` would insert before (0 … line count). */
  targetAt(y: number): number {
    const { view } = this;
    const block = view.lineBlockAtHeight(y - view.documentTop);
    const line = view.state.doc.lineAt(block.from).number - 1;
    return y > view.documentTop + block.top + block.height / 2 ? line + 1 : line;
  }

  start = (event: PointerEvent) => {
    if (this.line === null || this.view.state.readOnly) return;
    const block = blockAt(this.lines(), this.line);
    if (!block) return;
    event.preventDefault();
    this.grip.setPointerCapture(event.pointerId);
    this.drag = { block, target: null, pointer: event.pointerId };
    this.view.dom.classList.add("ursa-dragging");
    haptic();
    this.grip.addEventListener("pointermove", this.move);
    this.grip.addEventListener("pointerup", this.end);
    this.grip.addEventListener("pointercancel", this.cancel);
    window.addEventListener("keydown", this.escape, true);
  };

  move = (event: PointerEvent) => {
    const drag = this.drag;
    if (!drag) return;
    const { view } = this;
    // Near the top or bottom edge, scroll to reach the rest of the note.
    const scroller = view.scrollDOM.getBoundingClientRect();
    if (event.clientY < scroller.top + 40) view.scrollDOM.scrollTop -= 12;
    else if (event.clientY > scroller.bottom - 40) view.scrollDOM.scrollTop += 12;

    const target = this.targetAt(event.clientY);
    drag.target = target >= drag.block[0] && target <= drag.block[1] + 1 ? null : target;
    if (drag.target === null) {
      this.marker.hidden = true;
      return;
    }
    const doc = view.state.doc;
    const host = view.dom.getBoundingClientRect();
    const content = view.contentDOM.getBoundingClientRect();
    const y =
      drag.target >= doc.lines
        ? (view.coordsAtPos(doc.length)?.bottom ?? event.clientY)
        : (view.coordsAtPos(doc.line(drag.target + 1).from)?.top ?? event.clientY);
    this.marker.hidden = false;
    this.marker.style.top = `${y - host.top - 1}px`;
    this.marker.style.left = `${content.left - host.left}px`;
    this.marker.style.width = `${content.width}px`;
  };

  end = () => {
    const drag = this.drag;
    this.finish();
    if (!drag || drag.target === null) return;
    const lines = this.lines();
    const moved = moveBlock(lines, drag.block, drag.target);
    if (!moved) return;
    // Replace only the span that changed: from the first to the last line touched.
    const lo = Math.min(drag.block[0], drag.target);
    const hi = Math.max(drag.block[1], drag.target - 1);
    const doc = this.view.state.doc;
    const from = doc.line(lo + 1).from;
    const to = doc.line(hi + 1).to;
    const insert = moved.lines.slice(lo, hi + 1).join("\n");
    const caret = from + moved.lines.slice(lo, moved.start).reduce((sum, line) => sum + line.length + 1, 0);
    this.view.dispatch({
      changes: { from, to, insert },
      selection: EditorSelection.cursor(caret),
      userEvent: "move.drop",
      scrollIntoView: true,
    });
    haptic();
  };

  cancel = () => this.finish();

  escape = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !this.drag) return;
    event.preventDefault();
    event.stopPropagation();
    this.drag.target = null;
    this.finish();
  };

  finish() {
    if (this.drag) {
      try {
        this.grip.releasePointerCapture(this.drag.pointer);
      } catch {
        // Already released.
      }
    }
    this.drag = null;
    this.marker.hidden = true;
    this.view.dom.classList.remove("ursa-dragging");
    this.grip.removeEventListener("pointermove", this.move);
    this.grip.removeEventListener("pointerup", this.end);
    this.grip.removeEventListener("pointercancel", this.cancel);
    window.removeEventListener("keydown", this.escape, true);
  }
}

export const dragHandle = ViewPlugin.fromClass(DragHandle);

import { safeExternalUrl } from "@/lib/security/urls";

/**
 * Full-screen image viewer (PRD §4.50). Tapping an image in a note opens it
 * large; tapping the image toggles a zoomed, scrollable view; ✕, Esc or a tap
 * outside closes it. "Edit" closes it and puts the caret on the image's line,
 * which reveals the markdown as before.
 *
 * Plain DOM, not React: it is opened from inside a CodeMirror widget.
 */
export function openLightbox(options: { src: string; alt: string; onEdit?: () => void }): () => void {
  const previous = document.activeElement as HTMLElement | null;

  const overlay = document.createElement("div");
  overlay.className = "ursa-lightbox";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", options.alt ? `Image: ${options.alt}` : "Image");

  const stage = document.createElement("div");
  stage.className = "ursa-lightbox-stage";
  const img = document.createElement("img");
  img.src = options.src;
  img.alt = options.alt;
  img.draggable = false;
  stage.append(img);

  const bar = document.createElement("div");
  bar.className = "ursa-lightbox-bar";
  const caption = document.createElement("span");
  caption.className = "ursa-lightbox-caption";
  caption.textContent = options.alt;
  bar.append(caption);

  const button = (label: string, text: string, onClick: () => void) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    b.setAttribute("aria-label", label);
    b.title = label;
    b.addEventListener("click", (event) => {
      event.stopPropagation();
      onClick();
    });
    bar.append(b);
    return b;
  };

  const close = () => {
    document.removeEventListener("keydown", onKey, true);
    overlay.classList.add("ursa-lightbox-closing");
    const done = () => overlay.remove();
    overlay.addEventListener("animationend", done, { once: true });
    // Reduced motion (or no animation support): remove at once.
    setTimeout(done, 250);
    previous?.focus?.({ preventScroll: true });
  };

  if (options.onEdit) {
    const edit = options.onEdit;
    button("Edit the image's markdown", "Edit", () => {
      close();
      edit();
    });
  }
  const original = safeExternalUrl(new URL(options.src, window.location.href).href);
  if (original) {
    const link = document.createElement("a");
    link.href = original;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Open";
    link.title = "Open the original in a new tab";
    link.addEventListener("click", (event) => event.stopPropagation());
    bar.append(link);
  }
  const closeButton = button("Close", "✕", close);

  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      // Ours alone: Esc must not also reach the editor or the app.
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  };
  document.addEventListener("keydown", onKey, true);

  img.addEventListener("click", (event) => {
    event.stopPropagation();
    overlay.classList.toggle("ursa-lightbox-zoomed");
  });
  overlay.addEventListener("click", close);

  overlay.append(stage, bar);
  document.body.append(overlay);
  closeButton.focus({ preventScroll: true });
  return close;
}

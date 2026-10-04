/**
 * Export as PDF (PRD §4.64) through the browser's own print dialog, which
 * every platform can save as PDF — no PDF library, and text stays selectable.
 *
 * The note is rendered by the same markdown-to-HTML as Copy as HTML into a
 * container that the print stylesheet shows on its own; everything else on
 * the page is hidden for print. The document title becomes the note's, which
 * is what browsers name the saved file.
 */
export function printHtml(title: string, html: string): void {
  document.getElementById("ursa-print")?.remove();
  const host = document.createElement("article");
  host.id = "ursa-print";
  // markdownToHtml escapes all note text and keeps only safe links and images.
  host.innerHTML = html;
  document.body.append(host);

  const previousTitle = document.title;
  document.title = title || "Note";
  const root = document.documentElement;
  root.classList.add("ursa-printing");

  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    root.classList.remove("ursa-printing");
    document.title = previousTitle;
    host.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);

  // Images must have loaded or they print blank.
  const images = [...host.querySelectorAll("img")];
  void Promise.all(
    images.map((img) =>
      img.complete
        ? null
        : new Promise((resolve) => {
            img.addEventListener("load", resolve, { once: true });
            img.addEventListener("error", resolve, { once: true });
          }),
    ),
  ).then(() => {
    window.print();
    // Desktop browsers block in print() and fire afterprint; some mobile ones
    // do neither, so the next interaction tidies up.
    window.addEventListener("pointerdown", cleanup, { once: true });
  });
}

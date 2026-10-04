/**
 * The app's mark — the page of notes from app/icon.svg — drawn in theme
 * colours, so it sits on any theme rather than as a fixed-colour picture.
 */
export function NotesMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="10 4 44 56"
      width={size * (44 / 56)}
      height={size}
      aria-hidden
      className={className}
    >
      <path
        d="M19 9H39L49 19V51a4 4 0 0 1-4 4H19a4 4 0 0 1-4-4V13a4 4 0 0 1 4-4Z"
        fill="var(--brand)"
      />
      <path d="M39 9V16a3 3 0 0 0 3 3H49Z" fill="var(--canvas)" opacity="0.35" />
      <rect x="21" y="27" width="22" height="3.6" rx="1.8" fill="var(--canvas)" />
      <rect x="21" y="35" width="22" height="3.6" rx="1.8" fill="var(--canvas)" />
      <rect x="21" y="43" width="14" height="3.6" rx="1.8" fill="var(--canvas)" />
    </svg>
  );
}

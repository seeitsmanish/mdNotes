/**
 * Small spot illustrations for empty states (PRD §4.48), drawn in theme
 * colours so they belong to every theme rather than sitting on it like
 * clip-art. They float gently; reduced-motion users see them still.
 */

type Kind = "notes" | "search" | "trash" | "write";

export function Illustration({ kind, size = 120 }: { kind: Kind; size?: number }) {
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      aria-hidden
      className="ursa-illustration"
      style={{ overflow: "visible" }}
    >
      {/* soft halo */}
      <circle cx="60" cy="62" r="46" fill="var(--brand-soft)" />
      {kind === "notes" && <Stack />}
      {kind === "write" && <Write />}
      {kind === "search" && <Search />}
      {kind === "trash" && <Trash />}
      <Sparkles />
    </svg>
  );
}

function Card({ x, y, r = 0, lines = 3 }: { x: number; y: number; r?: number; lines?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`}>
      <rect width="44" height="54" rx="7" fill="var(--raised)" stroke="var(--border-strong)" strokeWidth="1.5" />
      <rect x="8" y="10" width="22" height="4" rx="2" fill="var(--brand)" />
      {Array.from({ length: lines }, (_, i) => (
        <rect key={i} x="8" y={21 + i * 8} width={i === lines - 1 ? 18 : 28} height="3" rx="1.5" fill="var(--ink-faint)" opacity="0.55" />
      ))}
    </g>
  );
}

function Stack() {
  return (
    <g className="ursa-float">
      <Card x={30} y={36} r={-10} lines={2} />
      <Card x={46} y={30} r={8} lines={2} />
      <Card x={38} y={34} lines={3} />
    </g>
  );
}

function Write() {
  return (
    <g className="ursa-float">
      <Card x={34} y={30} lines={3} />
      {/* pencil */}
      <g transform="translate(70 70) rotate(-40)">
        <rect x="-4" y="-26" width="8" height="30" rx="2" fill="var(--brand)" />
        <rect x="-4" y="-30" width="8" height="5" rx="1.5" fill="var(--ink-faint)" />
        <path d="M-4 4 L0 12 L4 4 Z" fill="var(--ink-soft)" />
      </g>
    </g>
  );
}

function Search() {
  return (
    <g className="ursa-float">
      <Card x={30} y={32} lines={3} />
      <g transform="translate(72 70)">
        <circle r="13" fill="var(--canvas)" fillOpacity="0.6" stroke="var(--brand)" strokeWidth="4" />
        <rect x="9" y="9" width="6" height="16" rx="3" transform="rotate(-45 12 12)" fill="var(--brand)" />
      </g>
    </g>
  );
}

function Trash() {
  return (
    <g className="ursa-float">
      <rect x="40" y="44" width="40" height="46" rx="6" fill="var(--raised)" stroke="var(--border-strong)" strokeWidth="1.5" />
      <rect x="34" y="36" width="52" height="8" rx="4" fill="var(--brand)" />
      <rect x="53" y="30" width="14" height="6" rx="3" fill="var(--brand)" />
      {[50, 60, 70].map((x) => (
        <rect key={x} x={x - 1.5} y="52" width="3" height="30" rx="1.5" fill="var(--ink-faint)" opacity="0.5" />
      ))}
    </g>
  );
}

function Sparkles() {
  const star = "M0 -5 L1.3 -1.3 L5 0 L1.3 1.3 L0 5 L-1.3 1.3 L-5 0 L-1.3 -1.3 Z";
  return (
    <g fill="var(--brand)">
      <path d={star} transform="translate(22 30)" className="ursa-twinkle" />
      <path d={star} transform="translate(98 40) scale(0.7)" className="ursa-twinkle" style={{ animationDelay: "0.8s" }} />
      <path d={star} transform="translate(94 96) scale(0.55)" className="ursa-twinkle" style={{ animationDelay: "1.6s" }} />
    </g>
  );
}

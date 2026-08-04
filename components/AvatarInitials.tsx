const PALETTE = [
  "#C9A227",
  "#8B6CE7",
  "#2FA8A0",
  "#E2725B",
  "#4A7FD4",
  "#B75CA8",
  "#5CA85C",
];

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function initialsOf(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last).toUpperCase();
}

export function colorFor(seed: string | null | undefined, deptColor?: string | null): string {
  if (deptColor) return deptColor;
  if (!seed) return PALETTE[0];
  return PALETTE[hashString(seed) % PALETTE.length];
}

export default function AvatarInitials({
  name,
  deptColor,
  size = 36,
  className = "",
}: {
  name: string | null | undefined;
  deptColor?: string | null;
  size?: number;
  className?: string;
}) {
  const bg = colorFor(name, deptColor);
  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center rounded-full font-semibold text-white ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        fontSize: size * 0.38,
      }}
    >
      {initialsOf(name)}
    </div>
  );
}

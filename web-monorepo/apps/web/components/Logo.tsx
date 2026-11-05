export default function Logo({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={["block", className].filter(Boolean).join(" ")} aria-hidden fill="currentColor">
      {/* nudged up: hull mass sits optically low if drawn on the geometric midline */}
      <g transform="translate(0.2 -1.2)">
        <path d="M4 16.4C5.4 19.2 8.2 20.6 12 20.6s6.6-1.4 8-4.2H4Z" />
        <rect x="11.15" y="3.6" width="1.7" height="12.4" rx="0.4" />
        <path d="M13.2 4.2 19.4 14.2H13.2V4.2Z" />
        <path d="M10.8 7.4 6.2 14.2h4.6V7.4Z" />
      </g>
    </svg>
  );
}

export function BeerMugIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M10 14h20v24a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4V14Z"
        fill="#e8a93c"
        stroke="#3a2404"
        strokeWidth="2"
      />
      <path
        d="M10 20h20"
        stroke="#c98a1f"
        strokeWidth="2"
      />
      <path
        d="M30 18h4a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4h-4"
        fill="none"
        stroke="#1c6b3a"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M12 14c-1-3 1-4 0-6"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M17 14c-1-4 1.5-5 0.5-8"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <ellipse cx="20" cy="14" rx="10" ry="4" fill="white" stroke="#3a2404" strokeWidth="2" />
    </svg>
  );
}

export function BeerMugIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M6.5 6.8C6.5 5.8 7.3 5 8.3 5h5.4c1 0 1.8.8 1.8 1.8V18a3 3 0 0 1-3 3h-3.2a3 3 0 0 1-3-3V6.8Z"
        fill="#e8a93c"
      />
      <path
        d="M15.5 9h1.3A2.7 2.7 0 0 1 19.5 11.7v1.6A2.7 2.7 0 0 1 16.8 16H15.5"
        stroke="#e8a93c"
        strokeWidth="1.7"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M6.8 9.5h8.4"
        stroke="#c98a1f"
        strokeWidth="1.1"
        opacity="0.55"
      />
      <path
        d="M7 6.3c0-1.8 1.6-2.8 4-2.8s4 1 4 2.8-1.6 2.3-4 2.3-4-.5-4-2.3Z"
        fill="white"
      />
    </svg>
  );
}

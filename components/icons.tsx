// Inline SVG icons — vector only, consistent 1.75 stroke (no emoji as structural icons)

type P = { className?: string; size?: number };

const base = (size = 18) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const ArrowUp = ({ className, size }: P) => (
  <svg {...base(size ?? 14)} className={className} aria-hidden="true">
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
);

export const ArrowDown = ({ className, size }: P) => (
  <svg {...base(size ?? 14)} className={className} aria-hidden="true">
    <path d="M12 5v14M19 12l-7 7-7-7" />
  </svg>
);

export const Search = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

export const Bell = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
  </svg>
);

export const Grid = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

export const Candles = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M7 4v3M7 17v3M7 7h0M7 7a0 0 0 0 0 0 0" />
    <rect x="5" y="7" width="4" height="10" rx="1" />
    <path d="M7 4v3M7 17v3" />
    <rect x="15" y="9" width="4" height="7" rx="1" />
    <path d="M17 5v4M17 16v3" />
  </svg>
);

export const Wallet = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2" />
    <path d="M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-3" />
    <path d="M21 11h-5a2 2 0 0 0 0 4h5a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1Z" />
  </svg>
);

export const Layers = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="m12 2 9 5-9 5-9-5 9-5Z" />
    <path d="m3 12 9 5 9-5M3 17l9 5 9-5" />
  </svg>
);

export const Sort = ({ className, size }: P) => (
  <svg {...base(size ?? 12)} className={className} aria-hidden="true">
    <path d="m8 9 4-5 4 5M16 15l-4 5-4-5" />
  </svg>
);

export const Radar = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M19.07 4.93A10 10 0 1 0 22 12" />
    <path d="M16.24 7.76A6 6 0 1 0 18 12" />
    <path d="M12 12 22 2" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);

export const Zap = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />
  </svg>
);

export const Newspaper = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M4 22h16a2 2 0 0 0 2-2V4a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v16a2 2 0 0 1-2 2 2 2 0 0 1-2-2V9a1 1 0 0 1 1-1h1" />
    <path d="M8 7h8M8 11h8M8 15h5" />
  </svg>
);

export const External = ({ className, size }: P) => (
  <svg {...base(size ?? 13)} className={className} aria-hidden="true">
    <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </svg>
);

export const Refresh = ({ className, size }: P) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" />
  </svg>
);

import type { CSSProperties } from "react";

const CYCLE_MS = 3000;
const LAST_BOOK_SETTLE_PERCENT = 0.46;

export const LOADING_ANIMATION_MS = Math.round(
  CYCLE_MS * LAST_BOOK_SETTLE_PERCENT,
);

const bookStyle = (animationName: string): CSSProperties => ({
  transformBox: "fill-box",
  transformOrigin: "bottom left",
  animation: `${animationName} ${CYCLE_MS}ms ease-in infinite`,
  willChange: "transform",
});

interface LoadingScreenProps {
  label?: string;
}

export function LoadingScreen({ label = "Loading..." }: LoadingScreenProps) {
  return (
    <div
      role="status"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-navy"
    >
      <svg
        viewBox="-30 0 250 120"
        className="h-auto w-[min(440px,60vw)] overflow-visible text-white"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <line x1="-30" y1="98" x2="10" y2="98" stroke="currentColor" strokeWidth="2" />
        <line x1="10" y1="98" x2="210" y2="98" stroke="currentColor" strokeWidth="2" />

        <g style={bookStyle("book1Fall")}>
          <rect x="26" y="52" width="20" height="46" rx="1" stroke="currentColor" strokeWidth="2" />
          <line x1="26" y1="63" x2="46" y2="63" stroke="currentColor" strokeWidth="2" />
        </g>

        <g style={bookStyle("book2Fall")}>
          <rect x="50" y="46" width="18" height="52" rx="1" stroke="currentColor" strokeWidth="2" />
          <line x1="50" y1="58" x2="68" y2="58" stroke="currentColor" strokeWidth="2" />
        </g>

        <g style={bookStyle("book3Fall")}>
          <rect x="72" y="40" width="18" height="58" rx="1" stroke="currentColor" strokeWidth="2" />
          <circle cx="81" cy="60" r="2" fill="currentColor" />
        </g>

        <g style={bookStyle("book4Fall")}>
          <rect x="94" y="34" width="20" height="64" rx="1" stroke="currentColor" strokeWidth="2" />
          <line x1="94" y1="58" x2="114" y2="58" stroke="currentColor" strokeWidth="2" />
          <circle cx="104" cy="46" r="2" fill="currentColor" />
        </g>

        <g style={bookStyle("book5Fall")}>
          <rect x="118" y="30" width="16" height="68" rx="1" stroke="currentColor" strokeWidth="2" />
          <line x1="118" y1="42" x2="134" y2="42" stroke="currentColor" strokeWidth="2" />
          <line x1="118" y1="48" x2="134" y2="48" stroke="currentColor" strokeWidth="2" />
        </g>

        <g style={bookStyle("book6Fall")}>
          <rect x="140" y="34" width="14" height="64" rx="1" stroke="currentColor" strokeWidth="2" />
          <line x1="140" y1="44" x2="154" y2="44" stroke="currentColor" strokeWidth="2" />
        </g>

        <g>
          {Array.from({ length: 24 }).map((_, i) => (
            <circle key={i} cx={12 + i * 8.5} cy="108" r="1.4" fill="currentColor" />
          ))}
        </g>
      </svg>

      <p className="mt-6 text-sm font-medium tracking-[0.35em] text-white">
        {label}
      </p>
    </div>
  );
}

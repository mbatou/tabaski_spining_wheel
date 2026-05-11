import type { PrizeKey } from "@/lib/prizes";

export function PrizeArt({ pkey }: { pkey: PrizeKey }) {
  switch (pkey) {
    case "sac":
      return (
        <svg viewBox="0 0 130 130">
          <circle cx={65} cy={65} r={58} fill="#F0FBFF" />
          <g transform="translate(65 70)">
            <path d="M-26 -16 h52 l-5 38 a8 8 0 0 1 -8 7 h-26 a8 8 0 0 1 -8 -7z" fill="#1DC8FF" stroke="#0A0A0A" strokeWidth={2} />
            <path d="M-12 -16 v-6 a12 12 0 0 1 24 0 v6" fill="none" stroke="#0A0A0A" strokeWidth={3} strokeLinecap="round" />
            <path d="M-8 6 c4 -4 6 -4 8 0 s4 4 8 0" stroke="#fff" strokeWidth={2.5} fill="none" strokeLinecap="round" />
          </g>
        </svg>
      );
    case "tablier":
      return (
        <svg viewBox="0 0 130 130">
          <circle cx={65} cy={65} r={58} fill="#F0FBFF" />
          <g transform="translate(65 65)">
            <path d="M-18 -28 c-3 6 -8 8 -14 8 v8 c5 0 7 3 7 8 v18 a4 4 0 0 0 4 4 h42 a4 4 0 0 0 4 -4 v-18 c0 -5 2 -8 7 -8 v-8 c-6 0 -11 -2 -14 -8" fill="#4749D5" stroke="#0A0A0A" strokeWidth={2} />
            <path d="M-18 -28 c3 6 8 8 18 8 s15 -2 18 -8" fill="none" stroke="#FFE89A" strokeWidth={2.5} />
            <circle cx={0} cy={0} r={5} fill="#FFE89A" />
          </g>
        </svg>
      );
    case "eventail":
      return (
        <svg viewBox="0 0 130 130">
          <circle cx={65} cy={65} r={58} fill="#F0FBFF" />
          <g transform="translate(65 80)">
            <path d="M0 0 c-30 -6 -42 -34 -42 -54 l84 0 c0 20 -12 48 -42 54z" fill="#1DC8FF" stroke="#0A0A0A" strokeWidth={2} />
            <g stroke="#0A0A0A" strokeWidth={1.5} fill="none">
              <line x1={-30} y1={-44} x2={-12} y2={-2} />
              <line x1={-12} y1={-50} x2={-4} y2={-2} />
              <line x1={12} y1={-50} x2={4} y2={-2} />
              <line x1={30} y1={-44} x2={12} y2={-2} />
            </g>
            <circle r={4} fill="#0A0A0A" />
          </g>
        </svg>
      );
    case "gourde":
      return (
        <svg viewBox="0 0 130 130">
          <circle cx={65} cy={65} r={58} fill="#F0FBFF" />
          <g transform="translate(65 65)">
            <rect x={-10} y={-38} width={20} height={10} rx={2} fill="#0A0A0A" />
            <path d="M-14 -28 h28 l-3 50 a6 6 0 0 1 -6 5 h-10 a6 6 0 0 1 -6 -5z" fill="#1DC8FF" stroke="#0A0A0A" strokeWidth={2} />
            <path d="M-12 -8 h24" stroke="#0A0A0A" strokeWidth={2} />
            <path d="M-6 6 c2 -3 4 -3 6 0 s4 3 6 0" stroke="#fff" strokeWidth={2} fill="none" strokeLinecap="round" />
          </g>
        </svg>
      );
    case "lose":
      return null;
  }
}

export function LoseArt() {
  return (
    <svg viewBox="0 0 130 130">
      <circle cx={65} cy={65} r={58} fill="#F0FBFF" />
      <circle cx={65} cy={78} r={20} fill="#FFE89A" />
      <g stroke="#1DC8FF" strokeWidth={2} strokeLinecap="round" opacity={0.7}>
        <line x1={65} y1={46} x2={65} y2={38} />
        <line x1={42} y1={66} x2={34} y2={66} />
        <line x1={88} y1={66} x2={96} y2={66} />
        <line x1={48} y1={50} x2={42} y2={44} />
        <line x1={82} y1={50} x2={88} y2={44} />
      </g>
      <path d="M14 94 q51 -10 102 0" stroke="#4749D5" strokeWidth={1.6} fill="none" opacity={0.5} />
    </svg>
  );
}

export function CapArt() {
  return (
    <svg viewBox="0 0 130 130">
      <circle cx={65} cy={65} r={58} fill="#F0FBFF" />
      <path d="M82 32 a34 34 0 1 0 0 66 a26 26 0 1 1 0 -66z" fill="#1DC8FF" />
      <g fill="#4749D5" opacity={0.7}>
        <circle cx={36} cy={46} r={1.5} />
        <circle cx={46} cy={34} r={1} />
        <circle cx={30} cy={76} r={1} />
        <circle cx={98} cy={76} r={1.5} />
      </g>
    </svg>
  );
}

export function Sparkles() {
  return (
    <div className="sparkles">
      <svg viewBox="0 0 200 200">
        <g fill="#1DC8FF">
          <path d="M20 40 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 l8 -3z" />
          <path d="M180 60 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 l6 -2z" />
          <path d="M170 150 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 l8 -3z" />
          <path d="M30 160 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 l6 -2z" />
          <path d="M100 14 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 l6 -2z" />
        </g>
      </svg>
    </div>
  );
}

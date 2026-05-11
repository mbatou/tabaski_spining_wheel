"use client";

import { motion, useReducedMotion } from "framer-motion";
import { SEGMENTS, type Segment, type PrizeKey } from "@/lib/prizes";

const SIZE = 400;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = SIZE / 2 - 6;
const PEG_COUNT = 24;

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const [sx, sy] = polar(cx, cy, r, endDeg);
  const [ex, ey] = polar(cx, cy, r, startDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${sx} ${sy} A ${r} ${r} 0 ${large} 0 ${ex} ${ey} Z`;
}

function PrizeIcon({ pkey, color }: { pkey: PrizeKey; color: string }) {
  const stroke = { stroke: color, strokeWidth: 1.8, fill: "none" as const, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (pkey) {
    case "sac":
      return (
        <g transform="translate(-12 -12)">
          <path d="M5 8h14l-1.5 11a2 2 0 0 1-2 1.7H8.5a2 2 0 0 1-2-1.7L5 8z" {...stroke} />
          <path d="M9 8V6a3 3 0 0 1 6 0v2" {...stroke} />
        </g>
      );
    case "tablier":
      return (
        <g transform="translate(-12 -12)">
          <path d="M9 4 c-1 2 -3 3 -5 3 v3 c2 0 3 1 3 3 v6 a2 2 0 0 0 2 2 h6 a2 2 0 0 0 2 -2 v-6 c0 -2 1 -3 3 -3 V7 c-2 0 -4 -1 -5 -3" {...stroke} />
          <path d="M9 4 c1 2 2 3 3 3 s2 -1 3 -3" {...stroke} />
        </g>
      );
    case "eventail":
      return (
        <g transform="translate(-12 -12)">
          <path d="M12 21 c-5 -2 -8 -7 -8 -13 l16 0 c0 6 -3 11 -8 13z" {...stroke} />
          <path d="M8 8 v9 M12 8 v12 M16 8 v9" {...stroke} />
        </g>
      );
    case "gourde":
      return (
        <g transform="translate(-12 -12)">
          <path d="M9 4 h6 v3 h-6z" {...stroke} />
          <path d="M8 7 h8 l-1 14 a2 2 0 0 1 -2 2 h-2 a2 2 0 0 1 -2 -2 L8 7z" {...stroke} />
          <path d="M9 13 h6" {...stroke} />
        </g>
      );
    case "lose":
      return (
        <g transform="translate(-10 -10)">
          <path d="M16 4 a8 8 0 1 1 -7.5 11" {...stroke} />
          <path d="M16 0 v6 h-6" {...stroke} />
        </g>
      );
  }
}

function Segments() {
  return (
    <>
      <defs>
        <pattern id="dots" width="10" height="10" patternUnits="userSpaceOnUse">
          <circle cx="5" cy="5" r="1.2" fill="rgba(255,255,255,0.22)" />
        </pattern>
      </defs>
      <g>
        {SEGMENTS.map((s) => (
          <path key={`seg-${s.index}`} d={arcPath(CX, CY, R, s.start, s.end)} fill={s.color} stroke="#fff" strokeWidth={2} strokeLinejoin="round" />
        ))}
        {SEGMENTS.filter((s) => s.color === "#4749D5").map((s) => (
          <path key={`dots-${s.index}`} d={arcPath(CX, CY, R, s.start, s.end)} fill="url(#dots)" opacity={0.6} />
        ))}
      </g>
      <g>
        {SEGMENTS.map((s: Segment) => {
          const labelR = R * 0.62;
          const [lx, ly] = polar(CX, CY, labelR, s.mid);
          const upright = s.mid > 90 && s.mid < 270 ? s.mid + 180 : s.mid;
          const isLose = s.key === "lose";
          const fontSize = isLose ? 18 : 16;
          const iconR = R * 0.86;
          const [ix, iy] = polar(CX, CY, iconR, s.mid);
          return (
            <g key={`label-${s.index}`}>
              <g transform={`translate(${lx} ${ly}) rotate(${upright})`}>
                <text textAnchor="middle" dominantBaseline="middle" fontFamily="Urbanist, sans-serif" fontWeight={700} fontSize={fontSize} fill={s.textColor} letterSpacing="-0.01em">
                  {s.short}
                </text>
                {isLose ? (
                  <text y={20} textAnchor="middle" fontFamily="Urbanist, sans-serif" fontWeight={500} fontSize={11} fill={s.textColor} opacity={0.9}>
                    demain
                  </text>
                ) : null}
              </g>
              <g transform={`translate(${ix} ${iy}) rotate(${upright})`}>
                <PrizeIcon pkey={s.key} color={s.textColor} />
              </g>
            </g>
          );
        })}
      </g>
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="#fff" strokeWidth={4} />
      <g>
        {Array.from({ length: PEG_COUNT }).map((_, i) => {
          const ang = i * (360 / PEG_COUNT);
          const [px, py] = polar(CX, CY, R - 2, ang);
          return <circle key={`peg-${i}`} cx={px} cy={py} r={2} fill="#FFE89A" />;
        })}
      </g>
    </>
  );
}

export type WheelProps = {
  rotation: number;
  spinning: boolean;
  durationSec?: number;
};

export function Wheel({ rotation, spinning, durationSec = 4.2 }: WheelProps) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="wheel-wrap">
      <motion.div
        className="wheel"
        animate={{ rotate: reduceMotion ? rotation % 360 : rotation }}
        transition={{
          duration: reduceMotion ? 0 : durationSec,
          ease: [0.16, 1, 0.3, 1],
        }}
        aria-busy={spinning}
        role="img"
        aria-label="Roue de la chance Wave Tabaski"
      >
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <Segments />
        </svg>
      </motion.div>

      <div className="hub" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/penguin.png" alt="" />
      </div>

      <div className="pointer" aria-hidden="true">
        <svg viewBox="0 0 42 54">
          <path d="M21 50 L4 8 a18 18 0 0 1 34 0 Z" fill="#FFE89A" stroke="#0A0A0A" strokeWidth={2} strokeLinejoin="round" />
          <circle cx={21} cy={14} r={5} fill="#0A0A0A" />
        </svg>
      </div>
    </div>
  );
}

export function computeTargetRotation(currentRotation: number, segmentIndex: number, fullTurns?: number): number {
  const segment = SEGMENTS[segmentIndex];
  const turns = fullTurns ?? 5 + Math.floor(Math.random() * 2);
  const sweep = segment.end - segment.start;
  const offset = (Math.random() - 0.5) * sweep * 0.6;
  const target = segment.mid + offset;
  const cur = ((currentRotation % 360) + 360) % 360;
  const delta = (360 - target - cur + 360) % 360;
  return currentRotation + turns * 360 + delta;
}

export type PrizeKey = "sac" | "tablier" | "eventail" | "gourde" | "lose";

export type Prize = {
  key: PrizeKey;
  label: string;
  short: string;
  color: string;
  textColor: string;
  alt?: boolean;
};

export const PRIZES: readonly Prize[] = [
  { key: "sac",      label: "Sac shopping",     short: "Sac",      color: "#1DC8FF", textColor: "#fff" },
  { key: "tablier",  label: "Tablier",          short: "Tablier",  color: "#4749D5", textColor: "#fff" },
  { key: "eventail", label: "Éventail",         short: "Éventail", color: "#FFFFFF", textColor: "#4749D5" },
  { key: "gourde",   label: "Gourde",           short: "Gourde",   color: "#FFE89A", textColor: "#0A0A0A" },
  { key: "lose",     label: "Réessaie demain",  short: "Réessaie", color: "#1DC8FF", textColor: "#fff", alt: true },
] as const;

export const SEGMENT_COUNT = PRIZES.length;
export const SEGMENT_SWEEP = 360 / SEGMENT_COUNT;

export type Segment = Prize & { index: number; start: number; end: number; mid: number };

export const SEGMENTS: readonly Segment[] = PRIZES.map((p, i) => ({
  ...p,
  index: i,
  start: i * SEGMENT_SWEEP,
  end: (i + 1) * SEGMENT_SWEEP,
  mid: i * SEGMENT_SWEEP + SEGMENT_SWEEP / 2,
}));

export const PRIZE_LONG_LABEL: Record<PrizeKey, string> = {
  sac: "un Sac shopping Wave",
  tablier: "un Tablier Wave",
  eventail: "un Éventail Tabaski",
  gourde: "une Gourde Wave",
  lose: "Réessaie demain",
};

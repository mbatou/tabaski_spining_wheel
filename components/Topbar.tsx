"use client";

import { useEffect, useState } from "react";

const DAKAR_TZ = "Africa/Dakar";

function formatDakar(now: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: DAKAR_TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(now)
    .replace(",", " ·");
}

export type TopbarProps = {
  spinsLeftToday: number;
  maxSpinsPerDay: number;
};

export function Topbar({ spinsLeftToday, maxSpinsPerDay }: TopbarProps) {
  const [stamp, setStamp] = useState<string>("");

  useEffect(() => {
    const tick = () => setStamp(formatDakar(new Date()));
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const dots = Array.from({ length: maxSpinsPerDay }, (_, i) => i < spinsLeftToday);

  return (
    <header className="topbar">
      <span aria-label="Payez avec Wave" style={{ display: "inline-flex", alignItems: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/payez-avec-wave.png" alt="Payez avec Wave" width={110} height={36} />
      </span>
      <span className="chip" aria-live="polite" suppressHydrationWarning>
        <span suppressHydrationWarning>{stamp || "Aujourd’hui"}</span>
        <span className="dots" aria-label={`${spinsLeftToday} chance${spinsLeftToday > 1 ? "s" : ""} restante${spinsLeftToday > 1 ? "s" : ""}`}>
          {dots.map((on, i) => (
            <i key={i} className={on ? "" : "spent"} />
          ))}
        </span>
      </span>
    </header>
  );
}

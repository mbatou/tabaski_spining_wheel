"use client";

import { useCallback, useEffect, useState } from "react";
import { Topbar } from "@/components/Topbar";
import { Footer } from "@/components/Footer";
import { Wheel, computeTargetRotation } from "@/components/Wheel";
import { Modal } from "@/components/Modal";
import { CapArt, LoseArt, PrizeArt, Sparkles } from "@/components/PrizeArt";
import {
  ActivateLocationScreen,
  LocationDeniedScreen,
  OutOfRangeScreen,
  SiteDisabledScreen,
} from "@/components/LocationScreens";
import { PRIZE_LONG_LABEL, type PrizeKey } from "@/lib/prizes";
import type { NearestSiteSuggestion, SpinResponse } from "@/lib/spin";
import type { LocationCheck } from "@/app/api/check-location/route";

const MAX_PER_DAY = 2;
const MAX_TOTAL = 8;

type ModalKind = "win" | "lose" | "cap" | null;

type Position = { lat: number; lng: number; accuracy: number };

type GateState =
  | { kind: "idle"; rejected: boolean; loading: boolean }
  | { kind: "denied" }
  | { kind: "ready"; coords: Position; site: { slug: string; label: string } | null }
  | { kind: "out-of-range"; coords: Position; nearestSites: NearestSiteSuggestion[] }
  | { kind: "site-disabled"; coords: Position; siteLabel: string };

function chanceWord(left: number): string {
  if (left === 0) return "Tu as utilisé toutes tes chances aujourd’hui";
  if (left === 1) return "Il te reste 1 chance aujourd’hui";
  return `Il te reste ${left} chances aujourd’hui`;
}

function helperWord(left: number): string {
  if (left === 0) return "Reviens demain pour 2 nouvelles chances.";
  return left === 1 ? "Il te reste 1 chance aujourd’hui" : `Il te reste ${left} chances aujourd’hui`;
}

function ChanceDots({ left, max }: { left: number; max: number }) {
  return (
    <span className="dots">
      {Array.from({ length: max }, (_, i) => (
        <i key={i} className={i < left ? "" : "spent"} />
      ))}
    </span>
  );
}

function Countdown() {
  const [parts, setParts] = useState({ h: "00", m: "00", s: "00" });
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      let d = Math.floor((tomorrow.getTime() - now.getTime()) / 1000);
      const h = Math.floor(d / 3600); d %= 3600;
      const m = Math.floor(d / 60);
      const s = d % 60;
      const pad = (n: number) => String(n).padStart(2, "0");
      setParts({ h: pad(h), m: pad(m), s: pad(s) });
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="countdown" aria-label="Temps avant la prochaine chance">
      <div className="unit"><span className="num">{parts.h}</span><span className="lbl">heures</span></div>
      <div className="unit"><span className="num">{parts.m}</span><span className="lbl">min</span></div>
      <div className="unit"><span className="num">{parts.s}</span><span className="lbl">sec</span></div>
    </div>
  );
}

function requestPosition(): Promise<Position> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("geolocation-unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  });
}

export default function WheelPage() {
  const [spinsToday, setSpinsToday] = useState(MAX_PER_DAY);
  const [spinsTotal, setSpinsTotal] = useState(MAX_TOTAL);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [modal, setModal] = useState<ModalKind>(null);
  const [wonPrize, setWonPrize] = useState<PrizeKey | null>(null);
  const [gate, setGate] = useState<GateState>({ kind: "idle", rejected: false, loading: false });

  const onActivate = useCallback(async () => {
    setGate({ kind: "idle", rejected: false, loading: true });
    let pos: Position;
    try {
      pos = await requestPosition();
    } catch (err) {
      const code = (err as GeolocationPositionError)?.code;
      if (code === 1) {
        setGate({ kind: "denied" });
      } else {
        setGate({ kind: "idle", rejected: true, loading: false });
      }
      return;
    }
    try {
      const res = await fetch("/api/check-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy }),
      });
      const data = (await res.json()) as LocationCheck;
      if (data.status === "ok") {
        setGate({ kind: "ready", coords: pos, site: data.site });
      } else if (data.status === "site-disabled") {
        setGate({ kind: "site-disabled", coords: pos, siteLabel: data.siteLabel });
      } else if (data.status === "out-of-range") {
        setGate({ kind: "out-of-range", coords: pos, nearestSites: data.nearestSites });
      } else {
        setGate({ kind: "idle", rejected: true, loading: false });
      }
    } catch {
      setGate({ kind: "idle", rejected: true, loading: false });
    }
  }, []);

  const closeModal = useCallback(() => setModal(null), []);

  const onSpin = useCallback(async () => {
    if (spinning) return;
    if (gate.kind !== "ready") return;
    if (spinsToday <= 0) {
      setModal("cap");
      return;
    }
    setSpinning(true);

    // Refresh position right before each spin so we catch users who moved off-site.
    let pos: Position = gate.coords;
    try {
      pos = await requestPosition();
    } catch {
      /* fall back to last known position; server enforces */
    }

    try {
      const res = await fetch("/api/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: pos.lat,
          lng: pos.lng,
          accuracy: pos.accuracy,
          spinsLeftToday: spinsToday,
          spinsLeftTotal: spinsTotal,
        }),
      });
      const data = (await res.json()) as SpinResponse;

      if (data.status === "out-of-range") {
        setSpinning(false);
        setGate({ kind: "out-of-range", coords: pos, nearestSites: data.nearestSites });
        return;
      }
      if (data.status === "site-disabled") {
        setSpinning(false);
        setGate({ kind: "site-disabled", coords: pos, siteLabel: data.siteLabel });
        return;
      }
      if (data.status === "no-location") {
        setSpinning(false);
        setGate({ kind: "idle", rejected: true, loading: false });
        return;
      }

      const spin = data.spin;
      const target = computeTargetRotation(rotation, spin.segmentIndex);
      setRotation(target);
      setGate({ kind: "ready", coords: pos, site: spin.site });

      const prefersReduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const settle = prefersReduce ? 200 : 4400;

      window.setTimeout(() => {
        setSpinsToday(spin.spinsLeftToday);
        setSpinsTotal(spin.spinsLeftTotal);
        setSpinning(false);
        if (spin.outcome === "win") {
          setWonPrize(spin.prizeKey);
          setModal("win");
        } else {
          setModal("lose");
        }
      }, settle);
    } catch (err) {
      console.error(err);
      setSpinning(false);
    }
  }, [gate, rotation, spinning, spinsToday, spinsTotal]);

  const onWinClose = useCallback(() => {
    closeModal();
    if (spinsToday === 0) window.setTimeout(() => setModal("cap"), 250);
  }, [closeModal, spinsToday]);

  const onLoseClose = useCallback(() => {
    closeModal();
    if (spinsToday === 0) window.setTimeout(() => setModal("cap"), 250);
  }, [closeModal, spinsToday]);

  const onLoseRetry = useCallback(() => {
    closeModal();
    if (spinsToday === 0) {
      window.setTimeout(() => setModal("cap"), 250);
    } else {
      window.setTimeout(() => onSpin(), 200);
    }
  }, [closeModal, onSpin, spinsToday]);

  // ───── Render branches ─────
  let body: React.ReactNode;
  if (gate.kind === "idle") {
    body = (
      <ActivateLocationScreen
        onActivate={onActivate}
        loading={gate.loading}
        rejected={gate.rejected}
      />
    );
  } else if (gate.kind === "denied") {
    body = (
      <LocationDeniedScreen onRetry={() => setGate({ kind: "idle", rejected: false, loading: false })} />
    );
  } else if (gate.kind === "out-of-range") {
    body = (
      <OutOfRangeScreen
        nearestSites={gate.nearestSites}
        onRetry={() => setGate({ kind: "idle", rejected: false, loading: false })}
      />
    );
  } else if (gate.kind === "site-disabled") {
    body = (
      <SiteDisabledScreen
        siteLabel={gate.siteLabel}
        onRetry={() => setGate({ kind: "idle", rejected: false, loading: false })}
      />
    );
  } else {
    body = (
      <div className="wheel-stage">
        <h2 className="wheel-title">
          Appuie pour <span className="hilite">tourner</span>
        </h2>
        <p className="wheel-sub">
          Bonne chance, ndaanaan&nbsp;!
          {gate.site ? <><br /><span className="wheel-site-pill">{gate.site.label}</span></> : null}
        </p>

        <Wheel rotation={rotation} spinning={spinning} />

        <div className="spin-cta-wrap">
          <button className="btn btn--invert" onClick={onSpin} disabled={spinning}>
            {spinning ? "Bonne chance…" : "Tourner la roue"}
          </button>
          <p className="spin-helper">{helperWord(spinsToday)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <section className="screen-wheel">
        <Topbar spinsLeftToday={spinsToday} maxSpinsPerDay={MAX_PER_DAY} />
        {body}
        <Footer />
      </section>

      <Modal open={modal === "win" && wonPrize !== null} onClose={onWinClose} ariaLabelledBy="win-title">
        <div className="modal-art" aria-hidden="true">
          <Sparkles />
          {wonPrize ? <PrizeArt pkey={wonPrize} /> : null}
        </div>
        <h2 id="win-title">
          Bravo, <span className="hilite">ndaanaan&nbsp;!</span>
        </h2>
        <p className="lead">
          Tu as gagné <strong>{wonPrize ? PRIZE_LONG_LABEL[wonPrize] : ""}</strong>.
        </p>
        <div className="supervisor-note">
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx={12} cy={8} r={4} stroke="currentColor" strokeWidth={1.7} />
            <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
          </svg>
          <span>Montre cet écran à un superviseur Wave sur place pour recevoir ton cadeau tout de suite.</span>
        </div>
        <div className="actions">
          <button className="btn btn--primary" onClick={onWinClose}>Continuer</button>
          <p className="stat-row">
            {chanceWord(spinsToday)} <ChanceDots left={spinsToday} max={MAX_PER_DAY} />
          </p>
        </div>
      </Modal>

      <Modal open={modal === "lose"} onClose={onLoseClose} ariaLabelledBy="lose-title">
        <div className="modal-art" aria-hidden="true">
          <LoseArt />
        </div>
        <h2 id="lose-title">Pas de chance cette fois&nbsp;😊</h2>
        <p className="lead">Reviens demain pour une nouvelle chance de gagner un cadeau Tabaski.</p>
        <div className="actions">
          <button className="btn btn--primary" onClick={onLoseRetry}>
            {spinsToday > 0 ? "Retenter ma chance" : "Compris"}
          </button>
          <button className="btn btn--ghost-ink" onClick={onLoseClose}>Fermer</button>
          <p className="stat-row">
            {chanceWord(spinsToday)} <ChanceDots left={spinsToday} max={MAX_PER_DAY} />
          </p>
        </div>
      </Modal>

      <Modal open={modal === "cap"} onClose={closeModal} ariaLabelledBy="cap-title">
        <div className="modal-art" aria-hidden="true">
          <CapArt />
        </div>
        <h2 id="cap-title">
          Tu as utilisé tes <span className="hilite">2 chances</span>
        </h2>
        <p className="lead">Reviens demain pour 2 nouvelles chances de gagner.</p>
        <Countdown />
        <div className="actions">
          <button className="btn btn--primary" onClick={closeModal}>Compris</button>
          <p className="stat-row">Garde l’écran de retrait pour le superviseur si tu as déjà gagné.</p>
        </div>
      </Modal>
    </div>
  );
}

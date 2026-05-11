"use client";

import { useCallback, useEffect, useState } from "react";
import { Topbar } from "@/components/Topbar";
import { Footer } from "@/components/Footer";
import { Wheel, computeTargetRotation } from "@/components/Wheel";
import { Modal } from "@/components/Modal";
import { CapArt, LoseArt, PrizeArt, Sparkles } from "@/components/PrizeArt";
import { PRIZE_LONG_LABEL, type PrizeKey } from "@/lib/prizes";
import type { SpinResult } from "@/lib/spin";

const MAX_PER_DAY = 2;
const MAX_TOTAL = 8;

type ModalKind = "win" | "lose" | "cap" | null;

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

export default function WheelPage() {
  const [spinsToday, setSpinsToday] = useState(MAX_PER_DAY);
  const [spinsTotal, setSpinsTotal] = useState(MAX_TOTAL);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [modal, setModal] = useState<ModalKind>(null);
  const [wonPrize, setWonPrize] = useState<PrizeKey | null>(null);

  const closeModal = useCallback(() => setModal(null), []);

  const onSpin = useCallback(async () => {
    if (spinning) return;
    if (spinsToday <= 0) {
      setModal("cap");
      return;
    }
    setSpinning(true);
    try {
      const res = await fetch("/api/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spinsLeftToday: spinsToday, spinsLeftTotal: spinsTotal }),
      });
      if (!res.ok) throw new Error(`spin failed: ${res.status}`);
      const result: SpinResult = await res.json();

      const target = computeTargetRotation(rotation, result.segmentIndex);
      setRotation(target);

      const prefersReduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const settle = prefersReduce ? 200 : 4400;

      window.setTimeout(() => {
        setSpinsToday(result.spinsLeftToday);
        setSpinsTotal(result.spinsLeftTotal);
        setSpinning(false);
        if (result.outcome === "win") {
          setWonPrize(result.prizeKey);
          setModal("win");
        } else {
          setModal("lose");
        }
      }, settle);
    } catch (err) {
      console.error(err);
      setSpinning(false);
    }
  }, [rotation, spinning, spinsToday, spinsTotal]);

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

  return (
    <div className="app">
      <section className="screen-wheel">
        <Topbar spinsLeftToday={spinsToday} maxSpinsPerDay={MAX_PER_DAY} />

        <div className="wheel-stage">
          <h2 className="wheel-title">
            Appuie pour <span className="hilite">tourner</span>
          </h2>
          <p className="wheel-sub">Bonne chance, ndaanaan&nbsp;!</p>

          <Wheel rotation={rotation} spinning={spinning} />

          <div className="spin-cta-wrap">
            <button className="btn btn--invert" onClick={onSpin} disabled={spinning}>
              {spinning ? "Bonne chance…" : "Tourner la roue"}
            </button>
            <p className="spin-helper">{helperWord(spinsToday)}</p>
          </div>
        </div>

        <Footer />
      </section>

      {/* WIN MODAL */}
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

      {/* LOSE MODAL */}
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

      {/* DAILY-CAP MODAL */}
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

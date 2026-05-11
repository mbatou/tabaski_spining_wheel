"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import type { StoreSnapshot } from "@/lib/store";
import type { SiteSlug } from "@/lib/sites";
import type { PrizeKey } from "@/lib/prizes";

const PRIZE_LABELS: Record<Exclude<PrizeKey, "lose">, string> = {
  sac: "Sacs shopping",
  tablier: "Tabliers",
  eventail: "Éventails",
  gourde: "Gourdes",
};

const REFRESH_INTERVAL_MS = 15_000;

function formatNum(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n);
}

export function SupervisorPanel({ initial }: { initial: StoreSnapshot }) {
  const [state, setState] = useState<StoreSnapshot>(initial);
  const [pendingSite, setPendingSite] = useState<SiteSlug | null>(null);
  const [pendingPrize, setPendingPrize] = useState<PrizeKey | null>(null);
  const [isPending, startTransition] = useTransition();
  const [stockDrafts, setStockDrafts] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/state", { cache: "no-store" });
      if (res.ok) {
        const next = (await res.json()) as StoreSnapshot;
        setState(next);
      }
    } catch {
      /* ignore transient network blips */
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  const onToggleSite = useCallback(async (slug: SiteSlug, next: boolean) => {
    setPendingSite(slug);
    try {
      const res = await fetch("/api/admin/site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site: slug, winsEnabled: next }),
      });
      if (res.ok) setState(await res.json());
    } finally {
      setPendingSite(null);
    }
  }, []);

  const onSubmitStock = useCallback(
    async (prize: Exclude<PrizeKey, "lose">) => {
      const raw = stockDrafts[prize];
      if (raw === undefined || raw === "") return;
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0) return;
      setPendingPrize(prize);
      try {
        const res = await fetch("/api/admin/stock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prize, value: Math.floor(value) }),
        });
        if (res.ok) {
          setState(await res.json());
          setStockDrafts((d) => ({ ...d, [prize]: "" }));
        }
      } finally {
        setPendingPrize(null);
      }
    },
    [stockDrafts],
  );

  const stockPrizes = ["sac", "tablier", "eventail", "gourde"] as const;
  const totalStockUsed = stockPrizes.reduce(
    (acc, k) => acc + (state.initialStock[k] - state.stock[k]),
    0,
  );
  const totalStockInitial = stockPrizes.reduce((acc, k) => acc + state.initialStock[k], 0);

  return (
    <div className="sup-shell">
      <header className="sup-header">
        <div>
          <p className="sup-eyebrow">Wave · Tabaski 2026</p>
          <h1>Supervision de la campagne</h1>
        </div>
        <form method="POST" action="/supervisor/logout">
          <button className="btn btn--ghost-ink" type="submit">Déconnexion</button>
        </form>
      </header>

      <section className="sup-section">
        <h2>Stock global</h2>
        <p className="sup-hint">
          Stock partagé entre les 5 sites. Les gains sont décrémentés ici à chaque victoire validée.
          Aujourd’hui (Dakar) : <strong>{formatNum(state.totals.wins)}</strong> gains attribués sur
          un total de <strong>{formatNum(totalStockUsed)}</strong> / {formatNum(totalStockInitial)}{" "}
          dans le stock initial.
        </p>
        <div className="sup-grid">
          {stockPrizes.map((p) => {
            const remaining = state.stock[p];
            const initial = state.initialStock[p];
            const used = initial - remaining;
            const pct = initial === 0 ? 0 : Math.min(100, Math.round((used / initial) * 100));
            return (
              <div key={p} className="sup-card">
                <div className="sup-card-head">
                  <span className="sup-card-title">{PRIZE_LABELS[p]}</span>
                  <span className="sup-card-num">{formatNum(remaining)}</span>
                </div>
                <div className="sup-bar"><div style={{ width: `${pct}%` }} /></div>
                <div className="sup-card-meta">
                  <span>{formatNum(used)} attribués</span>
                  <span>{formatNum(initial)} initial</span>
                </div>
                <div className="sup-stock-edit">
                  <input
                    type="number"
                    min={0}
                    placeholder={String(remaining)}
                    value={stockDrafts[p] ?? ""}
                    onChange={(e) => setStockDrafts((d) => ({ ...d, [p]: e.target.value }))}
                    aria-label={`Nouveau stock pour ${PRIZE_LABELS[p]}`}
                  />
                  <button
                    className="btn btn--primary sup-stock-btn"
                    type="button"
                    onClick={() => onSubmitStock(p)}
                    disabled={
                      pendingPrize === p ||
                      stockDrafts[p] === undefined ||
                      stockDrafts[p] === ""
                    }
                  >
                    {pendingPrize === p ? "…" : "Définir"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="sup-section">
        <h2>Sites de retrait</h2>
        <p className="sup-hint">
          Désactiver les gains sur un site force tous les spins à perdre, mais la roue continue à
          tourner pour l’utilisateur. Aucune attribution de lot n’est faite tant que les gains sont
          désactivés.
        </p>
        <div className="sup-table">
          <div className="sup-row sup-row--head">
            <span>Site</span>
            <span>Aujourd’hui</span>
            <span>Total campagne</span>
            <span>Gains</span>
          </div>
          {state.sites.map((s) => (
            <div key={s.slug} className="sup-row">
              <span className="sup-site-name">
                <strong>{s.label}</strong>
                <code className="sup-site-slug">/?site={s.slug}</code>
              </span>
              <span className="sup-stat">
                {formatNum(s.today.attempts)} spins
                <em>
                  {formatNum(s.today.wins.sac + s.today.wins.tablier + s.today.wins.eventail + s.today.wins.gourde)} gains
                </em>
              </span>
              <span className="sup-stat">
                {formatNum(s.total.attempts)} spins
                <em>
                  {formatNum(s.total.wins.sac + s.total.wins.tablier + s.total.wins.eventail + s.total.wins.gourde)} gains
                </em>
              </span>
              <span className="sup-toggle-cell">
                <button
                  type="button"
                  role="switch"
                  aria-checked={s.winsEnabled}
                  className={`sup-toggle ${s.winsEnabled ? "is-on" : "is-off"}`}
                  onClick={() =>
                    startTransition(() => {
                      onToggleSite(s.slug, !s.winsEnabled);
                    })
                  }
                  disabled={pendingSite === s.slug || isPending}
                >
                  <span className="sup-toggle-knob" aria-hidden="true" />
                  <span className="sup-toggle-lbl">{s.winsEnabled ? "Activés" : "Désactivés"}</span>
                </button>
              </span>
            </div>
          ))}
        </div>
      </section>

      <footer className="sup-footer">
        <p>
          Données mises à jour automatiquement toutes les 15 secondes ·{" "}
          <button type="button" className="sup-link" onClick={refresh}>Rafraîchir maintenant</button>
        </p>
        <p className="sup-warn">
          Stockage en mémoire (chunk 1) — sera remplacé par Upstash Redis en chunk 2 pour persister
          au-delà des redémarrages.
        </p>
      </footer>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import type { StoreSnapshot } from "@/lib/store";
import type { SiteSlug } from "@/lib/sites";
import { DEFAULT_SITE_RADIUS_M } from "@/lib/sites";
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

function formatCoord(n: number): string {
  return n.toFixed(6);
}

function formatRelTime(ms: number): string {
  const diff = Math.max(0, Date.now() - ms);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "à l’instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days} j`;
}

export function SupervisorPanel({ initial }: { initial: StoreSnapshot }) {
  const [state, setState] = useState<StoreSnapshot>(initial);
  const [pendingSite, setPendingSite] = useState<SiteSlug | null>(null);
  const [pendingPrize, setPendingPrize] = useState<PrizeKey | null>(null);
  const [pendingCoordsSite, setPendingCoordsSite] = useState<SiteSlug | null>(null);
  const [coordsError, setCoordsError] = useState<{ slug: SiteSlug; msg: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [stockDrafts, setStockDrafts] = useState<Record<string, string>>({});
  const [coordsDrafts, setCoordsDrafts] = useState<
    Record<string, { lat: string; lng: string; radius: string; open: boolean }>
  >({});

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/state", { cache: "no-store" });
      if (res.ok) setState(await res.json());
    } catch {
      /* ignore transient blips */
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

  const saveCoords = useCallback(async (slug: SiteSlug, lat: number, lng: number, radiusM: number) => {
    setPendingCoordsSite(slug);
    setCoordsError(null);
    try {
      const res = await fetch("/api/admin/coords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site: slug, lat, lng, radiusM }),
      });
      if (res.ok) {
        setState(await res.json());
        setCoordsDrafts((d) => ({ ...d, [slug]: { lat: "", lng: "", radius: "", open: false } }));
      } else {
        setCoordsError({ slug, msg: "Échec de l’enregistrement." });
      }
    } catch {
      setCoordsError({ slug, msg: "Erreur réseau." });
    } finally {
      setPendingCoordsSite(null);
    }
  }, []);

  const grabCurrentLocation = useCallback(
    (slug: SiteSlug, radiusM: number) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        setCoordsError({ slug, msg: "Géolocalisation indisponible sur cet appareil." });
        return;
      }
      setPendingCoordsSite(slug);
      setCoordsError(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          saveCoords(slug, pos.coords.latitude, pos.coords.longitude, radiusM);
        },
        (err) => {
          setPendingCoordsSite(null);
          const msg =
            err.code === 1
              ? "Autorisation de localisation refusée."
              : err.code === 2
                ? "Position indisponible."
                : "Délai dépassé.";
          setCoordsError({ slug, msg });
        },
        { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
      );
    },
    [saveCoords],
  );

  const clearCoords = useCallback(async (slug: SiteSlug) => {
    setPendingCoordsSite(slug);
    try {
      const res = await fetch(`/api/admin/coords?site=${encodeURIComponent(slug)}`, {
        method: "DELETE",
      });
      if (res.ok) setState(await res.json());
    } finally {
      setPendingCoordsSite(null);
    }
  }, []);

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
        <div className="sup-header-actions">
          <Link href="/supervisor/report" className="btn btn--primary sup-report-link">
            Rapport campagne
          </Link>
          <form method="POST" action="/supervisor/logout">
            <button className="btn btn--ghost-ink" type="submit">Déconnexion</button>
          </form>
        </div>
      </header>

      <section className="sup-section">
        <h2>Stock global</h2>
        <p className="sup-hint">
          Stock partagé entre tous les sites. Aujourd’hui (Dakar) :{" "}
          <strong>{formatNum(state.totals.wins)}</strong> gains attribués sur un total de{" "}
          <strong>{formatNum(totalStockUsed)}</strong> / {formatNum(totalStockInitial)} dans le
          stock initial.
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
          Chaque site est défini par sa position GPS et un rayon (par défaut {DEFAULT_SITE_RADIUS_M} m).
          Les utilisateurs doivent se trouver à l’intérieur de ce périmètre pour pouvoir tourner la
          roue. Désactive les gains pour mettre un site en pause sans toucher à sa configuration.
        </p>
        <ul className="sup-sitelist">
          {state.sites.map((s) => {
            const draft = coordsDrafts[s.slug] ?? { lat: "", lng: "", radius: "", open: false };
            const isPending = pendingCoordsSite === s.slug;
            const radiusFromState = s.coords?.radiusM ?? DEFAULT_SITE_RADIUS_M;
            const wins =
              s.today.wins.sac + s.today.wins.tablier + s.today.wins.eventail + s.today.wins.gourde;
            const totalWins =
              s.total.wins.sac + s.total.wins.tablier + s.total.wins.eventail + s.total.wins.gourde;
            return (
              <li key={s.slug} className="sup-sitecard">
                <div className="sup-sitecard-top">
                  <div className="sup-site-name">
                    <strong>{s.label}</strong>
                    {s.pending ? <span className="sup-tag sup-tag--warn">À configurer plus tard</span> : null}
                    {!s.pending && !s.coords ? <span className="sup-tag sup-tag--warn">Localisation requise</span> : null}
                    {s.coords ? (
                      <span className="sup-tag">
                        {formatCoord(s.coords.lat)}, {formatCoord(s.coords.lng)} ·{" "}
                        {s.coords.radiusM} m
                      </span>
                    ) : null}
                  </div>
                  <div className="sup-toggle-cell">
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
                      <span className="sup-toggle-lbl">
                        {s.winsEnabled ? "Activés" : "Désactivés"}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="sup-sitestats">
                  <div>
                    <span className="sup-statlbl">Aujourd’hui</span>
                    <strong>{formatNum(s.today.attempts)} spins</strong>
                    <em>{formatNum(wins)} gains</em>
                  </div>
                  <div>
                    <span className="sup-statlbl">Total campagne</span>
                    <strong>{formatNum(s.total.attempts)} spins</strong>
                    <em>{formatNum(totalWins)} gains</em>
                  </div>
                  {s.coords ? (
                    <div>
                      <span className="sup-statlbl">Mise à jour</span>
                      <strong>{formatRelTime(s.coords.updatedAt)}</strong>
                    </div>
                  ) : null}
                </div>

                {!s.pending ? (
                  <div className="sup-coords">
                    <button
                      type="button"
                      className="sup-coords-toggle"
                      onClick={() =>
                        setCoordsDrafts((d) => ({
                          ...d,
                          [s.slug]: { ...draft, open: !draft.open },
                        }))
                      }
                    >
                      {draft.open ? "Masquer" : "Configurer la localisation"}
                    </button>

                    {draft.open ? (
                      <div className="sup-coords-form">
                        <button
                          type="button"
                          className="btn btn--primary sup-coords-btn"
                          disabled={isPending}
                          onClick={() => grabCurrentLocation(s.slug, radiusFromState)}
                        >
                          {isPending ? "Acquisition GPS…" : "Utiliser ma position actuelle"}
                        </button>

                        <div className="sup-coords-grid">
                          <label>
                            <span>Latitude</span>
                            <input
                              type="number"
                              step="any"
                              placeholder={s.coords ? formatCoord(s.coords.lat) : "14.6928"}
                              value={draft.lat}
                              onChange={(e) =>
                                setCoordsDrafts((d) => ({
                                  ...d,
                                  [s.slug]: { ...draft, lat: e.target.value },
                                }))
                              }
                            />
                          </label>
                          <label>
                            <span>Longitude</span>
                            <input
                              type="number"
                              step="any"
                              placeholder={s.coords ? formatCoord(s.coords.lng) : "-17.4467"}
                              value={draft.lng}
                              onChange={(e) =>
                                setCoordsDrafts((d) => ({
                                  ...d,
                                  [s.slug]: { ...draft, lng: e.target.value },
                                }))
                              }
                            />
                          </label>
                          <label>
                            <span>Rayon (m)</span>
                            <input
                              type="number"
                              min={20}
                              max={2000}
                              step={10}
                              placeholder={String(radiusFromState)}
                              value={draft.radius}
                              onChange={(e) =>
                                setCoordsDrafts((d) => ({
                                  ...d,
                                  [s.slug]: { ...draft, radius: e.target.value },
                                }))
                              }
                            />
                          </label>
                        </div>

                        <div className="sup-coords-actions">
                          <button
                            type="button"
                            className="btn btn--ghost-ink"
                            disabled={isPending || draft.lat === "" || draft.lng === ""}
                            onClick={() => {
                              const lat = Number(draft.lat);
                              const lng = Number(draft.lng);
                              const r = draft.radius === "" ? radiusFromState : Number(draft.radius);
                              if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                                setCoordsError({ slug: s.slug, msg: "Coordonnées invalides." });
                                return;
                              }
                              saveCoords(s.slug, lat, lng, r);
                            }}
                          >
                            Enregistrer
                          </button>
                          {s.coords ? (
                            <button
                              type="button"
                              className="btn btn--ghost-ink sup-coords-clear"
                              disabled={isPending}
                              onClick={() => clearCoords(s.slug)}
                            >
                              Effacer la position
                            </button>
                          ) : null}
                        </div>

                        {coordsError && coordsError.slug === s.slug ? (
                          <p className="sup-coords-error" role="alert">
                            {coordsError.msg}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <footer className="sup-footer">
        <p>
          Données mises à jour automatiquement toutes les 15 secondes ·{" "}
          <button type="button" className="sup-link" onClick={refresh}>
            Rafraîchir maintenant
          </button>
        </p>
        <p className="sup-warn">
          Stockage en mémoire (chunk 1) — sera remplacé par Upstash Redis en chunk 2 pour persister
          au-delà des redémarrages.
        </p>
      </footer>
    </div>
  );
}

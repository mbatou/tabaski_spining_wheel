"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { CampaignReport } from "@/lib/store";

const PRIZE_LABELS = {
  sac: "Sacs shopping",
  tablier: "Tabliers",
  eventail: "Éventails",
  gourde: "Gourdes",
} as const;

const PRIZE_KEYS = ["sac", "tablier", "eventail", "gourde"] as const;

function fmt(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n);
}

function fmtPct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)} %`;
}

function fmtIsoDateFr(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Dakar",
    weekday: "short",
    day: "numeric",
    month: "long",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

function fmtGeneratedAt(ms: number): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Dakar",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms));
}

function downloadCsv(name: string, rows: (string | number)[][]): void {
  const csv = rows
    .map((row) =>
      row
        .map((v) => {
          const s = String(v ?? "");
          return /[",\n;]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
        })
        .join(","),
    )
    .join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ReportView({ initial }: { initial: CampaignReport }) {
  const [report, setReport] = useState<CampaignReport>(initial);
  const [busy, setBusy] = useState<null | "seeding" | "resetting">(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/report", { cache: "no-store" });
      if (res.ok) setReport(await res.json());
    } catch {
      /* ignore */
    }
  }, []);

  const seedDemo = useCallback(async () => {
    const ok = window.confirm(
      "Ceci REMPLACERA toutes les données actuelles par un jeu de démonstration " +
        "couvrant la période de la campagne (11 — 25 mai 2026). À utiliser uniquement " +
        "pour les présentations ATL.\n\nContinuer ?",
    );
    if (!ok) return;
    setBusy("seeding");
    try {
      await fetch("/api/admin/seed-demo", { method: "POST" });
      await refresh();
    } finally {
      setBusy(null);
    }
  }, [refresh]);

  const resetData = useCallback(async () => {
    const ok = window.confirm(
      "Ceci EFFACERA toutes les données (réelles ou de démonstration). " +
        "Les coordonnées GPS et l'état activé/désactivé des sites sont préservés.\n\nContinuer ?",
    );
    if (!ok) return;
    setBusy("resetting");
    try {
      await fetch("/api/admin/seed-demo", { method: "DELETE" });
      await refresh();
    } finally {
      setBusy(null);
    }
  }, [refresh]);

  useEffect(() => {
    // Refresh once on mount to ensure we render the freshest data even if the
    // page was kept open in a tab during the campaign.
    void refresh();
  }, [refresh]);

  const statusLabel =
    report.status === "ended"
      ? "Campagne terminée"
      : report.status === "live"
        ? "Campagne en cours"
        : "Campagne à venir";

  const distributedTotal = PRIZE_KEYS.reduce((a, k) => a + report.stock[k].distributed, 0);
  const initialTotal = PRIZE_KEYS.reduce((a, k) => a + report.stock[k].initial, 0);

  const exportSummary = useCallback(() => {
    downloadCsv("tabaski-2026-resume.csv", [
      ["Métrique", "Valeur"],
      ["Période", `${report.campaignStart} → ${report.campaignEnd}`],
      ["Statut", statusLabel],
      ["Sites configurés", report.summary.siteCount],
      ["Jours actifs", report.summary.activeDays],
      ["Total spins", report.summary.totalAttempts],
      ["Total gains", report.summary.totalWins],
      ["Total pertes", report.summary.totalLosses],
      ["Taux de gain", fmtPct(report.summary.winRate, 2)],
      [""],
      ["Lot", "Initial", "Distribués", "Restant", "Taux"],
      ...PRIZE_KEYS.map((k) => [
        PRIZE_LABELS[k],
        report.stock[k].initial,
        report.stock[k].distributed,
        report.stock[k].remaining,
        fmtPct(report.stock[k].pct, 2),
      ]),
    ]);
  }, [report, statusLabel]);

  const exportSites = useCallback(() => {
    downloadCsv("tabaski-2026-sites.csv", [
      ["Site", "Statut", "Spins", "Gains", "Pertes", "Taux gain", "Sacs", "Tabliers", "Éventails", "Gourdes"],
      ...report.sites.map((s) => [
        s.label,
        s.pending ? "En attente" : s.winsEnabled ? "Activé" : "Pause",
        s.attempts,
        s.wins,
        s.losses,
        fmtPct(s.winRate, 2),
        s.prizes.sac,
        s.prizes.tablier,
        s.prizes.eventail,
        s.prizes.gourde,
      ]),
    ]);
  }, [report]);

  const exportDaily = useCallback(() => {
    downloadCsv("tabaski-2026-quotidien.csv", [
      ["Date", "Spins", "Gains", "Pertes", "Sacs", "Tabliers", "Éventails", "Gourdes"],
      ...report.daily.map((d) => [
        d.date,
        d.totals.attempts,
        d.totals.wins,
        d.totals.losses,
        d.prizes.sac,
        d.prizes.tablier,
        d.prizes.eventail,
        d.prizes.gourde,
      ]),
    ]);
  }, [report]);

  const peakDay = report.daily.reduce<typeof report.daily[number] | null>(
    (best, d) => (best === null || d.totals.attempts > best.totals.attempts ? d : best),
    null,
  );

  return (
    <div className="rpt-shell">
      {!report.persistent ? (
        <div className="rpt-banner" role="alert">
          <strong>Stockage non-persistant.</strong> Ce rapport ne couvre que la période depuis le
          dernier redémarrage du serveur. Active Upstash Redis (variables{" "}
          <code>UPSTASH_REDIS_REST_URL</code> / <code>UPSTASH_REDIS_REST_TOKEN</code>) pour
          conserver l’historique complet de la campagne.
        </div>
      ) : null}

      <header className="rpt-header">
        <div>
          <p className="rpt-eyebrow">Wave · Tabaski 2026</p>
          <h1>Rapport de campagne</h1>
          <p className="rpt-meta">
            Période&nbsp;: <strong>{report.campaignStart}</strong> → <strong>{report.campaignEnd}</strong>{" "}
            · <span className={`rpt-pill rpt-pill--${report.status}`}>{statusLabel}</span>
            <br />
            Généré le {fmtGeneratedAt(report.generatedAt)} (Africa/Dakar)
          </p>
        </div>
        <nav className="rpt-actions" aria-label="Actions du rapport">
          <Link href="/supervisor" className="btn btn--ghost-ink">
            ← Panneau
          </Link>
          <button type="button" className="btn btn--ghost-ink" onClick={() => window.print()}>
            Imprimer
          </button>
          <button type="button" className="btn btn--primary" onClick={exportSummary}>
            Résumé CSV
          </button>
        </nav>
      </header>

      <div className="rpt-demo-bar">
        <div className="rpt-demo-text">
          <strong>Données de démonstration</strong>
          <span>
            Pour les présentations ATL — génère un jeu de données rétroactif et déterministe sur la période {report.campaignStart} → {report.campaignEnd}.
            {!report.persistent
              ? " À ré-exécuter après chaque cold start serveur tant que Redis n'est pas branché."
              : ""}
          </span>
        </div>
        <div className="rpt-demo-actions">
          <button
            type="button"
            className="btn btn--primary rpt-export"
            onClick={seedDemo}
            disabled={busy !== null}
          >
            {busy === "seeding" ? "Génération…" : "Charger données de démo"}
          </button>
          <button
            type="button"
            className="btn btn--ghost-ink rpt-export"
            onClick={resetData}
            disabled={busy !== null}
          >
            {busy === "resetting" ? "Effacement…" : "Effacer les données"}
          </button>
        </div>
      </div>

      <section className="rpt-section">
        <h2>Résumé exécutif</h2>
        <div className="rpt-stats">
          <div className="rpt-stat">
            <span className="rpt-stat-lbl">Spins total</span>
            <strong>{fmt(report.summary.totalAttempts)}</strong>
            <em>{report.summary.activeDays} j actifs</em>
          </div>
          <div className="rpt-stat">
            <span className="rpt-stat-lbl">Gains attribués</span>
            <strong>{fmt(report.summary.totalWins)}</strong>
            <em>sur {fmt(initialTotal)} prévus</em>
          </div>
          <div className="rpt-stat">
            <span className="rpt-stat-lbl">Pertes</span>
            <strong>{fmt(report.summary.totalLosses)}</strong>
            <em>{fmtPct(report.summary.totalAttempts === 0 ? 0 : report.summary.totalLosses / report.summary.totalAttempts)}</em>
          </div>
          <div className="rpt-stat">
            <span className="rpt-stat-lbl">Taux de gain</span>
            <strong>{fmtPct(report.summary.winRate, 1)}</strong>
            <em>{report.summary.siteCount} sites actifs</em>
          </div>
        </div>
        {peakDay && peakDay.totals.attempts > 0 ? (
          <p className="rpt-callout">
            Jour de pointe&nbsp;: <strong>{fmtIsoDateFr(peakDay.date)}</strong>{" "}
            avec <strong>{fmt(peakDay.totals.attempts)} spins</strong> et{" "}
            <strong>{fmt(peakDay.totals.wins)} gains</strong>.
          </p>
        ) : null}
      </section>

      <section className="rpt-section">
        <h2>Distribution des lots</h2>
        <div className="rpt-grid">
          {PRIZE_KEYS.map((k) => {
            const v = report.stock[k];
            return (
              <div key={k} className="rpt-card">
                <div className="rpt-card-head">
                  <span>{PRIZE_LABELS[k]}</span>
                  <strong>{fmt(v.distributed)}</strong>
                </div>
                <div className="rpt-bar"><div style={{ width: `${Math.round(v.pct * 100)}%` }} /></div>
                <div className="rpt-card-meta">
                  <span>{fmt(v.remaining)} restants</span>
                  <span>{fmtPct(v.pct, 1)}</span>
                </div>
              </div>
            );
          })}
        </div>
        <p className="rpt-foot">
          Total distribué&nbsp;: <strong>{fmt(distributedTotal)}</strong> sur{" "}
          <strong>{fmt(initialTotal)}</strong> ({fmtPct(initialTotal === 0 ? 0 : distributedTotal / initialTotal, 1)}).
        </p>
      </section>

      <section className="rpt-section">
        <div className="rpt-section-head">
          <h2>Performance par site</h2>
          <button type="button" className="btn btn--ghost-ink rpt-export" onClick={exportSites}>
            CSV
          </button>
        </div>
        <div className="rpt-table-wrap">
          <table className="rpt-table">
            <thead>
              <tr>
                <th>Site</th>
                <th className="rpt-num">Spins</th>
                <th className="rpt-num">Gains</th>
                <th className="rpt-num">Pertes</th>
                <th className="rpt-num">Taux</th>
                <th className="rpt-num">Sacs</th>
                <th className="rpt-num">Tabliers</th>
                <th className="rpt-num">Éventails</th>
                <th className="rpt-num">Gourdes</th>
              </tr>
            </thead>
            <tbody>
              {[...report.sites]
                .sort((a, b) => b.attempts - a.attempts)
                .map((s) => (
                  <tr key={s.slug}>
                    <td>
                      <strong>{s.label}</strong>
                      <em className={`rpt-status rpt-status--${s.pending ? "pending" : s.winsEnabled ? "on" : "off"}`}>
                        {s.pending ? "En attente" : s.winsEnabled ? "Activé" : "Pause"}
                      </em>
                    </td>
                    <td className="rpt-num">{fmt(s.attempts)}</td>
                    <td className="rpt-num">{fmt(s.wins)}</td>
                    <td className="rpt-num">{fmt(s.losses)}</td>
                    <td className="rpt-num">{fmtPct(s.winRate, 1)}</td>
                    <td className="rpt-num">{fmt(s.prizes.sac)}</td>
                    <td className="rpt-num">{fmt(s.prizes.tablier)}</td>
                    <td className="rpt-num">{fmt(s.prizes.eventail)}</td>
                    <td className="rpt-num">{fmt(s.prizes.gourde)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rpt-section">
        <div className="rpt-section-head">
          <h2>Activité par jour</h2>
          <button type="button" className="btn btn--ghost-ink rpt-export" onClick={exportDaily}>
            CSV
          </button>
        </div>
        <div className="rpt-table-wrap">
          <table className="rpt-table">
            <thead>
              <tr>
                <th>Date</th>
                <th className="rpt-num">Spins</th>
                <th className="rpt-num">Gains</th>
                <th className="rpt-num">Pertes</th>
                <th className="rpt-num">Sacs</th>
                <th className="rpt-num">Tabliers</th>
                <th className="rpt-num">Éventails</th>
                <th className="rpt-num">Gourdes</th>
                <th>Volume</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const maxA = report.daily.reduce((m, d) => Math.max(m, d.totals.attempts), 0);
                return report.daily.map((d) => {
                  const pct = maxA === 0 ? 0 : (d.totals.attempts / maxA) * 100;
                  return (
                    <tr key={d.date} className={d.totals.attempts === 0 ? "rpt-row-empty" : ""}>
                      <td>{fmtIsoDateFr(d.date)}</td>
                      <td className="rpt-num">{fmt(d.totals.attempts)}</td>
                      <td className="rpt-num">{fmt(d.totals.wins)}</td>
                      <td className="rpt-num">{fmt(d.totals.losses)}</td>
                      <td className="rpt-num">{fmt(d.prizes.sac)}</td>
                      <td className="rpt-num">{fmt(d.prizes.tablier)}</td>
                      <td className="rpt-num">{fmt(d.prizes.eventail)}</td>
                      <td className="rpt-num">{fmt(d.prizes.gourde)}</td>
                      <td className="rpt-spark"><span style={{ width: `${pct}%` }} aria-hidden="true" />{d.totals.attempts === 0 ? "—" : null}</td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="rpt-foot-block">
        <p>
          Rapport généré automatiquement à partir des compteurs serveur. Les
          montants distribués sont décrémentés au moment exact de l’attribution
          d’un lot.
        </p>
        <p className="rpt-foot-note">
          Pour archiver le rapport, utilise <em>Imprimer</em> → <em>Enregistrer en PDF</em>.
          Les fichiers CSV exportés peuvent être ouverts dans Excel ou Google Sheets.
        </p>
      </footer>
    </div>
  );
}

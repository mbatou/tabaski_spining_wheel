"use client";

import type { NearestSiteSuggestion } from "@/lib/spin";

function GeoIcon() {
  return (
    <svg width={56} height={56} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 22s7-7.58 7-13a7 7 0 0 0-14 0c0 5.42 7 13 7 13z"
        stroke="#fff"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={12} cy={9.5} r={2.5} fill="#FFE89A" stroke="#fff" strokeWidth={1.6} />
    </svg>
  );
}

function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km`;
}

export function ActivateLocationScreen({
  onActivate,
  loading,
  rejected,
}: {
  onActivate: () => void;
  loading: boolean;
  rejected: boolean;
}) {
  return (
    <div className="gate">
      <div className="gate-art" aria-hidden="true">
        <GeoIcon />
      </div>
      <h2 className="gate-title">
        Active ta <span className="hilite">localisation</span>
      </h2>
      <p className="gate-lead">
        Pour participer à la roue Tabaski ndaanaan, autorise ton téléphone à partager ta position.
        Elle nous permet de t’attribuer à un point de retrait Wave.
      </p>
      {rejected ? (
        <p className="gate-error">
          Nous n’avons pas pu obtenir ta position. Vérifie que la localisation est activée puis
          réessaie.
        </p>
      ) : null}
      <div className="gate-actions">
        <button className="btn btn--invert" onClick={onActivate} disabled={loading}>
          {loading ? "Activation…" : "Activer la localisation"}
        </button>
      </div>
    </div>
  );
}

export function LocationDeniedScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="gate">
      <div className="gate-art" aria-hidden="true">
        <GeoIcon />
      </div>
      <h2 className="gate-title">
        Localisation <span className="hilite">requise</span>
      </h2>
      <p className="gate-lead">
        L’autorisation de localisation a été refusée. Pour participer, ouvre les réglages de ton
        navigateur, autorise la localisation pour ce site, puis recharge la page.
      </p>
      <div className="gate-actions">
        <button className="btn btn--invert" onClick={onRetry}>Réessayer</button>
      </div>
    </div>
  );
}

export function OutOfRangeScreen({
  nearestSites,
  onRetry,
}: {
  nearestSites: NearestSiteSuggestion[];
  onRetry: () => void;
}) {
  return (
    <div className="gate">
      <div className="gate-art" aria-hidden="true">
        <GeoIcon />
      </div>
      <h2 className="gate-title">
        Tu n’es pas sur un <span className="hilite">point Wave</span>
      </h2>
      <p className="gate-lead">
        La roue Tabaski s’active uniquement sur les points de retrait Wave. Rends-toi sur l’un des
        sites ci-dessous pour participer.
      </p>
      {nearestSites.length > 0 ? (
        <ul className="gate-list">
          {nearestSites.map((s) => {
            const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`;
            return (
              <li key={s.slug} className="gate-list-row">
                <span className="gate-list-name">
                  <strong>{s.label}</strong>
                  <em>à {formatDistance(s.distanceM)}</em>
                </span>
                <a className="gate-list-link" href={mapsUrl} target="_blank" rel="noreferrer">
                  Itinéraire
                </a>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="gate-lead gate-muted">
          Aucun point de retrait n’est encore configuré.
        </p>
      )}
      <div className="gate-actions">
        <button className="btn btn--invert" onClick={onRetry}>Mettre à jour ma position</button>
      </div>
    </div>
  );
}

export function SiteDisabledScreen({
  siteLabel,
  onRetry,
}: {
  siteLabel: string;
  onRetry: () => void;
}) {
  return (
    <div className="gate">
      <div className="gate-art" aria-hidden="true">
        <GeoIcon />
      </div>
      <h2 className="gate-title">
        Les gains sont en <span className="hilite">pause</span>
      </h2>
      <p className="gate-lead">
        Bienvenue à <strong>{siteLabel}</strong>. Les gains sont temporairement mis en pause par
        l’équipe Wave. Reviens dans quelques minutes&nbsp;!
      </p>
      <div className="gate-actions">
        <button className="btn btn--invert" onClick={onRetry}>Réessayer</button>
      </div>
    </div>
  );
}

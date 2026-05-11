import Link from "next/link";

export const metadata = {
  title: "Wave · Conditions générales — Tabaski 2026",
};

export default function ConditionsPage() {
  return (
    <div className="app">
      <main className="cgu-wrap">
        <Link href="/" className="back" aria-label="Retour à la roue">
          ← Retour
        </Link>
        <h1>Conditions générales — Tabaski ndaanaan 2026</h1>
        <p>
          Campagne du 11 mai 2026 au 25 mai 2026. Sponsor&nbsp;: Wave Mobile Money.
        </p>

        {/* TODO ATL: replace the placeholder sections below with the final, legally-approved T&Cs supplied in the project drive. */}
        <h2>1. Participation</h2>
        <p>
          [Placeholder — ATL à remplir] Conditions d’éligibilité&nbsp;: chaque utilisateur Wave ayant
          effectué un paiement marchand peut bénéficier d’une chance par paiement, dans la limite
          de 2 chances par jour et 8 chances pendant toute la durée de la campagne.
        </p>

        <h2>2. Lots</h2>
        <p>
          [Placeholder — ATL à remplir] Lots disponibles&nbsp;: Sac shopping, Tablier, Éventail, Gourde.
          Les lots sont attribués dans la limite des stocks disponibles. Aucun lot ne pourra être échangé
          contre sa valeur en espèces.
        </p>

        <h2>3. Retrait des lots</h2>
        <p>
          [Placeholder — ATL à remplir] Les gagnants devront présenter l’écran de gain sur leur téléphone
          à un superviseur Wave présent sur le point de retrait, pendant la durée de la campagne.
        </p>

        <h2>4. Données personnelles</h2>
        <p>
          [Placeholder — ATL à remplir] Wave collecte uniquement les données strictement nécessaires
          à la lutte contre la fraude (identifiant anonyme, adresse IP hachée, horodatage).
        </p>

        <h2>5. Contact</h2>
        <p>
          [Placeholder — ATL à remplir] Pour toute question relative à la campagne, contactez
          <a href="mailto:support@wave.com"> support@wave.com</a>.
        </p>
      </main>
    </div>
  );
}

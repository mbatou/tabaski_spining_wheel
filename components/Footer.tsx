import Link from "next/link";

export function Footer() {
  return (
    <footer className="footer">
      <span aria-label="Payez avec Wave" style={{ display: "inline-flex", alignItems: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/payez-avec-wave.png" alt="Payez avec Wave" width={82} height={28} />
      </span>
      <span>
        <Link href="/conditions">Conditions générales</Link>
      </span>
      <span className="meta">
        10 — 25 mai 2026
        <br />
        Campagne Tabaski
      </span>
    </footer>
  );
}

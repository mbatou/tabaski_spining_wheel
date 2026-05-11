import Link from "next/link";

export function Footer() {
  return (
    <footer className="footer">
      <span>
        <Link href="/conditions">Conditions générales</Link>
      </span>
      <span className="meta">
        11 — 25 mai 2026
        <br />
        Campagne Tabaski
      </span>
    </footer>
  );
}

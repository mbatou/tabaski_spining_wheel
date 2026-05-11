import type { Metadata, Viewport } from "next";
import { Urbanist, Roboto_Mono } from "next/font/google";
import "./globals.css";

const urbanist = Urbanist({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-urbanist",
  display: "swap",
});

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-roboto-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Wave · Tabaski ndaanaan",
  description: "Tente ta chance de gagner un cadeau Tabaski avec Wave.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1DC8FF",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${urbanist.variable} ${robotoMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}

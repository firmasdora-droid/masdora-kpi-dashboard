import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  title: "Masdora KPI Dashboard",
  description: "Dashboard KPI, To-Do, Leaderboard & Jualan untuk pasukan Masdora",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ms" className={dmSans.variable}>
      <body>{children}</body>
    </html>
  );
}

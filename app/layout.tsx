import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="ms">
      <body>{children}</body>
    </html>
  );
}

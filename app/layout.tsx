import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  title: "Masdora Team Dashboard",
  description:
    "Dashboard To-Do, Jualan, Leaderboard & Laporan CS untuk pasukan Masdora",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ms" className={dmSans.variable}>
      <body>
        <div
          className="pointer-events-none fixed inset-0"
          style={{
            background:
              "radial-gradient(at 100% 0%, rgba(242,97,34,0.12), rgba(0,0,0,0) 55%), radial-gradient(at 0% 100%, rgba(107,128,66,0.1), rgba(0,0,0,0) 55%)",
          }}
        />
        <div className="relative">{children}</div>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VERITAS-024 — Digital Evidence Integrity & Fraud Investigation Workbench",
  description: "AI-Powered Digital Evidence Integrity & Fraud Investigation Platform. AI suggests. A human decides.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${ibmPlexSans.variable} ${ibmPlexMono.variable}`}>
      <body className="bg-desk text-ink font-sans antialiased min-h-screen">
        {/* Persistent Master Header */}
        <header className="border-b border-rule bg-paper px-4 py-2 flex items-center justify-between sticky top-0 z-50">
          <div className="flex items-center space-x-3">
            <span className="font-bold tracking-wider text-sm uppercase">VERITAS-024</span>
            <span className="text-xs text-rule font-mono">/</span>
            <span className="text-xs font-mono font-medium tracking-wide">CASE: RF-2291</span>
          </div>

          {/* Persistent Epistemic Banner */}
          <div className="border border-rule px-3 py-1 bg-desk/50 text-xs font-mono font-medium tracking-wider text-ink uppercase">
            AI suggests. A human decides.
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono text-ink/70">STATUS: OPEN DOCKET</span>
          </div>
        </header>

        <main className="min-h-[calc(100vh-42px)] flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}

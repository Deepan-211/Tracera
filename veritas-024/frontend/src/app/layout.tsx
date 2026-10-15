import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Stepper from "./Stepper";

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
    <html lang="en" className={ibmPlexMono.variable}>
      <body className="bg-desk text-ink font-mono antialiased min-h-screen flex flex-col">
        {/* Persistent Stepper & Epistemic Banner */}
        <Stepper />

        {/* Dynamic Workflow Page Content */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden bg-paper">
          {children}
        </main>
      </body>
    </html>
  );
}

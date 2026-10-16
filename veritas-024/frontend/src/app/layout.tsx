import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "./Sidebar";
import TopNav from "./TopNav";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tracera — Digital Evidence Integrity & Forensic Investigation Workbench",
  description: "AI-Powered Forensic Evidence Platform with strict 2-file cross-document verification and zero synthetic data.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="antialiased min-h-screen text-zinc-900 flex items-center justify-center p-2 sm:p-4 md:p-6 lg:p-8">
        {/* Luxury Glassmorphism Outer Container matching user's reference mockup */}
        <div className="w-full max-w-[1600px] min-h-[92vh] luxury-glass-shell rounded-[36px] p-4 md:p-6 flex flex-col lg:flex-row gap-6 shadow-2xl overflow-hidden">
          {/* Left Floating Sidebar */}
          <Sidebar />

          {/* Right Main Content Pane */}
          <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
            {/* Top Navigation Bar */}
            <TopNav />

            {/* Dynamic Page Content */}
            <main className="flex-1 min-h-0 pt-2">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}

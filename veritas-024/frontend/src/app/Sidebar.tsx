"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getEvidenceList, EvidenceItem } from "./api";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [evidenceCount, setEvidenceCount] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    getEvidenceList()
      .then((items) => {
        if (isMounted) setEvidenceCount(items.length);
      })
      .catch(() => {});

    const handleRefresh = () => {
      getEvidenceList().then((items) => {
        if (isMounted) setEvidenceCount(items.length);
      }).catch(() => {});
    };
    window.addEventListener("veritas:refresh", handleRefresh);
    return () => {
      isMounted = false;
      window.removeEventListener("veritas:refresh", handleRefresh);
    };
  }, [pathname]);

  const navItems = [
    {
      name: "Dashboard",
      path: "/",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
      requiresTwoFiles: false,
    },
    {
      name: "Evidence Docket",
      path: "/upload",
      step: "1",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l3-3m-3 3L9 8m-5 5h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293h3.172a1 1 0 00.707-.293l2.414-2.414a1 1 0 01.707-.293H20" />
        </svg>
      ),
      badge: evidenceCount,
      requiresTwoFiles: false,
    },
    {
      name: "Claim Extraction",
      path: "/extract",
      step: "2",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      requiresTwoFiles: true,
    },
    {
      name: "Entity Graph",
      path: "/match",
      step: "3",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
      ),
      requiresTwoFiles: true,
    },
    {
      name: "Evidence Statement",
      path: "/statement",
      step: "4",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      requiresTwoFiles: true,
    },
    {
      name: "Court Export",
      path: "/export",
      step: "5",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      requiresTwoFiles: true,
    },
  ];

  return (
    <aside className="w-full lg:w-64 shrink-0 bg-white/90 backdrop-blur-md rounded-[28px] p-5 flex flex-col justify-between border border-zinc-200/60 shadow-[0_4px_25px_rgba(0,0,0,0.02)]">
      {/* Top Branding */}
      <div>
        <div className="flex items-center space-x-3 px-2 py-1 mb-8">
          <div className="w-8 h-8 rounded-xl bg-zinc-950 flex items-center justify-center text-white shadow-sm">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-zinc-950 leading-none">
              Tracera
            </h1>
            <span className="text-[10px] font-medium text-zinc-400 tracking-wider uppercase">
              Forensic OS
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            const isLocked = item.requiresTwoFiles && evidenceCount < 2;

            if (isLocked) {
              return (
                <div
                  key={item.path}
                  onClick={() => alert(`At least two (2) evidence files are required. Currently: ${evidenceCount}/2.`)}
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-medium text-zinc-400 hover:bg-zinc-100/60 cursor-not-allowed transition-all"
                  title="Requires at least 2 evidence files"
                >
                  <div className="flex items-center space-x-3">
                    <span className="opacity-50">{item.icon}</span>
                    <span>{item.name}</span>
                  </div>
                  <span className="text-[10px] bg-zinc-100 text-zinc-400 px-1.5 py-0.5 rounded-md font-mono">
                    🔒
                  </span>
                </div>
              );
            }

            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-medium transition-all ${
                  isActive
                    ? "bg-zinc-950 text-white shadow-sm font-semibold"
                    : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/70"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className={isActive ? "text-white" : "text-zinc-500"}>
                    {item.icon}
                  </span>
                  <span>{item.name}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* INTEGRATIONS Section (matching reference image) */}
        <div className="mt-8 pt-6 border-t border-zinc-100">
          <span className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase px-3 block mb-3">
            INTEGRATIONS
          </span>
          <div className="space-y-1">
            <div className="flex items-center justify-between px-3 py-1.5 text-xs text-zinc-600">
              <div className="flex items-center space-x-2.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Gemini 3.1 Flash</span>
              </div>
              <span className="text-[9px] text-zinc-400 font-mono">LLM</span>
            </div>
            <div className="flex items-center justify-between px-3 py-1.5 text-xs text-zinc-600">
              <div className="flex items-center space-x-2.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Supabase DB</span>
              </div>
              <span className="text-[9px] text-zinc-400 font-mono">SQL</span>
            </div>
            <div className="flex items-center justify-between px-3 py-1.5 text-xs text-zinc-600">
              <div className="flex items-center space-x-2.5">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span>SHA-256 Ledger</span>
              </div>
              <span className="text-[9px] text-zinc-400 font-mono">LOCK</span>
            </div>
          </div>
        </div>

        {/* TEAMS Section (matching reference image) */}
        <div className="mt-6 pt-4 border-t border-zinc-100">
          <span className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase px-3 block mb-2.5">
            INVESTIGATION TEAM
          </span>
          <div className="space-y-1">
            <div className="flex items-center space-x-2.5 px-3 py-1 text-xs text-zinc-600">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-950" />
              <span>Lead Forensics</span>
            </div>
            <div className="flex items-center space-x-2.5 px-3 py-1 text-xs text-zinc-600">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
              <span>Legal Admissibility</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="pt-4 border-t border-zinc-100 space-y-3">
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-100 text-[11px] text-zinc-500 font-mono">
          <span>MIN FILES</span>
          <span className={`font-bold ${evidenceCount >= 2 ? "text-emerald-600" : "text-amber-600"}`}>
            {evidenceCount} / 2 {evidenceCount >= 2 ? "✓" : "⚠️"}
          </span>
        </div>

        <div className="flex items-center space-x-2.5 px-3 text-xs text-zinc-500 hover:text-zinc-900 cursor-pointer transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="font-medium">Settings</span>
        </div>
      </div>
    </aside>
  );
}

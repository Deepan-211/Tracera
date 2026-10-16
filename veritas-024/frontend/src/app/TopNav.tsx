"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { triggerAnalyze, getEvidenceList, clearCase, EvidenceItem } from "./api";

export default function TopNav() {
  const router = useRouter();
  const [evidenceCount, setEvidenceCount] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

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
  }, []);

  const handleRunEngine = async () => {
    if (evidenceCount < 2) {
      alert(`At least two (2) evidence files are required to run the AI engine. Currently: ${evidenceCount}/2.`);
      router.push("/upload");
      return;
    }
    setIsProcessing(true);
    try {
      await triggerAnalyze();
      window.dispatchEvent(new CustomEvent("veritas:refresh"));
      router.push("/extract");
    } catch (err: any) {
      alert(`Investigation Engine Error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClear = async () => {
    if (!confirm("Clear current docket and reset investigation?")) return;
    try {
      await clearCase();
      window.dispatchEvent(new CustomEvent("veritas:refresh"));
      router.push("/upload");
    } catch (err: any) {
      alert(`Clear failed: ${err.message}`);
    }
  };

  return (
    <header className="flex items-center justify-between pb-6 border-b border-zinc-200/50">
      {/* Greeting (matching 'Hi, Dilan!' in reference image) */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-zinc-950">
          Hi, Investigator!
        </h2>
        <div className="flex items-center space-x-2 mt-1 text-xs text-zinc-500 font-medium">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Case #TRC-2024</span>
          <span>•</span>
          <span className="font-mono text-[11px] text-zinc-400">
            {evidenceCount} Evidence Item{evidenceCount === 1 ? "" : "s"} in Docket
          </span>
          {evidenceCount < 2 && (
            <span className="text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 text-[10px]">
              ⚠️ Minimum 2 files required
            </span>
          )}
        </div>
      </div>

      {/* Right Action Icons (matching '+ Create', Search, Bell, Profile in reference image) */}
      <div className="flex items-center space-x-3">
        {/* + Run Engine / + Add Evidence Button */}
        <button
          onClick={handleRunEngine}
          disabled={isProcessing}
          className={`flex items-center space-x-2 px-5 py-2.5 rounded-full text-xs font-semibold transition-all shadow-sm ${
            evidenceCount >= 2
              ? "bg-zinc-950 text-white hover:bg-black active:scale-95"
              : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200 cursor-pointer"
          }`}
          title={evidenceCount < 2 ? "Upload at least 2 files to run" : "Run Gemini AI Investigation Pipeline"}
        >
          <span className="text-sm leading-none">+</span>
          <span>{isProcessing ? "Analyzing..." : "Run Engine"}</span>
        </button>

        {/* Clear docket button if items exist */}
        {evidenceCount > 0 && (
          <button
            onClick={handleClear}
            className="px-3.5 py-2 rounded-full text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200/60 transition-colors"
            title="Reset docket"
          >
            Clear Docket
          </button>
        )}

        {/* Search Circular Button */}
        <button
          onClick={() => alert("Search docket index: all claims, entities, dates, and amounts are indexed.")}
          className="w-10 h-10 rounded-full bg-white border border-zinc-200/70 flex items-center justify-center text-zinc-600 hover:text-zinc-950 hover:bg-zinc-50 transition-colors shadow-sm"
          title="Search Evidence"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>

        {/* Notification Bell Circular Button */}
        <button
          onClick={() => alert(evidenceCount < 2 ? "Alert: Docket has fewer than 2 files. Upload at least 2 files to enable AI matching." : "Docket ready for full cross-document analysis.")}
          className="w-10 h-10 rounded-full bg-white border border-zinc-200/70 flex items-center justify-center text-zinc-600 hover:text-zinc-950 hover:bg-zinc-50 transition-colors shadow-sm relative"
          title="Notifications"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {evidenceCount < 2 && (
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 absolute top-2 right-2 ring-2 ring-white" />
          )}
        </button>

        {/* Investigator Avatar Pill */}
        <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white text-xs font-bold shadow-sm select-none">
          INV
        </div>
      </div>
    </header>
  );
}

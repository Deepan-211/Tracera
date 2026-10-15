"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  getHealth,
  getEvidenceList,
  triggerAnalyze,
  resetSeedCase,
  clearCase,
  EvidenceItem,
} from "./api";

const STEPS = [
  { path: "/upload", number: "1", title: "UPLOAD", desc: "Raw Vault & Hashes" },
  { path: "/extract", number: "2", title: "EXTRACT", desc: "OCR & Claim Log" },
  { path: "/match", number: "3", title: "MATCH", desc: "Visual Graph & Contradictions" },
  { path: "/statement", number: "4", title: "STATEMENT", desc: "Incident Narrative" },
  { path: "/export", number: "5", title: "EXPORT", desc: "Dossier & Audit Chain" },
];

export default function Stepper() {
  const pathname = usePathname();
  const router = useRouter();
  const [evidenceCount, setEvidenceCount] = useState<number>(0);
  const [backendHealth, setBackendHealth] = useState<string>("connecting...");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      getHealth().catch(() => ({ status: "offline" })),
      getEvidenceList().catch(() => []),
    ]).then(([health, items]) => {
      if (!isMounted) return;
      setBackendHealth(health.status);
      setEvidenceCount((items as EvidenceItem[]).length);
    });
    return () => {
      isMounted = false;
    };
  }, [pathname]);

  const handleRunInvestigation = async () => {
    setIsProcessing(true);
    try {
      await triggerAnalyze();
      window.dispatchEvent(new CustomEvent("veritas:refresh"));
    } catch (err: any) {
      alert(`Investigation Engine error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLoadDemo = async () => {
    setIsProcessing(true);
    try {
      await resetSeedCase();
      await triggerAnalyze();
      window.dispatchEvent(new CustomEvent("veritas:refresh"));
      router.refresh();
    } catch (err: any) {
      alert(`Demo reset failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearDocket = async () => {
    if (!confirm("Clear all items from current docket?")) return;
    setIsProcessing(true);
    try {
      await clearCase();
      window.dispatchEvent(new CustomEvent("veritas:refresh"));
      router.push("/upload");
    } catch (err: any) {
      alert(`Failed to clear: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="border-b border-rule bg-paper font-mono select-none">
      {/* Top Banner Bar */}
      <div className="border-b border-rule bg-desk px-4 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-3">
          <Link href="/upload" className="font-bold text-sm tracking-widest text-ink hover:opacity-80">
            VERITAS-024
          </Link>
          <span className="text-rule">|</span>
          <span className="text-xs text-ink/70">CASE: RF-2291</span>
          <span className="text-rule">|</span>
          <span className="text-[11px] text-ink/60">
            {evidenceCount} DOCKET ITEM{evidenceCount === 1 ? "" : "S"}
          </span>
        </div>

        {/* Central Prominent Epistemic Banner */}
        <div className="border-2 border-ink px-4 py-1 bg-paper text-xs font-bold tracking-widest uppercase text-ink shadow-[2px_2px_0px_0px_rgba(0,0,0,0.15)]">
          &quot;AI suggests. A human decides.&quot;
        </div>

        {/* System & Global Actions */}
        <div className="flex items-center space-x-2 text-xs">
          <span
            className={`px-2 py-0.5 border text-[10px] font-bold ${
              backendHealth === "ok"
                ? "border-fact text-fact bg-white"
                : "border-stamp text-stamp bg-white"
            }`}
          >
            SYS: {backendHealth.toUpperCase()}
          </span>
          <button
            onClick={handleRunInvestigation}
            disabled={isProcessing}
            title="Extract unparsed claims, link entities, build graph, and flag discrepancies"
            className="border border-ink bg-white px-2 py-1 text-[11px] font-bold uppercase hover:bg-desk active:translate-y-px disabled:opacity-50"
          >
            {isProcessing ? "PROCESSING..." : "RUN ENGINE"}
          </button>
          <button
            onClick={handleLoadDemo}
            disabled={isProcessing}
            title="Reset and load canonical RF-2291 demo case"
            className="border border-rule bg-white px-2 py-1 text-[11px] uppercase hover:bg-desk active:translate-y-px disabled:opacity-50"
          >
            DEMO CASE
          </button>
          {evidenceCount > 0 && (
            <button
              onClick={handleClearDocket}
              disabled={isProcessing}
              title="Clear all docket files and evidence"
              className="border border-stamp text-stamp bg-white px-2 py-1 text-[11px] font-bold uppercase hover:bg-desk active:translate-y-px disabled:opacity-50"
            >
              CLEAR
            </button>
          )}
        </div>
      </div>

      {/* 5-Step Guided Workflow Navigation Bar */}
      <nav className="grid grid-cols-5 divide-x divide-rule bg-desk/30">
        {STEPS.map((step, idx) => {
          const isActive = pathname === step.path || (step.path === "/upload" && pathname === "/");
          return (
            <Link
              key={step.path}
              href={step.path}
              className={`p-2.5 transition-all flex flex-col justify-between group ${
                isActive
                  ? "bg-paper border-b-2 border-b-ink shadow-[inset_0_-2px_0_0_#1B1B18]"
                  : "hover:bg-desk/60 text-ink/70"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 border ${
                    isActive
                      ? "bg-ink text-paper border-ink"
                      : "bg-desk text-ink/70 border-rule group-hover:border-ink"
                  }`}
                >
                  STEP {step.number}
                </span>
                {isActive && (
                  <span className="stamp-badge !text-[9px] !px-1.5 !py-0">ACTIVE</span>
                )}
              </div>
              <div className="mt-1.5">
                <div
                  className={`text-xs font-bold tracking-wide uppercase ${
                    isActive ? "text-ink" : "text-ink/80 group-hover:text-ink"
                  }`}
                >
                  {step.title}
                </div>
                <div className="text-[10px] text-ink/50 truncate mt-0.5">
                  {step.desc}
                </div>
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

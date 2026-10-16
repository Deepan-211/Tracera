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
  { path: "/upload", number: 1, label: "Step 1", title: "IMPORT EVIDENCE", desc: "Raw Vault & Hashes" },
  { path: "/extract", number: 2, label: "Step 2", title: "EXTRACT CLAIMS", desc: "OCR & Claim Log" },
  { path: "/match", number: 3, label: "Step 3", title: "MATCH & GRAPH", desc: "Visual Graph & Contradictions" },
  { path: "/statement", number: 4, label: "Step 4", title: "STATEMENT", desc: "Incident Narrative" },
  { path: "/export", number: 5, label: "Step 5", title: "EXPORT DOCKET", desc: "Dossier & Audit Chain" },
];

export default function Stepper() {
  const pathname = usePathname();
  const router = useRouter();
  const [evidenceCount, setEvidenceCount] = useState<number>(0);
  const [backendHealth, setBackendHealth] = useState<string>("connecting...");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Determine current active step number
  const currentStep = STEPS.find(
    (s) => s.path === pathname || (s.path === "/upload" && pathname === "/")
  ) || STEPS[0];

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
    <header className="border-b-2 border-ink bg-paper font-mono select-none">
      {/* ------------------------------------------------------------- */}
      {/* Top Banner Bar: Brand, Case, Epistemic Slogan, System Actions */}
      {/* ------------------------------------------------------------- */}
      <div className="border-b border-rule bg-desk px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center space-x-3">
          <Link href="/upload" className="font-bold text-sm tracking-widest text-ink hover:opacity-80">
            VERITAS-024
          </Link>
          <span className="text-rule">|</span>
          <span className="text-ink/70 font-semibold">CASE: ACTIVE INVESTIGATION</span>
          <span className="text-rule">|</span>
          <span className="text-[11px] text-ink/60">
            {evidenceCount} DOCKET ITEM{evidenceCount === 1 ? "" : "S"}
          </span>
        </div>

        {/* Central Epistemic Motto */}
        <div className="border border-ink px-3 py-0.5 bg-paper text-[11px] font-bold tracking-widest uppercase text-ink shadow-[1px_1px_0px_0px_rgba(0,0,0,0.15)]">
          &quot;AI suggests. A human decides.&quot;
        </div>

        {/* System & Global Actions */}
        <div className="flex items-center space-x-2">
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
            disabled={isProcessing || evidenceCount < 2}
            title={evidenceCount < 2 ? "At least 2 files required to run investigation engine" : "Extract unparsed claims, link entities, build graph, and flag discrepancies"}
            className="border border-ink bg-white px-2 py-1 text-[11px] font-bold uppercase hover:bg-desk active:translate-y-px disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isProcessing ? "PROCESSING..." : "RUN ENGINE"}
          </button>
          {evidenceCount > 0 && (
            <button
              onClick={handleClearDocket}
              disabled={isProcessing}
              title="Clear all docket files and evidence"
              className="border border-stamp text-stamp bg-white px-2 py-1 text-[11px] font-bold uppercase hover:bg-desk active:translate-y-px disabled:opacity-50"
            >
              CLEAR DOCKET
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* UNIFIED HORIZONTAL CONNECTED STEPPER (FROM USER SKETCH)       */}
      {/* Step 1 ---------- Step 2 ---------- Step 3 ---------- Step 4 ---------- Step 5 */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white px-4 sm:px-8 py-3.5 border-b border-rule">
        <div className="max-w-6xl mx-auto">
          {/* Header row with step status */}
          <div className="flex items-center justify-between text-[11px] font-bold tracking-wider uppercase mb-3">
            <span className="text-ink flex items-center space-x-1.5">
              <span className="inline-block w-2 h-2 bg-ink" />
              <span>INVESTIGATION WORKFLOW PROGRESS</span>
            </span>
            <span className="text-ink/60 hidden sm:inline">
              CURRENT: <strong className="text-ink">{currentStep.label.toUpperCase()} — {currentStep.title}</strong>
              {evidenceCount < 2 && (
                <span className="text-stamp font-bold ml-2">
                  (⚠️ MINIMUM 2 FILES REQUIRED: {evidenceCount}/2)
                </span>
              )}
            </span>
          </div>

          {/* Stepper track & nodes */}
          <div className="relative flex items-center justify-between px-2 sm:px-6 py-2">
            {/* Connecting baseline */}
            <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-[2px] bg-rule z-0" />

            {STEPS.map((step) => {
              const isActive = step.number === currentStep.number;
              const isPast = step.number < currentStep.number || (step.number === 1 && evidenceCount >= 2 && currentStep.number > 1);
              const isLocked = step.number > 1 && evidenceCount < 2;

              return (
                <Link
                  key={step.path}
                  href={isLocked ? "/upload" : step.path}
                  onClick={(e) => {
                    if (isLocked) {
                      e.preventDefault();
                      alert("⚠️ At least two (2) evidence files are required to proceed with cross-document investigation. Please upload another artifact.");
                      router.push("/upload");
                    }
                  }}
                  className={`relative z-10 flex flex-col items-center group ${
                    isLocked ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                  }`}
                  title={
                    isLocked
                      ? "⚠️ At least 2 files required to access this step"
                      : `${step.label}: ${step.title} (${step.desc})`
                  }
                >
                  {/* Step Number Box */}
                  <div
                    className={`w-9 h-9 sm:w-11 sm:h-11 flex items-center justify-center font-bold text-xs sm:text-sm border-2 transition-all ${
                      isActive
                        ? "bg-ink text-paper border-ink scale-110 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.25)]"
                        : isLocked
                        ? "bg-desk text-ink/40 border-rule"
                        : isPast
                        ? "bg-fact text-white border-fact"
                        : "bg-paper text-ink/60 border-rule hover:border-ink hover:text-ink"
                    }`}
                  >
                    {isLocked ? "🔒" : isPast && !isActive ? "✓" : step.number}
                  </div>

                  {/* Step Title & Subtitle */}
                  <div className="text-center mt-1.5">
                    <div
                      className={`text-[11px] font-bold uppercase tracking-tight transition-colors ${
                        isActive
                          ? "text-ink underline decoration-2 underline-offset-2"
                          : isLocked
                          ? "text-ink/40"
                          : "text-ink/60 group-hover:text-ink"
                      }`}
                    >
                      {step.label}
                    </div>
                    <div className="hidden sm:block text-[9px] text-ink/50 uppercase truncate max-w-[120px]">
                      {isLocked ? "LOCKED (MIN 2)" : step.title}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
}

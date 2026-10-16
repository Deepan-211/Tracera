"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  StatementData,
  getStatement,
  API_URL,
} from "../api";

export default function StatementPage() {
  const [statementData, setStatementData] = useState<StatementData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"cause_effect" | "verified_facts" | "ai_inferences">("cause_effect");

  const fetchStatement = useCallback(async () => {
    try {
      const data = await getStatement();
      setStatementData(data);
    } catch (err) {
      console.error("Failed to load statement:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatement();
    const handleRefresh = () => fetchStatement();
    window.addEventListener("veritas:refresh", handleRefresh);
    return () => window.removeEventListener("veritas:refresh", handleRefresh);
  }, [fetchStatement]);

  return (
    <div className="space-y-6 pt-4">
      {/* Step Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
        <div>
          <div className="flex items-center space-x-2">
            <span className="bg-zinc-950 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
              Step 4 of 5
            </span>
            <h1 className="text-xl font-bold tracking-tight text-zinc-950">
              Incident Narrative &amp; Cause-and-Effect
            </h1>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Step-by-step incident narrative explaining cause and effect. Every sentence cites source file and location.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Link
            href="/match"
            className="px-4 py-2 text-xs font-semibold text-zinc-700 bg-white border border-zinc-200/80 rounded-full hover:bg-zinc-50 shadow-sm transition-all"
          >
            &larr; Step 3: Graph
          </Link>
          {statementData && !statementData.insufficient_evidence ? (
            <Link
              href="/export"
              className="bg-zinc-950 text-white px-5 py-2 text-xs font-semibold rounded-full hover:bg-black active:scale-95 shadow-sm transition-all flex items-center space-x-1.5"
            >
              <span>Next: Export Dossier</span>
              <span>&rarr;</span>
            </Link>
          ) : (
            <button
              disabled
              className="bg-zinc-100 text-zinc-400 px-5 py-2 text-xs font-semibold rounded-full cursor-not-allowed"
              title="At least 2 files required"
            >
              🔒 Next: Export (Min 2)
            </button>
          )}
        </div>
      </div>

      {/* Modern Tabs Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-zinc-200/60 text-xs">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveTab("cause_effect")}
            className={`px-4 py-2 rounded-full font-semibold text-xs transition-all ${
              activeTab === "cause_effect"
                ? "bg-zinc-950 text-white shadow-sm"
                : "bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50"
            }`}
          >
            Cause &amp; Effect ({statementData?.steps?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("verified_facts")}
            className={`px-4 py-2 rounded-full font-semibold text-xs transition-all ${
              activeTab === "verified_facts"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50"
            }`}
          >
            Verified Facts ({statementData?.verified_facts?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("ai_inferences")}
            className={`px-4 py-2 rounded-full font-semibold text-xs transition-all ${
              activeTab === "ai_inferences"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50"
            }`}
          >
            AI Inferences ({statementData?.ai_inferences?.length || 0})
          </button>
        </div>

        <div className="flex items-center space-x-2 text-[11px] text-zinc-400">
          <span className="label-verified-fact !text-[10px]">Fact: Deterministic</span>
          <span className="label-ai-inference !text-[10px]">Inference: Probabilistic</span>
        </div>
      </div>

      {/* Narrative Body Canvas */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {isLoading ? (
            <div className="p-12 text-center text-xs text-ink/50 border border-rule bg-white">
              SYNTHESIZING CAUSE-AND-EFFECT INCIDENT NARRATIVE...
            </div>
          ) : !statementData || statementData.insufficient_evidence || statementData.steps?.length === 0 ? (
            <div className="max-w-xl mx-auto my-12 p-8 border-2 border-dashed border-stamp bg-white text-center space-y-4 shadow-[4px_4px_0px_0px_#1B1B18]">
              <div className="text-4xl">⚠️</div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-stamp">
                INSUFFICIENT EVIDENCE (AT LEAST 2 FILES REQUIRED)
              </h2>
              <p className="text-xs text-ink/80 leading-relaxed">
                Incident narrative and cross-document cause-and-effect synthesis require <strong>at least two (2) evidence files</strong>.
                {statementData?.evidence_count !== undefined && (
                  <span> Currently {statementData.evidence_count} of 2 required files in docket.</span>
                )}
              </p>
              <div className="border border-rule bg-desk/50 p-2 text-xs font-mono">
                Status: <strong>At least 2 evidence artifacts required to proceed</strong>
              </div>
              <div className="pt-2">
                <Link
                  href="/upload"
                  className="border-2 border-ink bg-ink text-paper px-6 py-2.5 text-xs font-bold uppercase hover:bg-ink/90 active:translate-y-px inline-block shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)]"
                >
                  &larr; RETURN TO STEP 1 &amp; UPLOAD FILES
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* Tab 1: Step-by-Step Cause and Effect */}
              {activeTab === "cause_effect" && (
                <div className="space-y-5">
                  <div className="border border-rule bg-desk/20 p-3 text-xs flex items-center justify-between">
                    <span className="font-bold uppercase tracking-wider">
                      CHRONOLOGICAL INCIDENT SEQUENCE &amp; CAUSAL PROGRESSION
                    </span>
                    <span className="stamp-badge !text-[9px]">EVIDENCE TRACED</span>
                  </div>

                  {statementData.steps.map((step) => (
                    <div
                      key={step.step_number}
                      className="paper-sheet p-5 border-2 border-rule bg-white space-y-3 relative shadow-[2px_2px_0px_0px_rgba(0,0,0,0.06)]"
                    >
                      {/* Step Header */}
                      <div className="flex items-start justify-between border-b border-rule pb-2 gap-2">
                        <div className="flex items-center space-x-2">
                          <span className="bg-ink text-paper text-xs font-bold px-2 py-0.5">
                            STEP {step.step_number}
                          </span>
                          <h2 className="text-sm font-bold uppercase tracking-wide text-ink">
                            {step.title}
                          </h2>
                        </div>
                        <span className="text-[10px] text-ink/50 uppercase">
                          {step.sentences.length} CITED SENTENCE{step.sentences.length === 1 ? "" : "S"}
                        </span>
                      </div>

                      <p className="text-xs text-ink/70 italic border-l-2 border-rule pl-2">
                        {step.description}
                      </p>

                      {/* Sentences with Strict Citations */}
                      <div className="space-y-3 pt-1">
                        {step.sentences.map((s, idx) => {
                          const isFact = s.type === "verified_fact";
                          return (
                            <div
                              key={idx}
                              className={`p-3 border text-xs leading-relaxed space-y-1.5 transition-colors ${
                                isFact
                                  ? "border-fact/40 bg-fact/5"
                                  : "border-inference/40 bg-desk/30 border-dashed"
                              }`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-1 text-[10px]">
                                {isFact ? (
                                  <span className="label-verified-fact !text-[9px]">
                                    VERIFIED FACT
                                  </span>
                                ) : (
                                  <span className="label-ai-inference !text-[9px]">
                                    AI INFERENCE (CONFIDENCE: {(s.confidence ? s.confidence * 100 : 85).toFixed(0)}%)
                                  </span>
                                )}

                                {/* Sentence Citation */}
                                <div className="flex items-center space-x-1 text-ink/80 font-bold">
                                  <span>SOURCE:</span>
                                  <span className="border border-rule bg-white px-1.5 py-0.2 select-all">
                                    {s.citation}
                                  </span>
                                </div>
                              </div>

                              <p className="text-xs font-medium text-ink select-text">
                                {s.sentence}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab 2: Verified Facts (Deterministic) */}
              {activeTab === "verified_facts" && (
                <div className="space-y-4">
                  <div className="border border-fact bg-fact/10 p-3 text-xs space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="label-verified-fact">100% DETERMINISTIC</span>
                      <strong className="text-xs uppercase text-fact">VERIFIED FACTUAL RECORDS</strong>
                    </div>
                    <p className="text-[11px] text-ink/70">
                      These statements are derived strictly from cryptographic hashes, raw byte headers,
                      and exact string extractions. They contain zero probabilistic modeling.
                    </p>
                  </div>

                  <div className="border border-rule bg-white divide-y divide-rule">
                    {statementData.verified_facts.map((item, idx) => (
                      <div key={idx} className="p-3 hover:bg-desk/20 transition-colors text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="label-verified-fact !text-[9px]">VERIFIED FACT</span>
                          <span className="text-[10px] text-ink/60 border border-rule px-1.5 py-0.2 bg-desk">
                            CITE: {item.citation}
                          </span>
                        </div>
                        <p className="font-semibold text-ink select-text">{item.fact}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 3: AI Inferences (Probabilistic) */}
              {activeTab === "ai_inferences" && (
                <div className="space-y-4">
                  <div className="border border-inference bg-desk/40 p-3 text-xs space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="label-ai-inference">PROBABILISTIC / UNVERIFIED</span>
                      <strong className="text-xs uppercase text-inference">AI SYNTHESIS &amp; ANOMALY INFERENCES</strong>
                    </div>
                    <p className="text-[11px] text-ink/70">
                      Generated through forensic algorithms, cross-document correlation, and statistical analysis.
                      Every inference includes an explicit confidence score and requires human investigator adjudication.
                    </p>
                  </div>

                  <div className="border border-rule bg-white divide-y divide-rule">
                    {statementData.ai_inferences.map((item, idx) => (
                      <div key={idx} className="p-3 hover:bg-desk/20 transition-colors text-xs space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-1">
                          <div className="flex items-center space-x-1.5">
                            <span className="label-ai-inference !text-[9px]">
                              CONFIDENCE: {(item.confidence * 100).toFixed(0)}%
                            </span>
                            <span className="text-[10px] text-ink/60 italic">
                              Basis: {item.confidence_reason}
                            </span>
                          </div>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 border uppercase font-bold ${
                              item.review_status === "accepted"
                                ? "border-fact text-fact"
                                : item.review_status === "rejected"
                                ? "border-stamp text-stamp"
                                : "border-rule text-ink/60"
                            }`}
                          >
                            STATUS: {item.review_status}
                          </span>
                        </div>

                        <p className="font-medium text-ink italic select-text">
                          &quot;{item.inference}&quot;
                        </p>

                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-ink/60 pt-1 border-t border-rule/50">
                          <span className="font-bold text-ink">CITATIONS:</span>
                          {item.citations.map((cite, cIdx) => (
                            <span key={cIdx} className="border border-rule bg-paper px-1.5 py-0.2">
                              {cite}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Mandatory Epistemic Banner Footer */}
          <div className="border-2 border-stamp bg-paper p-4 text-center space-y-1 shadow-sm">
            <div className="flex items-center justify-center space-x-2">
              <span className="stamp-badge !text-[11px] !border-stamp !text-stamp">
                EPISTEMIC DISCLAIMER
              </span>
            </div>
            <p className="text-sm font-bold tracking-wider text-stamp uppercase mt-1">
              &quot;AI-generated. Not proof. Requires human review.&quot;
            </p>
            <p className="text-[11px] text-ink/60">
              The platform never declares guilt, authenticity, or fraud. All findings, causal linkages, and narrative reconstructions
              serve solely as suggestive leads for independent human investigator decision-making.
            </p>
          </div>
        </div>
      </div>

      {/* Step Footer Navigation */}
      <div className="border-t border-rule p-3 bg-paper shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs">
          <Link
            href="/match"
            className="border border-rule bg-white px-3 py-1.5 hover:bg-desk"
          >
            &larr; STEP 3: MATCH
          </Link>
          {statementData && !statementData.insufficient_evidence ? (
            <Link
              href="/export"
              className="border-2 border-ink bg-paper px-4 py-2 font-bold uppercase hover:bg-desk active:translate-y-px flex items-center space-x-2 shadow-[2px_2px_0px_0px_#1B1B18]"
            >
              <span>PROCEED TO STEP 5: EXPORT &amp; AUDIT</span>
              <span>&rarr;</span>
            </Link>
          ) : (
            <button
              disabled
              className="border-2 border-rule bg-desk text-ink/40 px-4 py-2 font-bold uppercase cursor-not-allowed"
              title="At least two evidence files required"
            >
              🔒 PROCEED TO STEP 5 (MINIMUM 2 FILES REQUIRED)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

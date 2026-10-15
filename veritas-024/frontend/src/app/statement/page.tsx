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
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-paper font-mono text-ink">
      {/* Step Header */}
      <div className="border-b border-rule p-4 bg-paper shrink-0">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="bg-ink text-paper text-xs font-bold px-2 py-0.5">
                STEP 4 OF 5
              </span>
              <h1 className="text-base font-bold tracking-wider uppercase">
                INCIDENT NARRATIVE &amp; CAUSE-AND-EFFECT SYNTHESIS
              </h1>
            </div>
            <p className="text-xs text-ink/70 mt-0.5">
              Step-by-step incident narrative explaining cause and effect. Every sentence cites source file and location.
              Verified facts are strictly segregated from AI inferences with explicit confidence scores.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Link
              href="/match"
              className="border border-rule bg-white px-3 py-1.5 text-xs hover:bg-desk"
            >
              &larr; BACK: MATCH
            </Link>
            <Link
              href="/export"
              className="border border-ink bg-white px-3 py-1.5 text-xs font-bold uppercase hover:bg-desk active:translate-y-px flex items-center space-x-1"
            >
              <span>NEXT: EXPORT DOSSIER</span>
              <span>&rarr;</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs / Filter Bar */}
      <div className="border-b border-rule bg-desk/40 px-4 py-2 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveTab("cause_effect")}
              className={`px-3 py-1 border transition-colors uppercase font-bold text-xs ${
                activeTab === "cause_effect"
                  ? "bg-paper border-ink text-ink shadow-[1px_1px_0_0_#1B1B18]"
                  : "bg-white/60 border-rule text-ink/70 hover:bg-white"
              }`}
            >
              1. CAUSE &amp; EFFECT STEPS ({statementData?.steps?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab("verified_facts")}
              className={`px-3 py-1 border transition-colors uppercase font-bold text-xs ${
                activeTab === "verified_facts"
                  ? "bg-paper border-fact text-fact shadow-[1px_1px_0_0_var(--fact)]"
                  : "bg-white/60 border-rule text-ink/70 hover:bg-white"
              }`}
            >
              2. VERIFIED FACTS ({statementData?.verified_facts?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab("ai_inferences")}
              className={`px-3 py-1 border transition-colors uppercase font-bold text-xs ${
                activeTab === "ai_inferences"
                  ? "bg-paper border-inference text-inference shadow-[1px_1px_0_0_var(--inference)]"
                  : "bg-white/60 border-rule text-ink/70 hover:bg-white"
              }`}
            >
              3. AI INFERENCES ({statementData?.ai_inferences?.length || 0})
            </button>
          </div>

          <div className="flex items-center space-x-2 text-[11px] text-ink/60">
            <span>EPISTEMIC SPLIT:</span>
            <span className="label-verified-fact !text-[10px]">FACT: 100% DETERMINISTIC</span>
            <span className="label-ai-inference !text-[10px]">INFERENCE: PROBABILISTIC</span>
          </div>
        </div>
      </div>

      {/* Narrative Body Canvas */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {isLoading ? (
            <div className="p-12 text-center text-xs text-ink/50 border border-rule bg-white">
              SYNTHESIZING CAUSE-AND-EFFECT INCIDENT NARRATIVE...
            </div>
          ) : !statementData || statementData.steps?.length === 0 ? (
            <div className="p-12 text-center text-xs text-ink/50 border border-rule bg-white space-y-2">
              <p>NO EVIDENCE ARTIFACTS AVAILABLE TO GENERATE INCIDENT STATEMENT.</p>
              <p className="text-[11px] text-ink/40">
                Please upload files in Step 1 or click &quot;DEMO CASE&quot; in the header to load the canonical RF-2291 investigation.
              </p>
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
          <Link
            href="/export"
            className="border-2 border-ink bg-paper px-4 py-2 font-bold uppercase hover:bg-desk active:translate-y-px flex items-center space-x-2 shadow-[2px_2px_0px_0px_#1B1B18]"
          >
            <span>PROCEED TO STEP 5: EXPORT &amp; AUDIT</span>
            <span>&rarr;</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

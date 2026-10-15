"use client";

import React, { useState } from "react";
import { Contradiction, AuditEntry, verifyAuditChain } from "./api";

interface AuditPaneProps {
  contradictions: Contradiction[];
  auditChain: AuditEntry[];
  onReviewContradiction: (
    id: number,
    decision: "accepted" | "rejected" | "needs_more_info",
    note?: string
  ) => Promise<void>;
  onRefreshAudit: () => Promise<void>;
}

export default function AuditPane({
  contradictions,
  auditChain,
  onReviewContradiction,
  onRefreshAudit,
}: AuditPaneProps) {
  const [activeTab, setActiveTab] = useState<"contradictions" | "audit">("contradictions");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    valid: boolean;
    entries_checked?: number;
    broken_id?: number;
    reason?: string;
    message?: string;
  } | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});

  const handleVerifyChain = async () => {
    try {
      const res = await verifyAuditChain();
      setVerificationResult(res);
      await onRefreshAudit();
    } catch (err: any) {
      setVerificationResult({
        valid: false,
        reason: err.message || "Failed to communicate with audit verifier",
      });
    }
  };

  return (
    <div
      className={`border-t-2 border-rule bg-paper transition-all flex flex-col ${
        isCollapsed ? "h-10" : "h-72"
      }`}
    >
      {/* Drawer Header Tabs & Toggle */}
      <div className="flex items-center justify-between border-b border-rule bg-desk px-4 py-1.5 select-none">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setActiveTab("contradictions");
              setIsCollapsed(false);
            }}
            className={`folder-tab !py-1 text-xs ${
              activeTab === "contradictions" && !isCollapsed ? "active font-bold" : ""
            }`}
          >
            DISCREPANCIES &amp; CONTRADICTIONS ({contradictions.length})
          </button>
          <button
            onClick={() => {
              setActiveTab("audit");
              setIsCollapsed(false);
            }}
            className={`folder-tab !py-1 text-xs ${
              activeTab === "audit" && !isCollapsed ? "active font-bold" : ""
            }`}
          >
            AUDIT CHAIN LEDGER ({auditChain.length})
          </button>
        </div>

        <div className="flex items-center space-x-3 text-xs font-mono">
          {activeTab === "audit" && !isCollapsed && (
            <button
              onClick={handleVerifyChain}
              className="border border-ink bg-white px-2 py-0.5 hover:bg-desk font-semibold uppercase text-[11px]"
            >
              VERIFY AUDIT CHAIN
            </button>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="border border-rule px-2 py-0.5 bg-paper hover:bg-desk text-[11px]"
          >
            {isCollapsed ? "EXPAND DRAWER ▲" : "COLLAPSE ▼"}
          </button>
        </div>
      </div>

      {/* Drawer Content Body */}
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto p-4 bg-paper">
          {activeTab === "contradictions" ? (
            <div className="space-y-3">
              {contradictions.length === 0 ? (
                <div className="p-6 text-center text-xs font-mono text-ink/50 border border-rule bg-white">
                  NO CROSS-DOCUMENT CONTRADICTIONS IDENTIFIED.
                  <br />
                  RUN INVESTIGATION ENGINE OR SEED DEMO CASE TO EVALUATE RULES.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {contradictions.map((c) => {
                    return (
                      <div
                        key={c.id}
                        className="paper-sheet p-3 border border-rule flex flex-col justify-between"
                      >
                        <div>
                          {/* Card Header */}
                          <div className="flex items-start justify-between gap-2 border-b border-rule pb-1.5 mb-2">
                            <div className="flex items-center space-x-2">
                              <span className="stamp-badge">
                                {c.kind.replace("_", " ")}
                              </span>
                              <span className="text-[10px] font-mono text-ink/70 uppercase">
                                [{c.severity}]
                              </span>
                            </div>
                            <div className="text-right font-mono text-[11px]">
                              <span className="font-bold">{(c.confidence * 100).toFixed(0)}%</span>
                              <span className="text-[10px] text-ink/60 block">
                                {c.confidence_reason}
                              </span>
                            </div>
                          </div>

                          {/* Description */}
                          <p className="text-xs font-sans font-semibold text-ink mb-1.5">
                            {c.description}
                          </p>

                          {/* Cited Sources Comparison Box */}
                          <div className="grid grid-cols-2 gap-2 p-2 bg-desk/30 border border-rule my-2 font-mono text-[11px]">
                            <div className="border-r border-rule pr-2">
                              <span className="text-[9px] uppercase font-bold text-ink/60 block">
                                SOURCE A: {c.file_a || "Artifact A"}
                              </span>
                              <div className="text-ink font-sans text-xs mt-0.5 truncate">
                                {c.claim_a?.value || `Claim #${c.claim_a_id}`}
                              </div>
                              <span className="text-[9px] text-ink/50">
                                LOC: {c.claim_a?.location_ref || "N/A"}
                              </span>
                            </div>
                            <div className="pl-1">
                              <span className="text-[9px] uppercase font-bold text-ink/60 block">
                                SOURCE B: {c.file_b || "Artifact B"}
                              </span>
                              <div className="text-ink font-sans text-xs mt-0.5 truncate">
                                {c.claim_b?.value || `Claim #${c.claim_b_id}`}
                              </div>
                              <span className="text-[9px] text-ink/50">
                                LOC: {c.claim_b?.location_ref || "N/A"}
                              </span>
                            </div>
                          </div>

                          {/* AI Narrative (Serif-free IBM Plex Sans Italic) */}
                          <div className="p-2 border border-dashed border-rule bg-white text-xs font-sans italic text-ink/90 leading-relaxed">
                            <span className="font-mono text-[10px] not-italic uppercase font-semibold text-inference mr-1.5">
                              [AI EXPLANATION]:
                            </span>
                            {c.narrative}
                          </div>
                        </div>

                        {/* Human Review Decision Footer */}
                        <div className="mt-3 pt-2 border-t border-rule flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center space-x-1">
                            <span className="text-[10px] font-mono uppercase font-semibold text-ink/70">
                              STATUS:
                            </span>
                            <span
                              className={`text-[10px] font-mono uppercase px-1.5 py-0.5 border ${
                                c.review_status === "accepted"
                                  ? "border-fact text-fact font-bold"
                                  : c.review_status === "rejected"
                                  ? "border-stamp text-stamp font-bold"
                                  : "border-rule text-ink/70"
                              }`}
                            >
                              {c.review_status}
                            </span>
                          </div>

                          <div className="flex items-center space-x-1.5">
                            <button
                              onClick={() => onReviewContradiction(c.id, "accepted", reviewNotes[c.id])}
                              className="px-2 py-0.5 text-[10px] font-mono font-semibold border border-fact hover:bg-fact hover:text-white uppercase"
                            >
                              ACCEPT
                            </button>
                            <button
                              onClick={() => onReviewContradiction(c.id, "rejected", reviewNotes[c.id])}
                              className="px-2 py-0.5 text-[10px] font-mono font-semibold border border-stamp hover:bg-stamp hover:text-white uppercase"
                            >
                              REJECT
                            </button>
                            <button
                              onClick={() => onReviewContradiction(c.id, "needs_more_info", reviewNotes[c.id])}
                              className="px-2 py-0.5 text-[10px] font-mono font-semibold border border-rule hover:bg-desk uppercase"
                            >
                              NEEDS INFO
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col h-full font-mono text-xs">
              {/* Verification Outcome Banner */}
              {verificationResult && (
                <div
                  className={`p-2.5 mb-3 border-2 ${
                    verificationResult.valid
                      ? "border-fact bg-white text-fact"
                      : "border-stamp bg-white text-stamp"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold uppercase tracking-wider">
                      {verificationResult.valid ? "CHAIN INTEGRITY VALID" : "CHAIN TAMPER DETECTED"}
                    </span>
                    <span>
                      {verificationResult.entries_checked ?? 0} ENTRIES VERIFIED
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-ink">
                    {verificationResult.message || verificationResult.reason}
                  </div>
                </div>
              )}

              {/* Ruled Audit Chain Ledger */}
              <div className="border border-rule bg-white flex-1 overflow-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b border-rule bg-desk/50 text-[10px] uppercase">
                      <th className="p-2 border-r border-rule"># ID</th>
                      <th className="p-2 border-r border-rule">TIMESTAMP (UTC)</th>
                      <th className="p-2 border-r border-rule">ACTOR</th>
                      <th className="p-2 border-r border-rule">ACTION</th>
                      <th className="p-2 border-r border-rule">TARGET</th>
                      <th className="p-2 border-r border-rule">PREV HASH</th>
                      <th className="p-2">ENTRY HASH</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule font-mono">
                    {auditChain.map((entry) => (
                      <tr key={entry.id} className="hover:bg-desk/30">
                        <td className="p-2 border-r border-rule font-bold">{entry.id}</td>
                        <td className="p-2 border-r border-rule">{entry.timestamp_utc}</td>
                        <td className="p-2 border-r border-rule uppercase font-semibold">
                          <span
                            className={
                              entry.actor === "human"
                                ? "text-fact font-bold"
                                : "text-ink/70"
                            }
                          >
                            {entry.actor}
                          </span>
                        </td>
                        <td className="p-2 border-r border-rule">{entry.action}</td>
                        <td className="p-2 border-r border-rule truncate max-w-[120px]">
                          {entry.target}
                        </td>
                        <td className="p-2 border-r border-rule text-[10px] text-ink/60 truncate max-w-[120px]">
                          {entry.prev_hash.substring(0, 12)}...
                        </td>
                        <td className="p-2 text-[10px] font-bold text-ink truncate max-w-[120px]">
                          {entry.entry_hash.substring(0, 12)}...
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { EvidenceItem, ExtractedClaim, TamperFlag, API_URL } from "./api";

interface InspectorPaneProps {
  evidence: EvidenceItem | null;
  claims: ExtractedClaim[];
  tamperFlags: TamperFlag[];
  contentPreview?: string;
  selectedClaimId: number | null;
  onSelectClaim: (id: number) => void;
}

export default function InspectorPane({
  evidence,
  claims,
  tamperFlags,
  contentPreview,
  selectedClaimId,
  onSelectClaim,
}: InspectorPaneProps) {
  const [showEla, setShowEla] = useState(false);

  if (!evidence) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-desk text-ink/60 font-mono text-xs">
        <div className="paper-sheet p-8 text-center max-w-sm">
          <div className="case-section-header">EVIDENCE INSPECTOR</div>
          <p className="mt-2 text-ink/70">
            NO DOCKET ITEM SELECTED.
            <br />
            SELECT AN ITEM FROM THE EVIDENCE VAULT ON THE LEFT TO INSPECT FORENSICS AND EXTRACTED CLAIMS.
          </p>
        </div>
      </div>
    );
  }

  const isImage = ["png", "jpg", "jpeg"].includes(evidence.file_type.toLowerCase());
  const isPdf = evidence.file_type.toLowerCase() === "pdf";
  const isEmail = evidence.file_type.toLowerCase() === "eml";
  const isChat = ["txt", "json"].includes(evidence.file_type.toLowerCase());

  const fileUrl = `${API_URL}/api/evidence/${evidence.id}/file`;
  const elaUrl = `${API_URL}/api/evidence/${evidence.id}/ela`;

  return (
    <div className="h-full flex flex-col bg-desk p-4 overflow-y-auto">
      {/* Evidence Sheet on Desk */}
      <div className="paper-sheet flex-1 flex flex-col min-h-0 p-5 bg-paper">
        {/* Header Metadata Bar */}
        <div className="border-b border-rule pb-3 mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-base font-semibold font-sans tracking-wide text-ink">
                {evidence.filename}
              </span>
              <span className="text-[10px] font-mono uppercase bg-desk px-2 py-0.5 border border-rule">
                {evidence.file_type}
              </span>
            </div>
            <div className="mt-1 font-mono text-[11px] text-ink/70 space-y-0.5">
              <div>
                <span className="font-semibold text-ink">SHA-256: </span>
                <span className="select-all font-mono">{evidence.sha256}</span>
              </div>
              <div>
                <span className="font-semibold text-ink">SIZE: </span>
                <span>{evidence.size_bytes} BYTES</span>
                <span className="mx-2 text-rule">|</span>
                <span className="font-semibold text-ink">INGESTED: </span>
                <span>{evidence.uploaded_at_utc}</span>
              </div>
            </div>
          </div>

          {/* Action / View controls */}
          <div className="flex items-center space-x-2">
            {isImage && (
              <button
                onClick={() => setShowEla(!showEla)}
                className={`border border-ink px-2.5 py-1 text-xs font-mono font-medium uppercase transition-colors ${
                  showEla ? "bg-stamp text-white border-stamp" : "bg-paper text-ink hover:bg-desk"
                }`}
              >
                {showEla ? "VIEW ORIGINAL" : "OVERLAY ELA HEATMAP"}
              </button>
            )}
            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              className="border border-rule px-2.5 py-1 text-xs font-mono font-medium bg-paper hover:bg-desk text-ink uppercase"
            >
              RAW SOURCE
            </a>
          </div>
        </div>

        {/* Tamper Flags Alert Bar */}
        {tamperFlags && tamperFlags.length > 0 && (
          <div className="mb-4 p-2.5 border-2 border-stamp bg-paper flex flex-col gap-1">
            <div className="flex items-center space-x-2">
              <span className="stamp-badge">TAMPER INDICATOR DETECTED</span>
              <span className="text-xs font-mono font-medium text-stamp">
                {tamperFlags.length} STRUCTURAL ANOMAL{tamperFlags.length === 1 ? "Y" : "IES"} FLAGGED
              </span>
            </div>
            {tamperFlags.map((flag, idx) => (
              <div key={idx} className="text-xs font-mono text-ink/90 pl-2 border-l border-stamp mt-1">
                <span className="font-semibold uppercase">{flag.flag_type}: </span>
                <span>{flag.detail}</span>
                {flag.score > 0 && <span className="ml-1 text-ink/60">(score: {flag.score.toFixed(2)})</span>}
              </div>
            ))}
          </div>
        )}

        {/* Content Viewer Sheet */}
        <div className="flex-1 border border-rule bg-white p-4 overflow-auto min-h-[280px] relative">
          {isImage ? (
            <div className="flex flex-col items-center justify-center">
              <img
                src={showEla ? elaUrl : fileUrl}
                alt={evidence.filename}
                className="max-w-full max-h-[460px] object-contain border border-rule"
              />
              <span className="mt-2 text-[10px] font-mono text-ink/60">
                {showEla ? "ERROR LEVEL ANALYSIS (ELA) QUALITY 90 DIFFERENTIAL HEATMAP" : "ORIGINAL INGESTED IMAGE"}
              </span>
            </div>
          ) : (
            <div className="font-mono text-xs text-ink whitespace-pre-wrap leading-relaxed">
              {contentPreview || "Extracting artifact text stream..."}
            </div>
          )}
        </div>

        {/* Extracted Claims Ledger */}
        <div className="mt-4 border-t border-rule pt-3">
          <div className="case-section-header flex items-center justify-between">
            <span>EXTRACTED CLAIMS &amp; OBSERVATIONS ({claims.length})</span>
            <span className="text-[10px] font-mono text-ink/60">CLICK CLAIM TO CITE SOURCE</span>
          </div>

          {claims.length === 0 ? (
            <p className="text-xs font-mono text-ink/50 py-2">
              NO EXTRACTED CLAIMS PROCESSED YET. RUN INVESTIGATION ENGINE.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {claims.map((claim) => {
                const isSelected = claim.id === selectedClaimId;
                let badgeClass = "label-extracted-obs";
                if (claim.label === "VERIFIED_FACT") badgeClass = "label-verified-fact";
                if (claim.label === "AI_INFERENCE") badgeClass = "label-ai-inference";
                if (claim.label === "TAMPER_INDICATOR") badgeClass = "label-tamper-indicator";

                return (
                  <div
                    key={claim.id}
                    onClick={() => onSelectClaim(claim.id)}
                    className={`p-2 border border-rule cursor-pointer text-xs font-mono flex items-center justify-between gap-2 transition-colors ${
                      isSelected ? "bg-desk border-ink" : "bg-paper hover:bg-desk/40"
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <span className={badgeClass}>{claim.label}</span>
                      <span className="font-semibold text-ink/70 uppercase text-[11px]">
                        [{claim.claim_type}]
                      </span>
                      <span className="truncate font-sans font-medium text-ink">{claim.value}</span>
                    </div>

                    <div className="flex items-center space-x-2 text-[10px] text-ink/70 shrink-0">
                      {claim.location_ref && (
                        <span className="border border-rule px-1.5 py-0.5 bg-desk">
                          {claim.location_ref}
                        </span>
                      )}
                      <span>conf: {(claim.confidence * 100).toFixed(0)}%</span>
                      <span className="text-ink/40 uppercase">({claim.method})</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

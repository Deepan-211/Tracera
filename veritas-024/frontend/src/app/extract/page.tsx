"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  EvidenceItem,
  ExtractedClaim,
  TamperFlag,
  getEvidenceList,
  getEvidenceDetail,
  correctClaim,
  triggerAnalyze,
  API_URL,
} from "../api";

export default function ExtractPage() {
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>([]);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<number | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<{
    evidence: EvidenceItem | null;
    claims: ExtractedClaim[];
    tamperFlags: TamperFlag[];
    contentPreview: string;
  }>({
    evidence: null,
    claims: [],
    tamperFlags: [],
    contentPreview: "",
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDetailLoading, setIsDetailLoading] = useState<boolean>(false);
  const [showEla, setShowEla] = useState<boolean>(false);

  // Edit / Correction Modal state
  const [editingClaim, setEditingClaim] = useState<ExtractedClaim | null>(null);
  const [correctedValue, setCorrectedValue] = useState<string>("");
  const [correctionNote, setCorrectionNote] = useState<string>("");
  const [isSavingCorrection, setIsSavingCorrection] = useState<boolean>(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const fetchEvidenceList = useCallback(async () => {
    try {
      const items = await getEvidenceList();
      setEvidenceList(items);
      if (items.length > 0 && selectedEvidenceId === null) {
        setSelectedEvidenceId(items[0].id);
      }
    } catch (err) {
      console.error("Failed to load evidence list:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedEvidenceId]);

  useEffect(() => {
    fetchEvidenceList();
    const handleRefresh = () => fetchEvidenceList();
    window.addEventListener("veritas:refresh", handleRefresh);
    return () => window.removeEventListener("veritas:refresh", handleRefresh);
  }, [fetchEvidenceList]);

  // Load selected evidence details
  const loadDetail = useCallback(async (id: number) => {
    setIsDetailLoading(true);
    setShowEla(false);
    try {
      const res = await getEvidenceDetail(id);
      setSelectedDetail({
        evidence: res.evidence,
        claims: res.claims || [],
        tamperFlags: res.tamper_flags || [],
        contentPreview: res.content_preview || "",
      });
    } catch (err) {
      console.error("Failed to load evidence detail:", err);
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedEvidenceId !== null) {
      loadDetail(selectedEvidenceId);
    }
  }, [selectedEvidenceId, loadDetail]);

  const handleOpenEdit = (claim: ExtractedClaim) => {
    setEditingClaim(claim);
    setCorrectedValue(claim.value);
    setCorrectionNote("");
    setActionSuccessMsg(null);
  };

  const handleSaveCorrection = async () => {
    if (!editingClaim || !correctedValue.trim()) return;
    setIsSavingCorrection(true);
    try {
      const res = await correctClaim(editingClaim.id, correctedValue.trim(), correctionNote.trim() || undefined);
      setActionSuccessMsg(res.message);
      setEditingClaim(null);
      // Reload details to show newly inserted correction record
      if (selectedEvidenceId !== null) {
        await loadDetail(selectedEvidenceId);
      }
      setTimeout(() => setActionSuccessMsg(null), 5000);
    } catch (err: any) {
      alert(`Correction failed: ${err.message}`);
    } finally {
      setIsSavingCorrection(false);
    }
  };

  const isImage = selectedDetail.evidence
    ? ["png", "jpg", "jpeg"].includes(selectedDetail.evidence.file_type.toLowerCase())
    : false;
  const rawFileUrl = selectedDetail.evidence
    ? `${API_URL}/api/evidence/${selectedDetail.evidence.id}/file`
    : "#";
  const elaUrl = selectedDetail.evidence
    ? `${API_URL}/api/evidence/${selectedDetail.evidence.id}/ela`
    : "#";

  return (
    <div className="space-y-6 pt-4">
      {/* Step Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
        <div>
          <div className="flex items-center space-x-2">
            <span className="bg-zinc-950 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
              Step 2 of 5
            </span>
            <h1 className="text-xl font-bold tracking-tight text-zinc-950">
              Claim Extraction &amp; OCR Verification
            </h1>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Multimodal Gemini extraction &amp; OCR observations. Investigators can edit values; all audits are cryptographically recorded.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Link
            href="/upload"
            className="px-4 py-2 text-xs font-semibold text-zinc-700 bg-white border border-zinc-200/80 rounded-full hover:bg-zinc-50 shadow-sm transition-all"
          >
            &larr; Step 1: Upload
          </Link>
          {evidenceList.length >= 2 ? (
            <Link
              href="/match"
              className="bg-zinc-950 text-white px-5 py-2 text-xs font-semibold rounded-full hover:bg-black active:scale-95 shadow-sm transition-all flex items-center space-x-1.5"
            >
              <span>Next: Entity Graph</span>
              <span>&rarr;</span>
            </Link>
          ) : (
            <button
              disabled
              className="bg-zinc-100 text-zinc-400 px-5 py-2 text-xs font-semibold rounded-full cursor-not-allowed"
              title="At least 2 files required"
            >
              🔒 Next: Match (Min 2)
            </button>
          )}
        </div>
      </div>

      {actionSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-xs text-emerald-800 font-semibold flex items-center justify-between">
          <span>✓ {actionSuccessMsg}</span>
          <button onClick={() => setActionSuccessMsg(null)} className="text-zinc-600 text-[11px] underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Content Area or 2-File Blocker */}
      {evidenceList.length < 2 && !isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="max-w-xl w-full bento-card-white rounded-[28px] p-8 text-center space-y-4 shadow-sm border border-amber-200">
            <div className="text-4xl">⚠️</div>
            <h2 className="text-base font-bold uppercase tracking-wider text-amber-800">
              Insufficient Evidence (At least 2 files required)
            </h2>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Tracera is a cross-document forensic verification platform. Investigation and extraction analysis cannot proceed with only <strong>{evidenceList.length} file{evidenceList.length === 1 ? "" : "s"}</strong>.
              At least two (2) evidence files are strictly required to correlate facts and cross-verify claims.
            </p>
            <div className="bg-zinc-50 rounded-xl p-2.5 text-xs font-mono text-zinc-600 border border-zinc-200">
              Current Docket Status: <strong>{evidenceList.length} / 2 files uploaded</strong>
            </div>
            <div className="pt-2">
              <Link
                href="/upload"
                className="bg-zinc-950 text-white px-6 py-2.5 text-xs font-semibold rounded-full hover:bg-black inline-block shadow-sm transition-all"
              >
                &larr; Return to Step 1 &amp; Upload Files
              </Link>
            </div>
          </div>
        </div>
      ) : (
      <div className="flex flex-col md:flex-row min-h-[580px] gap-5">
        {/* Left Column: File Tabs / Selector */}
        <div className="w-full md:w-64 bento-card-white rounded-[28px] p-4 flex flex-col shrink-0 overflow-hidden shadow-sm">
          <div className="pb-3 mb-2 border-b border-zinc-100 flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-950 uppercase tracking-tight">
              Docket Files ({evidenceList.length})
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-rule">
            {evidenceList.length === 0 ? (
              <div className="p-4 text-center text-xs text-ink/50">
                NO EVIDENCE FOUND.
                <br />
                <Link href="/upload" className="underline font-bold mt-1 block">
                  GO TO STEP 1 &rarr;
                </Link>
              </div>
            ) : (
              evidenceList.map((item) => {
                const isSelected = item.id === selectedEvidenceId;
                const flags = item.tamper_flags || [];
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedEvidenceId(item.id)}
                    className={`w-full text-left p-2.5 transition-colors text-xs flex flex-col gap-1 ${
                      isSelected
                        ? "bg-desk font-bold border-l-4 border-l-ink"
                        : "hover:bg-desk/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate text-ink font-semibold">
                        {item.filename}
                      </span>
                      <span className="text-[10px] text-ink/60 uppercase">
                        {item.file_type}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-ink/50">
                      <span># {item.id}</span>
                      <span>{(item.size_bytes / 1024).toFixed(1)} KB</span>
                    </div>
                    {flags.length > 0 && (
                      <span className="stamp-badge !text-[9px] !px-1 mt-0.5 self-start">
                        REVIEW NEEDED ({flags.length})
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Center & Right Pane: File Inspector, OCR/Preview, and Claims Table */}
        <div className="flex-1 flex flex-col min-h-0 bento-card-white rounded-[28px] overflow-hidden shadow-sm">
          {isDetailLoading ? (
            <div className="flex-1 flex items-center justify-center p-8 text-xs text-zinc-400 font-mono">
              Loading artifact data &amp; claims...
            </div>
          ) : !selectedDetail.evidence ? (
            <div className="flex-1 flex items-center justify-center p-8 text-xs text-zinc-400">
              Select an artifact from the left to review extractions.
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-5 space-y-4">
              {/* Artifact Metadata Banner */}
              <div className="bg-zinc-50 rounded-2xl border border-zinc-200/70 p-4 flex flex-wrap items-start justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm text-zinc-950">
                      {selectedDetail.evidence.filename}
                    </span>
                    <span className="bg-zinc-200 text-zinc-800 px-2 py-0.5 rounded-full font-mono text-[10px] uppercase font-bold">
                      {selectedDetail.evidence.file_type}
                    </span>
                    <span className="text-zinc-400 text-[11px] font-mono">
                      ID #{selectedDetail.evidence.id}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-600">
                    <span className="font-semibold text-zinc-900">SHA-256:</span>{" "}
                    <span className="select-all font-mono text-[10px]">{selectedDetail.evidence.sha256}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {isImage && (
                    <button
                      onClick={() => setShowEla(!showEla)}
                      className={`border px-2.5 py-1 text-xs font-bold uppercase transition-colors ${
                        showEla
                          ? "border-stamp bg-stamp text-white"
                          : "border-ink bg-white text-ink hover:bg-desk"
                      }`}
                    >
                      {showEla ? "SHOW ORIGINAL" : "VIEW ELA HEATMAP"}
                    </button>
                  )}
                  <a
                    href={rawFileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="border border-rule bg-white px-2.5 py-1 text-xs uppercase hover:bg-desk"
                  >
                    RAW ASSET &nearr;
                  </a>
                </div>
              </div>

              {/* Tamper Flags Warning if Present */}
              {selectedDetail.tamperFlags.length > 0 && (
                <div className="border-2 border-stamp bg-paper p-3 space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <span className="stamp-badge">REVIEW NEEDED</span>
                    <span className="text-xs font-bold text-stamp uppercase">
                      {selectedDetail.tamperFlags.length} STRUCTURAL ANOMALIES DETECTED
                    </span>
                  </div>
                  <div className="divide-y divide-stamp/30 pt-1 text-xs">
                    {selectedDetail.tamperFlags.map((flag, idx) => (
                      <div key={idx} className="py-1">
                        <strong className="uppercase">{flag.flag_type}:</strong> {flag.detail}
                        {flag.score > 0 && (
                          <span className="ml-1 text-ink/60">(score: {flag.score.toFixed(2)})</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Visual/Text Content Box */}
              <div className="border border-rule bg-desk/10 p-3 space-y-2">
                <div className="flex items-center justify-between border-b border-rule pb-1 text-xs">
                  <span className="font-bold uppercase tracking-wider">
                    {isImage ? "IMAGE / OCR FORENSIC CANVAS" : "EXTRACTED DOCUMENT STREAM"}
                  </span>
                  <span className="text-[10px] text-ink/50">
                    {isImage && showEla ? "ERROR LEVEL ANALYSIS LAYER" : "ISOLATED WORKING COPY"}
                  </span>
                </div>

                {isImage ? (
                  <div className="flex flex-col items-center justify-center p-2 bg-white border border-rule min-h-[220px]">
                    <img
                      src={showEla ? elaUrl : rawFileUrl}
                      alt={selectedDetail.evidence.filename}
                      className="max-h-[320px] max-w-full object-contain border border-rule shadow-sm"
                    />
                    <div className="mt-2 text-[10px] text-ink/60">
                      {showEla
                        ? "ERROR LEVEL ANALYSIS (ELA) QUALITY 90 DIFFERENTIAL RESIDUAL PATTERN"
                        : "IMAGE ARTIFACT RENDERED FROM READ-ONLY VAULT"}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border border-rule p-3 max-h-56 overflow-y-auto text-xs whitespace-pre-wrap leading-relaxed select-text">
                    {selectedDetail.contentPreview || "No raw text stream extracted."}
                  </div>
                )}
              </div>

              {/* Extracted Claims & Observations Ledger */}
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-rule pb-1 text-xs">
                  <div>
                    <span className="font-bold uppercase tracking-wider">
                      EXTRACTED CLAIMS &amp; OBSERVATIONS ({selectedDetail.claims.length})
                    </span>
                  </div>
                  <span className="text-[11px] text-ink/60">
                    CLICK &quot;CORRECT&quot; TO EDIT &amp; LOG AUDITED OVERRIDE
                  </span>
                </div>

                {selectedDetail.claims.length === 0 ? (
                  <div className="p-4 text-center text-xs text-ink/50 border border-rule bg-paper">
                    No claims extracted yet. Use &quot;RUN ENGINE&quot; in header to process all documents.
                  </div>
                ) : (
                  <div className="border border-rule bg-white divide-y divide-rule overflow-hidden">
                    {selectedDetail.claims.map((claim) => {
                      const isHumanCorrection = claim.method === "human_correction";
                      return (
                        <div
                          key={claim.id}
                          className={`p-3 text-xs flex flex-col md:flex-row md:items-center justify-between gap-2 ${
                            isHumanCorrection ? "bg-fact/5 border-l-4 border-l-fact" : "hover:bg-desk/20"
                          }`}
                        >
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              {claim.label === "VERIFIED_FACT" && (
                                <span className="label-verified-fact">VERIFIED FACT</span>
                              )}
                              {claim.label === "EXTRACTED_OBSERVATION" && (
                                <span className="label-extracted-obs">EXTRACTED OBS</span>
                              )}
                              {claim.label === "AI_INFERENCE" && (
                                <span className="label-ai-inference">AI INFERENCE</span>
                              )}
                              {claim.label === "TAMPER_INDICATOR" && (
                                <span className="label-tamper-indicator">TAMPER INDICATOR</span>
                              )}

                              <span className="border border-rule px-1.5 py-0.5 bg-desk text-[10px] font-bold uppercase">
                                {claim.claim_type}
                              </span>

                              {isHumanCorrection && (
                                <span className="stamp-badge !border-fact !text-fact !text-[9px] !px-1">
                                  HUMAN CORRECTION
                                </span>
                              )}

                              <span className="text-[10px] text-ink/50">CLAIM #{claim.id}</span>
                            </div>

                            <div className="text-sm font-bold text-ink truncate select-all">
                              {claim.value}
                            </div>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-ink/60">
                              {claim.location_ref && (
                                <span>
                                  Location: <strong className="text-ink">{claim.location_ref}</strong>
                                </span>
                              )}
                              <span>
                                Confidence: <strong>{(claim.confidence * 100).toFixed(0)}%</strong>
                              </span>
                              <span className="uppercase">
                                Method: <strong>{claim.method}</strong>
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 shrink-0 md:justify-end">
                            <button
                              onClick={() => handleOpenEdit(claim)}
                              className="border border-ink bg-paper px-2.5 py-1 text-xs font-bold uppercase hover:bg-desk active:translate-y-px"
                            >
                              CORRECT / EDIT
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Edit / Correction Modal */}
      {editingClaim && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="paper-sheet bg-paper border-2 border-ink max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between border-b border-rule pb-2">
              <div>
                <span className="stamp-badge !text-[10px]">CORRECTION LOG</span>
                <h2 className="text-sm font-bold uppercase tracking-wider mt-1">
                  SUBMIT INVESTIGATOR CORRECTION
                </h2>
              </div>
              <button
                onClick={() => setEditingClaim(null)}
                className="text-xs font-bold text-ink/60 hover:text-ink"
              >
                ✕ CLOSE
              </button>
            </div>

            <p className="text-xs text-ink/70 leading-relaxed">
              In accordance with epistemic principles, the original extraction is kept untouched.
              Your correction is recorded as a new <strong>VERIFIED_FACT</strong> claim record and
              cryptographically chained into the immutable audit ledger.
            </p>

            <div className="space-y-3 text-xs">
              {/* Original Claim (Preserved) */}
              <div className="border border-rule bg-desk/30 p-2.5 space-y-1">
                <span className="text-[10px] uppercase font-bold text-ink/60">
                  ORIGINAL VALUE (PRESERVED IN UNTOUCHED RECORD #{editingClaim.id}):
                </span>
                <div className="font-bold text-ink text-sm">{editingClaim.value}</div>
                <div className="text-[10px] text-ink/50">
                  Type: {editingClaim.claim_type} | Method: {editingClaim.method} | Location: {editingClaim.location_ref || "N/A"}
                </div>
              </div>

              {/* Corrected Value Input */}
              <div className="space-y-1">
                <label className="block font-bold uppercase text-[11px]">
                  CORRECTED VALUE *
                </label>
                <input
                  type="text"
                  value={correctedValue}
                  onChange={(e) => setCorrectedValue(e.target.value)}
                  className="w-full border border-ink bg-white p-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ink"
                  placeholder="Enter exact corrected value..."
                />
              </div>

              {/* Investigator Note */}
              <div className="space-y-1">
                <label className="block font-bold uppercase text-[11px]">
                  INVESTIGATOR RATIONALE / AUDIT NOTE
                </label>
                <textarea
                  rows={2}
                  value={correctionNote}
                  onChange={(e) => setCorrectionNote(e.target.value)}
                  className="w-full border border-rule bg-white p-2 text-xs font-mono focus:outline-none focus:border-ink"
                  placeholder="e.g. Corrected beneficiary account following manual check against verified bank statement..."
                />
              </div>
            </div>

            <div className="border-t border-rule pt-3 flex items-center justify-end space-x-2 text-xs">
              <button
                onClick={() => setEditingClaim(null)}
                disabled={isSavingCorrection}
                className="border border-rule px-3 py-1.5 uppercase hover:bg-desk"
              >
                CANCEL
              </button>
              <button
                onClick={handleSaveCorrection}
                disabled={isSavingCorrection || !correctedValue.trim()}
                className="border-2 border-ink bg-ink text-paper px-4 py-1.5 font-bold uppercase hover:bg-ink/80 disabled:opacity-50"
              >
                {isSavingCorrection ? "LOGGING CORRECTION..." : "SAVE CORRECTION RECORD"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step Footer Navigation */}
      <div className="border-t border-rule p-3 bg-paper shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs">
          <Link
            href="/upload"
            className="border border-rule bg-white px-3 py-1.5 hover:bg-desk"
          >
            &larr; STEP 1: UPLOAD
          </Link>
          {evidenceList.length >= 2 ? (
            <Link
              href="/match"
              className="border-2 border-ink bg-paper px-4 py-2 font-bold uppercase hover:bg-desk active:translate-y-px flex items-center space-x-2 shadow-[2px_2px_0px_0px_#1B1B18]"
            >
              <span>PROCEED TO STEP 3: MATCH RELATIONSHIPS</span>
              <span>&rarr;</span>
            </Link>
          ) : (
            <button
              disabled
              className="border-2 border-rule bg-desk text-ink/40 px-4 py-2 font-bold uppercase cursor-not-allowed"
              title="At least two evidence files required"
            >
              🔒 PROCEED TO STEP 3 (MINIMUM 2 FILES REQUIRED)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

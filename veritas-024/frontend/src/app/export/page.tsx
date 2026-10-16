"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  AuditEntry,
  EvidenceItem,
  Contradiction,
  getAuditChain,
  verifyAuditChain,
  getEvidenceList,
  getContradictions,
  API_URL,
} from "../api";

export default function ExportPage() {
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>([]);
  const [contradictions, setContradictions] = useState<Contradiction[]>([]);
  const [auditChain, setAuditChain] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [verificationResult, setVerificationResult] = useState<{
    valid: boolean;
    entries_checked?: number;
    broken_id?: number;
    reason?: string;
    message?: string;
  } | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  const fetchDossierData = useCallback(async () => {
    try {
      const [ev, co, au] = await Promise.all([
        getEvidenceList().catch(() => []),
        getContradictions().catch(() => []),
        getAuditChain().catch(() => []),
      ]);
      setEvidenceList(ev);
      setContradictions(co);
      setAuditChain(au);
    } catch (err) {
      console.error("Failed to load export data:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDossierData();
    const handleRefresh = () => fetchDossierData();
    window.addEventListener("veritas:refresh", handleRefresh);
    return () => window.removeEventListener("veritas:refresh", handleRefresh);
  }, [fetchDossierData]);

  const handleVerifyAuditChain = async () => {
    setIsVerifying(true);
    try {
      const res = await verifyAuditChain();
      setVerificationResult(res);
      const chain = await getAuditChain();
      setAuditChain(chain);
    } catch (err: any) {
      setVerificationResult({
        valid: false,
        reason: err.message || "Failed to communicate with audit verifier",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const acceptedCount = contradictions.filter((c) => c.review_status === "accepted").length;
  const rejectedCount = contradictions.filter((c) => c.review_status === "rejected").length;
  const escalatedCount = contradictions.filter((c) => c.review_status === "needs_more_info").length;
  const pendingCount = contradictions.filter((c) => c.review_status === "pending").length;

  return (
    <div className="space-y-6 pt-4">
      {/* Step Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
        <div>
          <div className="flex items-center space-x-2">
            <span className="bg-zinc-950 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
              Step 5 of 5
            </span>
            <h1 className="text-xl font-bold tracking-tight text-zinc-950">
              Export Dossier &amp; Cryptographic Audit
            </h1>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Export verified docket including evidence statement, relationship graph summary, findings, and SHA-256 audit log.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Link
            href="/statement"
            className="px-4 py-2 text-xs font-semibold text-zinc-700 bg-white border border-zinc-200/80 rounded-full hover:bg-zinc-50 shadow-sm transition-all"
          >
            &larr; Step 4: Statement
          </Link>
          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full text-xs font-semibold">
            Final Stage
          </span>
        </div>
      </div>

      {/* Main Export Content */}
      <div className="space-y-6">
        {evidenceList.length < 2 && !isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="max-w-xl w-full bento-card-white rounded-[28px] p-8 text-center space-y-4 shadow-sm border border-amber-200">
              <div className="text-4xl">⚠️</div>
              <h2 className="text-base font-bold uppercase tracking-wider text-amber-800">
                Insufficient Evidence (At least 2 files required)
              </h2>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Exporting a verified court docket requires <strong>at least two (2) evidence files</strong>.
                Currently {evidenceList.length} of 2 required files in docket.
              </p>
              <div className="bg-zinc-50 rounded-xl p-2.5 text-xs font-mono text-zinc-600 border border-zinc-200">
                Status: <strong>Minimum 2 evidence files required to generate dossier</strong>
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
          <>
        {/* Export Action Card Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. PDF Export */}
          <div className="bento-card-white rounded-[24px] p-5 flex flex-col justify-between space-y-3 shadow-sm">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="stamp-badge !text-[9px]">COURT READY</span>
                  <span className="text-xs font-bold text-ink">.PDF</span>
                </div>
                <h2 className="text-xs font-bold uppercase tracking-wide">
                  PRINTABLE PDF REPORT
                </h2>
                <p className="text-[11px] text-ink/60 leading-normal">
                  Formatted court docket with forensic tables, badge stamps, and examiner signature lines.
                </p>
              </div>
              <div className="space-y-1.5 pt-2 border-t border-rule">
                <a
                  href={`${API_URL}/api/report`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full block text-center border-2 border-ink bg-paper py-1.5 text-xs font-bold uppercase hover:bg-desk active:translate-y-px"
                >
                  VIEW / PRINT PDF &nearr;
                </a>
              </div>
            </div>

            {/* 2. DOCX Export */}
            <div className="paper-sheet p-4 border-2 border-ink bg-white flex flex-col justify-between space-y-3 shadow-[2px_2px_0px_0px_#1B1B18]">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="stamp-badge !text-[9px]">WORD DOSSIER</span>
                  <span className="text-xs font-bold text-ink">.DOCX</span>
                </div>
                <h2 className="text-xs font-bold uppercase tracking-wide">
                  MICROSOFT WORD DOSSIER
                </h2>
                <p className="text-[11px] text-ink/60 leading-normal">
                  Complete narrative document with editable tables, findings, and case references.
                </p>
              </div>
              <div className="space-y-1.5 pt-2 border-t border-rule">
                <a
                  href={`${API_URL}/api/report/docx`}
                  download="VERITAS-024_investigation_docket.docx"
                  className="w-full block text-center border-2 border-ink bg-paper py-1.5 text-xs font-bold uppercase hover:bg-desk active:translate-y-px"
                >
                  DOWNLOAD DOCX ↓
                </a>
              </div>
            </div>

            {/* 3. JSON Export */}
            <div className="paper-sheet p-4 border-2 border-ink bg-white flex flex-col justify-between space-y-3 shadow-[2px_2px_0px_0px_#1B1B18]">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="stamp-badge !text-[9px]">MACHINE READABLE</span>
                  <span className="text-xs font-bold text-ink">.JSON</span>
                </div>
                <h2 className="text-xs font-bold uppercase tracking-wide">
                  STRUCTURED RAW JSON
                </h2>
                <p className="text-[11px] text-ink/60 leading-normal">
                  All claims, graph edges, tamper flags, decisions, and hashes in standard JSON structure.
                </p>
              </div>
              <div className="space-y-1.5 pt-2 border-t border-rule">
                <a
                  href={`${API_URL}/api/report.json`}
                  target="_blank"
                  rel="noreferrer"
                  download="VERITAS-024_docket_RF2291.json"
                  className="w-full block text-center border-2 border-ink bg-paper py-1.5 text-xs font-bold uppercase hover:bg-desk active:translate-y-px"
                >
                  DOWNLOAD JSON ↓
                </a>
              </div>
            </div>

            {/* 4. CSV Export Suite */}
            <div className="paper-sheet p-4 border-2 border-ink bg-white flex flex-col justify-between space-y-3 shadow-[2px_2px_0px_0px_#1B1B18]">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="stamp-badge !text-[9px]">SPREADSHEET</span>
                  <span className="text-xs font-bold text-ink">.CSV</span>
                </div>
                <h2 className="text-xs font-bold uppercase tracking-wide">
                  CSV DATASET EXPORTS
                </h2>
                <p className="text-[11px] text-ink/60 leading-normal">
                  Export tabular datasets for spreadsheet audit and external relational analysis.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-1 pt-1 border-t border-rule text-[10px]">
                <a
                  href={`${API_URL}/api/report/csv?dataset=evidence`}
                  download="VERITAS-024_evidence.csv"
                  className="border border-rule bg-paper py-1 text-center hover:bg-desk"
                >
                  EVIDENCE.CSV
                </a>
                <a
                  href={`${API_URL}/api/report/csv?dataset=claims`}
                  download="VERITAS-024_claims.csv"
                  className="border border-rule bg-paper py-1 text-center hover:bg-desk"
                >
                  CLAIMS.CSV
                </a>
                <a
                  href={`${API_URL}/api/report/csv?dataset=contradictions`}
                  download="VERITAS-024_contradictions.csv"
                  className="border border-rule bg-paper py-1 text-center hover:bg-desk"
                >
                  FINDINGS.CSV
                </a>
                <a
                  href={`${API_URL}/api/report/csv?dataset=audit`}
                  download="VERITAS-024_audit_chain.csv"
                  className="border border-rule bg-paper py-1 text-center hover:bg-desk"
                >
                  AUDIT.CSV
                </a>
              </div>
            </div>
          </div>

          {/* Dossier Summary & Decision Matrix */}
          <div className="paper-sheet p-5 border-2 border-rule bg-white space-y-4">
            <div className="flex items-center justify-between border-b border-rule pb-2">
              <div>
                <span className="text-[10px] text-ink/60 uppercase font-bold">CASE SUMMARY</span>
                <h2 className="text-sm font-bold uppercase tracking-wider text-ink">
                  DOCKET FINDINGS &amp; HUMAN DECISION AUDIT
                </h2>
              </div>
              <span className="label-verified-fact">CASE: TRC-2024</span>
            </div>

            {/* Metric Summary Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="border border-rule bg-desk/20 p-2.5">
                <span className="text-[10px] text-ink/60 uppercase block">EVIDENCE VAULT</span>
                <strong className="text-base text-ink">{evidenceList.length}</strong> Artifacts
              </div>
              <div className="border border-rule bg-desk/20 p-2.5">
                <span className="text-[10px] text-ink/60 uppercase block">DISCREPANCIES FLAGGED</span>
                <strong className="text-base text-stamp">{contradictions.length}</strong> Contradictions
              </div>
              <div className="border border-rule bg-desk/20 p-2.5">
                <span className="text-[10px] text-ink/60 uppercase block">HUMAN DECISIONS</span>
                <div className="text-[11px] mt-0.5 space-x-1">
                  <span className="text-fact font-bold">{acceptedCount} Acc</span> /
                  <span className="text-stamp font-bold">{rejectedCount} Dism</span> /
                  <span className="text-ink font-bold">{escalatedCount} Esc</span>
                </div>
              </div>
              <div className="border border-rule bg-desk/20 p-2.5">
                <span className="text-[10px] text-ink/60 uppercase block">IMMUTABLE LOG</span>
                <strong className="text-base text-ink">{auditChain.length}</strong> Hashed Entries
              </div>
            </div>

            {/* Decisions Table */}
            <div className="space-y-2 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider">
                ADJUDICATED FINDINGS BREAKDOWN
              </h3>

              {contradictions.length === 0 ? (
                <div className="p-4 text-center text-xs text-ink/50 border border-rule bg-paper">
                  No contradictions recorded.
                </div>
              ) : (
                <div className="border border-rule bg-white divide-y divide-rule text-xs">
                  {contradictions.map((c) => (
                    <div key={c.id} className="p-3 flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <div className="space-y-0.5 flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="stamp-badge !text-[9px]">{c.kind.replace("_", " ")}</span>
                          <span className="font-bold text-ink truncate">{c.description}</span>
                        </div>
                        <p className="text-[11px] text-ink/70 italic">
                          Forensic insight: {c.narrative}
                        </p>
                        {c.reviewer_note && (
                          <div className="text-[11px] text-ink font-bold">
                            Investigator Annotation: &quot;{c.reviewer_note}&quot;
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        <span
                          className={`px-2 py-0.5 border text-[10px] font-bold uppercase ${
                            c.review_status === "accepted"
                              ? "border-fact text-fact bg-white"
                              : c.review_status === "rejected"
                              ? "border-stamp text-stamp bg-white"
                              : c.review_status === "needs_more_info"
                              ? "border-ink text-ink bg-desk"
                              : "border-rule text-ink/60 bg-white"
                          }`}
                        >
                          DECISION: {c.review_status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Cryptographic Audit Chain Verification Section */}
          <div className="paper-sheet p-5 border-2 border-rule bg-white space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule pb-2">
              <div>
                <span className="text-[10px] text-ink/60 uppercase font-bold">IMMUTABLE INTEGRITY PROOF</span>
                <h2 className="text-sm font-bold uppercase tracking-wider text-ink">
                  CRYPTOGRAPHIC SHA-256 AUDIT LOG ({auditChain.length} BLOCKS)
                </h2>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleVerifyAuditChain}
                  disabled={isVerifying}
                  className="border-2 border-ink bg-paper px-3 py-1 text-xs font-bold uppercase hover:bg-desk active:translate-y-px disabled:opacity-50"
                >
                  {isVerifying ? "CHECKING CRYPTOGRAPHY..." : "VERIFY AUDIT CHAIN"}
                </button>
              </div>
            </div>

            {/* Verification Result Banner */}
            {verificationResult && (
              <div
                className={`p-3 border-2 text-xs flex items-center justify-between ${
                  verificationResult.valid
                    ? "border-fact bg-fact/10 text-fact"
                    : "border-stamp bg-stamp/10 text-stamp"
                }`}
              >
                <div className="space-y-0.5">
                  <div className="font-bold text-sm uppercase tracking-wide">
                    {verificationResult.valid
                      ? "✓ CRYPTOGRAPHIC AUDIT CHAIN INTEGRITY: 100% VALID"
                      : "✕ AUDIT CHAIN TAMPER DETECTED"}
                  </div>
                  <div className="text-[11px] text-ink/70">
                    {verificationResult.valid
                      ? `Verified all ${verificationResult.entries_checked ?? auditChain.length} sequential blocks from Genesis (0000...0000) to current docket head.`
                      : `Broken hash link identified at Entry #${verificationResult.broken_id}: ${verificationResult.reason}`}
                  </div>
                </div>
                <span className="stamp-badge !text-[10px]">
                  {verificationResult.valid ? "VERIFIED" : "TAMPER ALERT"}
                </span>
              </div>
            )}

            {/* Full Audit Log Table */}
            <div className="border border-rule bg-white max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs divide-y divide-rule">
                <thead className="bg-desk/50 sticky top-0 border-b border-rule font-bold text-[10px] uppercase">
                  <tr>
                    <th className="p-2">#</th>
                    <th className="p-2">TIMESTAMP (UTC)</th>
                    <th className="p-2">ACTOR</th>
                    <th className="p-2">ACTION</th>
                    <th className="p-2">TARGET</th>
                    <th className="p-2">ENTRY HASH (SHA-256)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule font-mono text-[11px]">
                  {auditChain.map((entry) => (
                    <tr key={entry.id} className="hover:bg-desk/20">
                      <td className="p-2 font-bold text-ink/60">{entry.id}</td>
                      <td className="p-2 text-ink/70">
                        {entry.timestamp_utc.replace("T", " ").substring(0, 19)}
                      </td>
                      <td className="p-2 uppercase font-bold">
                        <span
                          className={`px-1 py-0.2 border text-[9px] ${
                            entry.actor === "human"
                              ? "border-stamp text-stamp bg-paper"
                              : "border-rule text-ink/70 bg-desk"
                          }`}
                        >
                          {entry.actor}
                        </span>
                      </td>
                      <td className="p-2 font-bold text-ink">{entry.action}</td>
                      <td className="p-2 text-ink/70">{entry.target}</td>
                      <td className="p-2 font-mono text-[10px] select-all text-ink/60" title={entry.entry_hash}>
                        {entry.entry_hash ? entry.entry_hash.substring(0, 16) + "..." : "GENESIS"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Examiner Attestation Sign-Off Card */}
          <div className="paper-sheet p-6 border-2 border-ink bg-white space-y-5 shadow-sm">
            <div className="border-b border-rule pb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-ink">
                FORENSIC EXAMINER ATTESTATION &amp; DOCKET SIGN-OFF
              </span>
              <span className="stamp-badge !border-ink !text-ink">CERTIFIED RECORD</span>
            </div>

            <p className="text-xs text-ink/70 leading-relaxed">
              I hereby certify that the evidence items, forensic markers, and claim correlations recorded in this docket
              have been inspected under strict epistemic integrity controls. All automated observations have undergone
              human investigator adjudication.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 text-xs">
              <div className="border-t-2 border-ink pt-2 space-y-1">
                <div className="font-bold uppercase text-[11px]">LEAD FORENSIC EXAMINER SIGNATURE</div>
                <div className="text-[10px] text-ink/50">
                  DATE: 2026-10-15 &bull; BADGE ID: VR-024-LEAD
                </div>
              </div>
              <div className="border-t-2 border-ink pt-2 space-y-1">
                <div className="font-bold uppercase text-[11px]">SUPERVISING AUDITOR ATTESTATION</div>
                <div className="text-[10px] text-ink/50">
                  DATE: 2026-10-15 &bull; CERTIFICATION: WORM-INTEGRITY-PASS
                </div>
              </div>
            </div>
          </div>

          {/* Epistemic Guardrail Footer Banner */}
          <div className="border-2 border-stamp bg-paper p-4 text-center space-y-1">
            <span className="stamp-badge !text-[11px] !border-stamp !text-stamp">
              GOVERNANCE DIRECTIVE
            </span>
            <p className="text-sm font-bold tracking-wider text-stamp uppercase mt-1">
              &quot;AI suggests. A human decides.&quot;
            </p>
            <p className="text-[11px] text-ink/60">
              AI-generated. Not proof. Requires human review. This docket is cryptographically anchored and ready for regulatory submission.
            </p>
          </div>
        </>
      )}
    </div>

      {/* Step Footer Navigation */}
      <div className="border-t border-rule p-3 bg-paper shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs">
          <Link
            href="/statement"
            className="border border-rule bg-white px-3 py-1.5 hover:bg-desk"
          >
            &larr; STEP 4: STATEMENT
          </Link>
          <div className="flex items-center space-x-2">
            {evidenceList.length >= 2 ? (
              <a
                href={`${API_URL}/api/report`}
                target="_blank"
                rel="noreferrer"
                className="border-2 border-ink bg-paper px-4 py-2 font-bold uppercase hover:bg-desk active:translate-y-px shadow-[2px_2px_0px_0px_#1B1B18]"
              >
                GENERATE OFFICIAL REPORT &nearr;
              </a>
            ) : (
              <button
                disabled
                className="border-2 border-rule bg-desk text-ink/40 px-4 py-2 font-bold uppercase cursor-not-allowed"
                title="At least two evidence files required"
              >
                🔒 GENERATE OFFICIAL REPORT (MIN 2 FILES)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

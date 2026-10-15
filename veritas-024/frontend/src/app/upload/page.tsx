"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  EvidenceItem,
  getEvidenceList,
  uploadEvidenceFile,
  API_URL,
} from "../api";

export default function UploadPage() {
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [uploadNote, setUploadNote] = useState<string>("");
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const fetchEvidence = useCallback(async () => {
    try {
      const items = await getEvidenceList();
      setEvidenceList(items);
    } catch (err) {
      console.error("Failed to load evidence:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvidence();
    const handleRefresh = () => fetchEvidence();
    window.addEventListener("veritas:refresh", handleRefresh);
    return () => window.removeEventListener("veritas:refresh", handleRefresh);
  }, [fetchEvidence]);

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    try {
      await uploadEvidenceFile(file, uploadNote);
      setUploadNote("");
      await fetchEvidence();
    } catch (err: any) {
      alert(`Upload error: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        await handleUpload(e.dataTransfer.files[i]);
      }
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      for (let i = 0; i < e.target.files.length; i++) {
        await handleUpload(e.target.files[i]);
      }
    }
  };

  const copyToClipboard = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-4 md:p-6 bg-paper font-mono text-ink">
      <div className="max-w-6xl w-full mx-auto space-y-6">
        {/* Step Header */}
        <div className="border-b border-rule pb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="bg-ink text-paper text-xs font-bold px-2 py-0.5">
                STEP 1 OF 5
              </span>
              <h1 className="text-base font-bold tracking-wider uppercase">
                EVIDENCE INGESTION &amp; IMMUTABLE VAULT
              </h1>
            </div>
            <p className="text-xs text-ink/70 mt-1">
              Store original artifacts in a read-only location, compute SHA-256 cryptographic digests,
              and guarantee zero modification of original assets.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-ink/60">
              TOTAL ARTIFACTS: <strong className="text-ink">{evidenceList.length}</strong>
            </span>
            <Link
              href="/extract"
              className="border border-ink bg-white px-3 py-1.5 text-xs font-bold uppercase hover:bg-desk active:translate-y-px flex items-center space-x-1"
            >
              <span>NEXT: EXTRACT CLAIMS</span>
              <span>&rarr;</span>
            </Link>
          </div>
        </div>

        {/* Read-Only Guarantee Notice */}
        <div className="border border-rule bg-desk/30 p-3 text-xs leading-relaxed flex items-start space-x-3">
          <span className="stamp-badge !text-[10px] shrink-0">WORM POLICY</span>
          <div>
            <strong>WRITE-ONCE READ-MANY (WORM) GUARANTEE:</strong> Every uploaded artifact is
            hashed with SHA-256 upon receipt. The original byte stream is locked in a read-only vault.
            All forensic parsing, OCR, and AI synthesis operate strictly on isolated working copies.
          </div>
        </div>

        {/* Drag & Drop Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed p-8 text-center transition-colors ${
            dragOver
              ? "border-ink bg-desk/60"
              : "border-rule bg-white hover:bg-desk/20"
          }`}
        >
          <div className="max-w-md mx-auto space-y-3">
            <div className="text-2xl text-ink/40">📂</div>
            <div className="text-xs font-bold uppercase tracking-wider">
              {isUploading ? "COMPUTING SHA-256 & STORING ORIGINAL..." : "DRAG & DROP EVIDENCE ARTIFACTS"}
            </div>
            <p className="text-[11px] text-ink/60">
              Accepted formats: <strong>PNG, JPG, PDF, EML, TXT, JSON, Chat Exports</strong>
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
              <label className="border border-ink bg-paper px-4 py-1.5 text-xs font-bold uppercase cursor-pointer hover:bg-desk active:translate-y-px">
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileInput}
                  accept=".png,.jpg,.jpeg,.pdf,.eml,.txt,.json"
                  disabled={isUploading}
                />
                BROWSE FILES
              </label>

              <input
                type="text"
                placeholder="Optional chain-of-custody note..."
                value={uploadNote}
                onChange={(e) => setUploadNote(e.target.value)}
                className="border border-rule bg-paper px-3 py-1.5 text-xs w-full sm:w-64 focus:outline-none focus:border-ink"
              />
            </div>
          </div>
        </div>

        {/* Docket Ingestion List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-rule pb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider">
              INGESTED ARTIFACT DOCKET ({evidenceList.length})
            </h2>
            <span className="text-[11px] text-ink/60">
              TAMPER &amp; DUPLICATE INDICATORS WORDED AS &quot;REVIEW NEEDED&quot;
            </span>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-xs text-ink/60 border border-rule bg-white">
              LOADING DOCKET ARTIFACTS...
            </div>
          ) : evidenceList.length === 0 ? (
            <div className="p-10 text-center text-xs text-ink/50 border border-rule bg-white space-y-2">
              <p>NO EVIDENCE INGESTED IN THIS DOCKET YET.</p>
              <p className="text-[11px] text-ink/40">
                Drag and drop files above or click &quot;DEMO CASE&quot; in the header to load the canonical RF-2291 investigation.
              </p>
            </div>
          ) : (
            <div className="border border-rule bg-white divide-y divide-rule overflow-hidden">
              {evidenceList.map((item) => {
                const isDuplicate = item.duplicate_of_id !== null && item.duplicate_of_id !== undefined;
                const flags = item.tamper_flags || [];
                const hasFlags = flags.length > 0;
                const isReviewNeeded = isDuplicate || hasFlags;

                return (
                  <div
                    key={item.id}
                    className="p-3 hover:bg-desk/20 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                  >
                    {/* File Identification */}
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-ink truncate">
                          {item.filename}
                        </span>
                        <span className="border border-rule px-1.5 py-0.2 bg-desk text-[10px] uppercase">
                          {item.file_type}
                        </span>
                        <span className="text-[10px] text-ink/50">
                          ID: #{item.id}
                        </span>
                      </div>

                      {/* Hash & Size Bar */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink/70">
                        <div className="flex items-center space-x-1">
                          <span className="font-semibold text-ink">SHA-256:</span>
                          <span className="text-[10px] select-all bg-paper px-1 border border-rule">
                            {item.sha256}
                          </span>
                          <button
                            onClick={() => copyToClipboard(item.sha256)}
                            className="text-[10px] underline hover:text-ink text-ink/60"
                          >
                            {copiedHash === item.sha256 ? "COPIED" : "COPY"}
                          </button>
                        </div>
                        <div>
                          <span className="font-semibold text-ink">SIZE:</span>{" "}
                          {(item.size_bytes / 1024).toFixed(1)} KB ({item.size_bytes.toLocaleString()} bytes)
                        </div>
                        <div>
                          <span className="font-semibold text-ink">INGESTED:</span>{" "}
                          {item.uploaded_at_utc.replace("T", " ").substring(0, 19)} UTC
                        </div>
                      </div>

                      {item.source_note && (
                        <div className="text-[11px] text-ink/60 italic">
                          Note: {item.source_note}
                        </div>
                      )}
                    </div>

                    {/* Status & Review Indicators */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0 md:justify-end">
                      {isDuplicate && (
                        <span
                          className="stamp-badge !border-stamp !text-stamp"
                          title={`Exact content match of evidence #${item.duplicate_of_id}`}
                        >
                          REVIEW NEEDED: DUPLICATE (REF #{item.duplicate_of_id})
                        </span>
                      )}

                      {hasFlags && (
                        <span
                          className="stamp-badge !border-stamp !text-stamp"
                          title={flags.map((f) => f.detail).join("; ")}
                        >
                          REVIEW NEEDED: STRUCTURAL ANOMALY ({flags.length})
                        </span>
                      )}

                      {!isReviewNeeded && (
                        <span className="label-verified-fact">
                          VERIFIED INTEGRITY
                        </span>
                      )}

                      <a
                        href={`${API_URL}/api/evidence/${item.id}/file`}
                        target="_blank"
                        rel="noreferrer"
                        className="border border-rule px-2 py-1 text-[11px] hover:bg-desk bg-paper uppercase"
                      >
                        VIEW RAW
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Step Footer Navigation */}
        <div className="border-t border-rule pt-4 flex items-center justify-between">
          <div className="text-xs text-ink/60">
            STEP 1 COMPLETE: All ingested files secured with immutable hashes.
          </div>
          <Link
            href="/extract"
            className="border-2 border-ink bg-paper px-4 py-2 text-xs font-bold uppercase hover:bg-desk active:translate-y-px flex items-center space-x-2 shadow-[2px_2px_0px_0px_#1B1B18]"
          >
            <span>PROCEED TO STEP 2: EXTRACT CLAIMS</span>
            <span>&rarr;</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

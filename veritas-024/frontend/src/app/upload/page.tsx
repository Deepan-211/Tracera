"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  EvidenceItem,
  getEvidenceList,
  uploadEvidenceFile,
  deleteEvidence,
  API_URL,
} from "../api";

export default function UploadPage() {
  const router = useRouter();
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; currentFile: string } | null>(null);
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [uploadNote, setUploadNote] = useState<string>("");
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchEvidence = useCallback(async () => {
    try {
      const items = await getEvidenceList();
      setEvidenceList(items);
    } catch (err: any) {
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

  const handleUploadBatch = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setErrorMessage(null);

    const fileArray = Array.from(files);
    setUploadProgress({ current: 0, total: fileArray.length, currentFile: fileArray[0].name });

    try {
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        setUploadProgress({ current: i + 1, total: fileArray.length, currentFile: file.name });
        await uploadEvidenceFile(file, uploadNote);
      }
      setUploadNote("");
      await fetchEvidence();
      window.dispatchEvent(new CustomEvent("veritas:refresh"));
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to upload one or more files.");
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleUploadBatch(e.dataTransfer.files);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await handleUploadBatch(e.target.files);
    }
  };

  const handleDelete = async (id: number, filename: string) => {
    if (!confirm(`Remove "${filename}" (ID #${id}) from evidence docket?`)) return;
    try {
      await deleteEvidence(id);
      await fetchEvidence();
      window.dispatchEvent(new CustomEvent("veritas:refresh"));
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const copyToClipboard = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const formatExactTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return (
        d.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }) + ` · ${d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`
      );
    } catch {
      return isoString;
    }
  };

  const getFormatIcon = (type: string) => {
    const t = type.toLowerCase();
    if (["png", "jpg", "jpeg", "webp", "bmp", "gif", "svg"].includes(t)) return "🖼️";
    if (t === "pdf") return "📄";
    if (["eml", "msg"].includes(t)) return "✉️";
    if (["txt", "json", "csv", "tsv", "log", "md"].includes(t)) return "📝";
    if (["doc", "docx", "xls", "xlsx"].includes(t)) return "📁";
    return "📦";
  };

  return (
    <div className="space-y-6 pt-4">
      {/* Top Banner / Step Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
        <div>
          <div className="flex items-center space-x-2">
            <span className="bg-zinc-950 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
              Step 1 of 5
            </span>
            <h1 className="text-xl font-bold tracking-tight text-zinc-950">
              Evidence Docket &amp; Raw Vault
            </h1>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Ingest authentic digital artifacts. SHA-256 seal and timestamp are computed automatically.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs font-mono bg-white px-3 py-1.5 rounded-full border border-zinc-200/80 text-zinc-600 shadow-sm">
            Total Vault: <strong>{evidenceList.length} Files</strong>
          </span>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span>⚠️</span>
            <span className="font-medium">{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="font-bold underline ml-3">
            Dismiss
          </button>
        </div>
      )}

      {/* 2-File Minimum Status Banner */}
      {evidenceList.length < 2 && !isLoading && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50/70 p-4 text-xs flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center space-x-3 text-amber-800 font-medium">
            <span className="text-xl">⚠️</span>
            <span>
              {evidenceList.length === 1
                ? "At least two (2) evidence files are required. You have 1 file uploaded. Cross-document forensic investigation and contradiction detection require at least two files. Please upload at least one more artifact."
                : "At least two (2) evidence files are required to process. Upload at least 2 evidence artifacts below to initiate investigation."}
            </span>
          </div>
          <span className="shrink-0 bg-amber-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            {evidenceList.length}/2 Files
          </span>
        </div>
      )}

      {/* Main Side-by-Side Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT PANEL: EVIDENCE FILES (Stored with Exact Time & Filename) */}
        <div className="lg:col-span-5 bento-card-white rounded-[28px] p-5 shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center justify-between pb-4 mb-3 border-b border-zinc-100">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold text-zinc-950">
                Evidence Files
              </span>
              <span className="bg-zinc-950 text-white text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                {evidenceList.length}
              </span>
            </div>
            <span className="text-[10px] text-zinc-400 font-mono">
              Exact Timestamp Log
            </span>
          </div>

          {/* Evidence List Body */}
          <div className="divide-y divide-zinc-100 max-h-[520px] overflow-y-auto space-y-1">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-zinc-400 font-mono">
                Loading evidence vault...
              </div>
            ) : evidenceList.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-400 space-y-2">
                <div className="text-3xl mb-2">📋</div>
                <p className="font-semibold text-zinc-700">No evidence files stored yet</p>
                <p className="text-[11px] text-zinc-400 max-w-xs mx-auto">
                  Drag and drop 2 or more files into the zone on the right. Each artifact will be sealed with its exact upload time and cryptographic hash.
                </p>
              </div>
            ) : (
              evidenceList.map((item, idx) => (
                <div
                  key={item.id}
                  className="p-3 hover:bg-zinc-50/80 rounded-2xl transition-all space-y-2 group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start space-x-2.5 min-w-0 flex-1">
                      <span className="text-base shrink-0 leading-none mt-0.5">
                        {getFormatIcon(item.file_type)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-xs text-zinc-900 truncate" title={item.filename}>
                          {item.filename}
                        </div>
                        <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                          {formatExactTime(item.uploaded_at_utc)}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-1 shrink-0">
                      <a
                        href={`${API_URL}/api/evidence/${item.id}/file`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-1 text-[10px] font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
                        title="View raw file"
                      >
                        View
                      </a>
                      <button
                        onClick={() => handleDelete(item.id, item.filename)}
                        className="px-2 py-1 text-[10px] font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors"
                        title="Remove file"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Metadata Pills */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] pt-1">
                    <span className="bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded-full font-mono font-bold uppercase">
                      {item.file_type}
                    </span>
                    <span className="text-zinc-400 font-mono">
                      {(item.size_bytes / 1024).toFixed(1)} KB
                    </span>
                    <span className="text-zinc-300">•</span>
                    <span className="text-zinc-500 font-mono text-[9px] truncate max-w-[140px]">
                      {item.sha256.substring(0, 12)}...
                    </span>
                    <button
                      onClick={() => copyToClipboard(item.sha256)}
                      className="text-[9px] text-zinc-500 hover:text-zinc-900 underline font-mono ml-auto"
                    >
                      {copiedHash === item.sha256 ? "Copied!" : "Copy Hash"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Total */}
          {evidenceList.length > 0 && (
            <div className="pt-4 mt-2 border-t border-zinc-100 text-[11px] text-zinc-500 flex items-center justify-between font-mono">
              <span>Vault: <strong>Verified</strong></span>
              <span>Total: <strong>{(evidenceList.reduce((acc, f) => acc + f.size_bytes, 0) / 1024).toFixed(1)} KB</strong></span>
            </div>
          )}
        </div>

        {/* RIGHT PANEL: DRAG & DROP EVIDENCE ARTIFACTS ZONE */}
        <div className="lg:col-span-7 space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`bento-card-white rounded-[28px] p-8 md:p-12 text-center transition-all relative shadow-sm border-2 ${
              dragOver
                ? "border-zinc-950 bg-zinc-50/90 scale-[1.01]"
                : "border-dashed border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50/50"
            }`}
          >
            <div className="max-w-md mx-auto space-y-4">
              <div className="w-14 h-14 rounded-full bg-zinc-100 mx-auto flex items-center justify-center text-2xl text-zinc-700 shadow-sm">
                {isUploading ? "⏳" : dragOver ? "📥" : "📂"}
              </div>

              <div>
                <h3 className="text-base font-bold text-zinc-950">
                  {isUploading ? "Ingesting & Sealing Evidence..." : "Drag & Drop Evidence Artifacts"}
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Multi-format ingestion pipeline for tamper-evident digital investigation.
                </p>
              </div>

              {/* Upload Progress Bar */}
              {isUploading && uploadProgress && (
                <div className="bg-zinc-50 rounded-2xl p-4 text-xs space-y-2 text-left border border-zinc-200">
                  <div className="flex items-center justify-between font-bold text-zinc-800">
                    <span>Processing {uploadProgress.current} of {uploadProgress.total}</span>
                    <span>{Math.round((uploadProgress.current / uploadProgress.total) * 100)}%</span>
                  </div>
                  <div className="w-full bg-zinc-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-zinc-950 h-full rounded-full transition-all duration-300"
                      style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-zinc-500 truncate font-mono">
                    Hashing: {uploadProgress.currentFile}
                  </div>
                </div>
              )}

              {/* Supported Formats */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                {[
                  "Images (PNG, JPG, WEBP)",
                  "PDF Documents",
                  "Emails (.EML)",
                  "Chat / Logs (.TXT, .CSV)",
                  "Word (.DOCX)",
                ].map((fmt) => (
                  <span
                    key={fmt}
                    className="bg-zinc-100 text-zinc-600 text-[10px] font-medium px-2.5 py-1 rounded-full"
                  >
                    {fmt}
                  </span>
                ))}
              </div>

              {/* File Browser and Note */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
                <label className="bg-zinc-950 text-white px-6 py-2.5 rounded-full text-xs font-semibold cursor-pointer hover:bg-black active:scale-95 transition-all shadow-sm">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileInput}
                    disabled={isUploading}
                  />
                  Browse Files
                </label>

                <input
                  type="text"
                  placeholder="Optional chain-of-custody note..."
                  value={uploadNote}
                  onChange={(e) => setUploadNote(e.target.value)}
                  className="bg-white border border-zinc-200 rounded-full px-4 py-2 text-xs w-full sm:w-60 focus:outline-none focus:border-zinc-400 shadow-sm"
                />
              </div>

              <div className="text-[10px] text-zinc-400">
                You can select and upload multiple files at once.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Proceed Navigation */}
      <div className="pt-4 border-t border-zinc-200/50 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-xs text-zinc-500 font-medium">
          {evidenceList.length >= 2 ? (
            <span className="text-emerald-700 font-semibold flex items-center space-x-1.5">
              <span>✓</span>
              <span>
                <strong>{evidenceList.length} artifacts</strong> sealed. Cross-document comparison enabled.
              </span>
            </span>
          ) : evidenceList.length === 1 ? (
            <span className="text-amber-700 font-semibold flex items-center space-x-1.5">
              <span>⚠️</span>
              <span>
                1 artifact sealed. <strong>At least two (2) files are required</strong> to execute investigation.
              </span>
            </span>
          ) : (
            <span>Import at least two (2) evidence artifacts above to begin investigation.</span>
          )}
        </div>

        {evidenceList.length >= 2 ? (
          <Link
            href="/extract"
            className="bg-zinc-950 text-white px-7 py-3 rounded-full text-xs font-semibold hover:bg-black active:scale-95 transition-all shadow-md flex items-center space-x-2"
          >
            <span>Proceed to Step 2: Extraction</span>
            <span className="text-sm">→</span>
          </Link>
        ) : (
          <button
            disabled
            className="bg-zinc-100 text-zinc-400 px-7 py-3 rounded-full text-xs font-semibold cursor-not-allowed flex items-center space-x-2"
            title="At least two evidence files required to proceed"
          >
            <span>🔒 Proceed to Step 2</span>
            <span className="text-[10px] font-mono">({evidenceList.length}/2 Files)</span>
          </button>
        )}
      </div>
    </div>
  );
}

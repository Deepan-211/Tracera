"use client";

import React, { useState } from "react";
import { EvidenceItem } from "./api";

interface VaultPaneProps {
  evidenceList: EvidenceItem[];
  selectedEvidenceId: number | null;
  onSelectEvidence: (id: number) => void;
  onUpload: (file: File) => Promise<void>;
  onLoadSeedCase: () => Promise<void>;
  onClearCase?: () => Promise<void>;
  isLoading: boolean;
}

export default function VaultPane({
  evidenceList,
  selectedEvidenceId,
  onSelectEvidence,
  onUpload,
  onLoadSeedCase,
  onClearCase,
  isLoading,
}: VaultPaneProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await onUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await onUpload(e.target.files[0]);
    }
  };

  return (
    <div className="h-full flex flex-col bg-paper border-r border-rule">
      {/* Pane Header */}
      <div className="p-3 border-b border-rule flex items-center justify-between">
        <div>
          <div className="case-section-header mb-1">EVIDENCE VAULT</div>
          <p className="text-[11px] text-ink/70 font-mono">
            {evidenceList.length} DOCKET ITEM{evidenceList.length === 1 ? "" : "S"}
          </p>
        </div>
        <div className="flex items-center space-x-1.5">
          {onClearCase && evidenceList.length > 0 && (
            <button
              onClick={onClearCase}
              disabled={isLoading}
              className="border border-stamp text-stamp bg-paper px-2 py-1 text-[11px] font-mono hover:bg-desk active:translate-y-px uppercase font-semibold disabled:opacity-50"
            >
              CLEAR
            </button>
          )}
          <button
            onClick={onLoadSeedCase}
            disabled={isLoading}
            className="border border-ink bg-paper px-2 py-1 text-[11px] font-mono font-medium hover:bg-desk active:translate-y-px transition-colors uppercase disabled:opacity-50"
          >
            {isLoading ? "LOADING..." : "DEMO SUITE"}
          </button>
        </div>
      </div>

      {/* Drag & Drop Upload Ruled Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`m-3 p-3 border border-dashed border-rule text-center transition-colors ${
          dragOver ? "bg-desk/70 border-ink" : "bg-paper hover:bg-desk/30"
        }`}
      >
        <label className="cursor-pointer block">
          <input
            type="file"
            className="hidden"
            onChange={handleFileInput}
            accept=".png,.jpg,.jpeg,.pdf,.eml,.txt,.json"
          />
          <span className="text-xs uppercase font-mono tracking-wider text-ink block font-semibold">
            + INGEST ARTIFACT
          </span>
          <span className="text-[10px] text-ink/60 font-mono mt-1 block">
            DROP PNG, JPG, PDF, EML, TXT, JSON
          </span>
        </label>
      </div>

      {/* Ruled Evidence List */}
      <div className="flex-1 overflow-y-auto">
        {evidenceList.length === 0 ? (
          <div className="p-6 text-center text-xs font-mono text-ink/50 border-t border-rule">
            NO EVIDENCE INGESTED YET.
            <br />
            CLICK &quot;LOAD DEMO CASE&quot; OR DROP FILES.
          </div>
        ) : (
          <div className="divide-y divide-rule border-t border-rule">
            {evidenceList.map((item) => {
              const isSelected = item.id === selectedEvidenceId;
              const hasTamper = item.tamper_flags && item.tamper_flags.length > 0;
              const isDuplicate = item.duplicate_of_id !== null && item.duplicate_of_id !== undefined;

              return (
                <div
                  key={item.id}
                  onClick={() => onSelectEvidence(item.id)}
                  className={`p-2.5 cursor-pointer ruled-row transition-colors ${
                    isSelected ? "bg-desk font-medium border-l-4 border-l-ink" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-xs font-sans truncate font-medium text-ink">
                      {item.filename}
                    </span>
                    <span className="text-[10px] font-mono text-ink/60 uppercase">
                      {item.file_type}
                    </span>
                  </div>

                  <div className="mt-1 flex items-center justify-between text-[11px] font-mono">
                    <span className="text-ink/80 text-[10px]" title={item.sha256}>
                      {item.sha256 ? item.sha256.substring(0, 10) + "..." : "NO-HASH"}
                    </span>
                    <span className="text-[10px] text-ink/60">
                      {(item.size_bytes / 1024).toFixed(1)} KB
                    </span>
                  </div>

                  {/* Stamp Badges */}
                  <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
                    {isDuplicate && (
                      <span className="stamp-badge">
                        DUPLICATE #{item.duplicate_of_id}
                      </span>
                    )}
                    {hasTamper && (
                      <span className="stamp-badge">
                        FLAGGED ({item.tamper_flags?.length})
                      </span>
                    )}
                    <span className="label-verified-fact">
                      SHA-256
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

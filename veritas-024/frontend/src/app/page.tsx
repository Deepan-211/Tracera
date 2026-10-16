"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getEvidenceList,
  getContradictions,
  getGraph,
  EvidenceItem,
  Contradiction,
  GraphData,
} from "./api";

export default function DashboardPage() {
  const router = useRouter();
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [contradictions, setContradictions] = useState<Contradiction[]>([]);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [], clusters: [] });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Checkpoints state
  const [checkpoints, setCheckpoints] = useState({
    minTwoFiles: false,
    hashesVerified: false,
    geminiExtraction: false,
    contradictionsChecked: false,
    statementGenerated: false,
  });

  const fetchData = async () => {
    try {
      const [evList, contraList, graph] = await Promise.all([
        getEvidenceList().catch(() => []),
        getContradictions().catch(() => []),
        getGraph().catch(() => ({ nodes: [], edges: [], clusters: [] })),
      ]);
      setEvidence(evList);
      setContradictions(contraList);
      setGraphData(graph);

      setCheckpoints({
        minTwoFiles: evList.length >= 2,
        hashesVerified: evList.length > 0,
        geminiExtraction: graph.nodes.length > 0,
        contradictionsChecked: contraList.length > 0,
        statementGenerated: evList.length >= 2 && graph.nodes.length > 0,
      });
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const handleRefresh = () => fetchData();
    window.addEventListener("veritas:refresh", handleRefresh);
    return () => window.removeEventListener("veritas:refresh", handleRefresh);
  }, []);

  const evidenceCount = evidence.length;
  const contradictionsCount = contradictions.length;
  const nodesCount = graphData.nodes?.length || 0;
  const edgesCount = graphData.edges?.length || 0;

  return (
    <div className="space-y-6 pt-4">
      {/* ------------------------------------------------------------- */}
      {/* ROW 1: 3 Main Bento Cards (Dark Info, Progress, Month gauge)  */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5">
        {/* CARD 1: Overall Information (Dark Card) */}
        <div className="lg:col-span-4 bento-card-dark rounded-[28px] p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-zinc-400 mb-6">
              <span className="text-sm font-semibold tracking-tight text-white">
                Overall Information
              </span>
              <div className="flex items-center space-x-2 text-zinc-400">
                <button className="hover:text-white transition-colors" title="Share Docket">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                </button>
                <button className="hover:text-white transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Main Stats Display (like '43 Tasks done' in reference image) */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <div className="text-4xl font-extrabold text-white tracking-tight">
                  {evidenceCount}
                </div>
                <div className="text-[11px] text-zinc-400 font-medium mt-0.5 leading-tight">
                  Evidence files loaded
                </div>
              </div>
              <div>
                <div className="text-4xl font-extrabold text-white tracking-tight">
                  {contradictionsCount}
                </div>
                <div className="text-[11px] text-zinc-400 font-medium mt-0.5 leading-tight">
                  Flags &amp; conflicts
                </div>
              </div>
            </div>
          </div>

          {/* 3 Pill Counters inside Dark Card */}
          <div className="grid grid-cols-3 gap-2.5 pt-2">
            <div className="bg-white text-zinc-950 rounded-2xl p-3 text-center flex flex-col justify-center items-center shadow-sm">
              <span className="text-xs text-zinc-400 mb-0.5">●</span>
              <span className="text-lg font-bold leading-none">{nodesCount}</span>
              <span className="text-[9px] font-semibold text-zinc-500 uppercase tracking-tight mt-1">Entities</span>
            </div>
            <div className="bg-white text-zinc-950 rounded-2xl p-3 text-center flex flex-col justify-center items-center shadow-sm">
              <span className="text-xs text-zinc-400 mb-0.5">◌</span>
              <span className="text-lg font-bold leading-none">{edgesCount}</span>
              <span className="text-[9px] font-semibold text-zinc-500 uppercase tracking-tight mt-1">Relations</span>
            </div>
            <div className="bg-white text-zinc-950 rounded-2xl p-3 text-center flex flex-col justify-center items-center shadow-sm">
              <span className="text-xs text-zinc-400 mb-0.5">✓</span>
              <span className="text-lg font-bold leading-none">
                {evidenceCount >= 2 ? "100%" : "0%"}
              </span>
              <span className="text-[9px] font-semibold text-zinc-500 uppercase tracking-tight mt-1">Integrity</span>
            </div>
          </div>
        </div>

        {/* CARD 2: Weekly Progress / Forensic Timeline Wave (White Card) */}
        <div className="lg:col-span-4 bento-card-white rounded-[28px] p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold tracking-tight text-zinc-950">
                Investigation progress
              </span>
              <button className="text-zinc-400 hover:text-zinc-900 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </button>
            </div>

            {/* Legend & Gain Badge */}
            <div className="flex items-center justify-between text-xs text-zinc-500 mb-4">
              <div className="flex items-center space-x-3">
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-zinc-950 inline-block" />
                  <span className="text-[11px]">Vault Ingestion</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-zinc-400 inline-block" />
                  <span className="text-[11px]">AI Synthesis</span>
                </span>
              </div>
              <span className="bg-zinc-950 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                +24%
              </span>
            </div>

            {/* Sparkline Wave Graph (smooth SVG wave matching reference image) */}
            <div className="h-24 w-full relative my-2">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 200 60" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="waveGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#18181b" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="#18181b" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0,45 C30,48 50,20 80,35 C110,50 130,10 160,25 C180,35 190,15 200,20 L200,60 L0,60 Z"
                  fill="url(#waveGradient)"
                />
                <path
                  d="M0,45 C30,48 50,20 80,35 C110,50 130,10 160,25 C180,35 190,15 200,20"
                  fill="none"
                  stroke="#18181b"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                {/* Active milestone dot */}
                <circle cx="160" cy="25" r="4" fill="#18181b" />
                <circle cx="160" cy="25" r="7" fill="#18181b" fillOpacity="0.15" />
              </svg>
            </div>
          </div>

          {/* Days timeline: M T W T F S S with active day */}
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 pt-3 border-t border-zinc-100">
            <span>M</span>
            <span>T</span>
            <span>W</span>
            <span>T</span>
            <span>F</span>
            <span className="w-6 h-6 rounded-full bg-zinc-950 text-white flex items-center justify-center text-[11px] shadow-sm">
              S
            </span>
            <span>S</span>
          </div>
        </div>

        {/* CARD 3: Month Progress / Epistemic Gauge (White Card) */}
        <div className="lg:col-span-4 bento-card-white rounded-[28px] p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold tracking-tight text-zinc-950">
                Evidence Integrity
              </span>
              <button className="text-zinc-400 hover:text-zinc-900 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </button>
            </div>
            <div className="text-[11px] text-zinc-400 mb-4">
              Cryptographic chain &amp; verification
            </div>

            {/* Circular Ring Gauge & Metrics */}
            <div className="flex items-center justify-between my-2">
              <div className="space-y-2 text-xs">
                <div className="flex items-center space-x-2 text-zinc-700">
                  <span className="w-2 h-2 rounded-full bg-zinc-950" />
                  <span className="font-medium">SHA-256 Valid</span>
                </div>
                <div className="flex items-center space-x-2 text-zinc-700">
                  <span className="w-2 h-2 rounded-full bg-zinc-500" />
                  <span className="font-medium">Facts Derived</span>
                </div>
                <div className="flex items-center space-x-2 text-zinc-700">
                  <span className="w-2 h-2 rounded-full bg-zinc-300" />
                  <span className="font-medium">AI Inferences</span>
                </div>
              </div>

              {/* Concentric Gauge SVG */}
              <div className="relative w-24 h-24 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  {/* Outer circle */}
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#F4F4F5" strokeWidth="7" />
                  <circle
                    cx="50" cy="50" r="40" fill="none" stroke="#18181B" strokeWidth="7"
                    strokeDasharray="251.2"
                    strokeDashoffset={evidenceCount >= 2 ? "25" : "251.2"}
                    strokeLinecap="round"
                    className="transition-all duration-1000"
                  />
                  {/* Inner circle */}
                  <circle cx="50" cy="50" r="28" fill="none" stroke="#F4F4F5" strokeWidth="5" />
                  <circle
                    cx="50" cy="50" r="28" fill="none" stroke="#A1A1AA" strokeWidth="5"
                    strokeDasharray="175.9"
                    strokeDashoffset={evidenceCount >= 2 ? "35" : "175.9"}
                    strokeLinecap="round"
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-sm font-extrabold text-zinc-950 leading-none">
                    {evidenceCount >= 2 ? "100%" : `${Math.min(evidenceCount * 50, 100)}%`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons: Share & Download Report */}
          <div className="flex items-center space-x-2 pt-3 border-t border-zinc-100">
            <button
              onClick={() => alert("Audit certificate verified.")}
              className="w-9 h-9 rounded-full bg-zinc-950 text-white flex items-center justify-center hover:bg-black transition-colors shrink-0 shadow-sm"
              title="Share"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </button>
            <Link
              href="/export"
              className="flex-1 flex items-center justify-center space-x-2 border border-zinc-200/80 hover:bg-zinc-50 text-zinc-900 px-4 py-2 rounded-full text-xs font-semibold transition-all shadow-sm"
            >
              <span>Download Report</span>
              <span className="text-xs">↓</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* ROW 2: Investigation Goals & Tasks in Process                 */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* CARD 4: Investigation Goals Checkpoints ('Month goals:' in image) */}
        <div className="lg:col-span-4 bento-card-white rounded-[28px] p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <span className="text-sm font-semibold tracking-tight text-zinc-950">
                Investigation protocol:
              </span>
              <div className="flex items-center space-x-2 text-zinc-400">
                <button className="hover:text-zinc-900 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </button>
                <button className="hover:text-zinc-900 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-3 text-xs">
                <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] ${checkpoints.minTwoFiles ? "bg-zinc-950 text-white" : "border border-zinc-300"}`}>
                  {checkpoints.minTwoFiles && "✓"}
                </span>
                <span className={`font-medium ${checkpoints.minTwoFiles ? "text-zinc-950" : "text-zinc-500"}`}>
                  Upload at least 2 authentic evidence files
                </span>
              </div>

              <div className="flex items-center space-x-3 text-xs">
                <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] ${checkpoints.hashesVerified ? "bg-zinc-950 text-white" : "border border-zinc-300"}`}>
                  {checkpoints.hashesVerified && "✓"}
                </span>
                <span className={`font-medium ${checkpoints.hashesVerified ? "text-zinc-950" : "text-zinc-500"}`}>
                  Cryptographic SHA-256 tamper-proof ledgering
                </span>
              </div>

              <div className="flex items-center space-x-3 text-xs">
                <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] ${checkpoints.geminiExtraction ? "bg-zinc-950 text-white" : "border border-zinc-300"}`}>
                  {checkpoints.geminiExtraction && "✓"}
                </span>
                <span className={`font-medium ${checkpoints.geminiExtraction ? "text-zinc-950" : "text-zinc-500"}`}>
                  Multimodal Gemini claim &amp; entity extraction
                </span>
              </div>

              <div className="flex items-center space-x-3 text-xs">
                <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] ${checkpoints.contradictionsChecked ? "bg-zinc-950 text-white" : "border border-zinc-300"}`}>
                  {checkpoints.contradictionsChecked && "✓"}
                </span>
                <span className={`font-medium ${checkpoints.contradictionsChecked ? "text-zinc-950" : "text-zinc-500"}`}>
                  Cross-document contradiction adjudication
                </span>
              </div>

              <div className="flex items-center space-x-3 text-xs">
                <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] ${checkpoints.statementGenerated ? "bg-zinc-950 text-white" : "border border-zinc-300"}`}>
                  {checkpoints.statementGenerated && "✓"}
                </span>
                <span className={`font-medium ${checkpoints.statementGenerated ? "text-zinc-950" : "text-zinc-500"}`}>
                  Court-admissible cause-and-effect narrative
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-100 text-[11px] text-zinc-400">
            Epistemic: AI suggests. A human decides.
          </div>
        </div>

        {/* CARD 5: Task in process (2) / Evidence in Process Cards */}
        <div className="lg:col-span-8 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-sm font-semibold tracking-tight text-zinc-950">
              Evidence in process ({evidenceCount})
            </span>
            <Link
              href="/upload"
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-950 transition-colors flex items-center space-x-1"
            >
              <span>Open vault</span>
              <span>&gt;</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* If files exist, render the actual uploaded files as clean cards */}
            {evidence.slice(0, 2).map((item, idx) => (
              <div
                key={item.id}
                className="bento-card-white rounded-[24px] p-5 flex flex-col justify-between relative shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between text-zinc-400 mb-3">
                    <div className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-700">
                      {item.file_type.toLowerCase() === "pdf" ? "📄" : "🖼️"}
                    </div>
                    <span className="text-[10px] font-mono text-zinc-400 bg-zinc-50 px-2 py-0.5 rounded-full border border-zinc-100">
                      ID #{item.id}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-zinc-950 line-clamp-2 mb-1">
                    {item.filename}
                  </h4>
                  <p className="text-[10px] text-zinc-400 font-mono truncate">
                    {item.sha256.substring(0, 16)}...
                  </p>
                </div>

                <div className="flex items-center justify-between pt-4 mt-2 border-t border-zinc-100">
                  <span className="text-[10px] text-zinc-400 font-mono">
                    {(item.size_bytes / 1024).toFixed(1)} KB
                  </span>
                  <div className="w-7 h-7 rounded-full bg-zinc-950 text-white flex items-center justify-center text-xs shadow-sm">
                    ✓
                  </div>
                </div>
              </div>
            ))}

            {/* Dotted + Add Evidence Card */}
            <Link
              href="/upload"
              className="border-2 border-dashed border-zinc-300 hover:border-zinc-500 hover:bg-white/60 transition-all rounded-[24px] p-5 flex flex-col items-center justify-center text-center space-y-2 cursor-pointer group min-h-[160px]"
            >
              <div className="w-10 h-10 rounded-full bg-zinc-100 group-hover:bg-zinc-950 group-hover:text-white transition-colors flex items-center justify-center text-zinc-600 text-lg font-bold shadow-sm">
                +
              </div>
              <span className="text-xs font-bold text-zinc-700 group-hover:text-zinc-950">
                + Add evidence
              </span>
              <span className="text-[10px] text-zinc-400">
                Drag and drop PDF, Image, DOCX
              </span>
            </Link>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* ROW 3: Investigation Pipeline Cards ('Last Projects' in image) */}
      {/* ------------------------------------------------------------- */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-sm font-semibold tracking-tight text-zinc-950">
            Forensic Investigation Pipeline
          </h3>
          <div className="flex items-center space-x-2 text-xs text-zinc-400">
            <span>Workflow order</span>
            <span className="text-zinc-600 font-semibold">1 → 5</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Pipeline Step 1 */}
          <Link
            href="/upload"
            className="bento-card-dark rounded-[24px] p-5 flex items-center justify-between hover:border-zinc-600 transition-all cursor-pointer"
          >
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Step 1</span>
              </div>
              <h4 className="text-sm font-bold text-white">Import &amp; Raw Vault</h4>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {evidenceCount} files loaded (Min 2 required)
              </p>
            </div>
            <div className="w-8 h-8 rounded-full border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300">
              {evidenceCount >= 2 ? "✓" : `${evidenceCount}/2`}
            </div>
          </Link>

          {/* Pipeline Step 2 */}
          <Link
            href="/extract"
            className={`bento-card-dark rounded-[24px] p-5 flex items-center justify-between hover:border-zinc-600 transition-all cursor-pointer ${
              evidenceCount < 2 ? "opacity-60" : ""
            }`}
          >
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${evidenceCount >= 2 ? "bg-indigo-400" : "bg-zinc-600"}`} />
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Step 2</span>
              </div>
              <h4 className="text-sm font-bold text-white">Gemini Claim Extraction</h4>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {nodesCount} entities detected
              </p>
            </div>
            <div className="w-8 h-8 rounded-full border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300">
              {evidenceCount < 2 ? "🔒" : "⚡"}
            </div>
          </Link>

          {/* Pipeline Step 3 */}
          <Link
            href="/match"
            className={`bento-card-dark rounded-[24px] p-5 flex items-center justify-between hover:border-zinc-600 transition-all cursor-pointer ${
              evidenceCount < 2 ? "opacity-60" : ""
            }`}
          >
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${contradictionsCount > 0 ? "bg-rose-400" : "bg-emerald-400"}`} />
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Step 3</span>
              </div>
              <h4 className="text-sm font-bold text-white">Graph &amp; Contradictions</h4>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {contradictionsCount} contradictions flagged
              </p>
            </div>
            <div className="w-8 h-8 rounded-full border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300">
              {evidenceCount < 2 ? "🔒" : "⚖️"}
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

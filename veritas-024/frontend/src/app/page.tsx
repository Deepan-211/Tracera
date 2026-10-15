"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  EvidenceItem,
  ExtractedClaim,
  TamperFlag,
  Contradiction,
  AuditEntry,
  TimelineEvent,
  GraphData,
  getHealth,
  getEvidenceList,
  getEvidenceDetail,
  uploadEvidenceFile,
  resetSeedCase,
  triggerAnalyze,
  getTimeline,
  getGraph,
  getContradictions,
  reviewContradiction,
  getAuditChain,
  API_URL,
} from "./api";
import VaultPane from "./VaultPane";
import InspectorPane from "./InspectorPane";
import TimelineGraphPane from "./TimelineGraphPane";
import AuditPane from "./AuditPane";

export default function WorkbenchPage() {
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>([]);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<number | null>(null);
  const [selectedEvidenceDetail, setSelectedEvidenceDetail] = useState<{
    evidence: EvidenceItem | null;
    claims: ExtractedClaim[];
    tamperFlags: TamperFlag[];
    contentPreview?: string;
  }>({
    evidence: null,
    claims: [],
    tamperFlags: [],
    contentPreview: "",
  });

  const [selectedClaimId, setSelectedClaimId] = useState<number | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [], clusters: [] });
  const [contradictions, setContradictions] = useState<Contradiction[]>([]);
  const [auditChain, setAuditChain] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [backendHealth, setBackendHealth] = useState<string>("connecting...");

  // Load baseline data
  const refreshAllData = useCallback(async () => {
    try {
      const [health, items, timeline, graph, contra, audit] = await Promise.all([
        getHealth().catch(() => ({ status: "offline", app: "VERITAS-024", version: "1.0.0", database: "", banner: "" })),
        getEvidenceList().catch(() => []),
        getTimeline().catch(() => ({ events: [], unplaced: [] })),
        getGraph().catch(() => ({ nodes: [], edges: [], clusters: [] })),
        getContradictions().catch(() => []),
        getAuditChain().catch(() => []),
      ]);

      setBackendHealth(health.status);
      setEvidenceList(items);
      setTimelineEvents(timeline.events || []);
      setGraphData(graph);
      setContradictions(contra);
      setAuditChain(audit);

      if (items.length > 0 && selectedEvidenceId === null) {
        setSelectedEvidenceId(items[0].id);
      }
    } catch (err) {
      console.error("Failed to load initial data:", err);
    }
  }, [selectedEvidenceId]);

  useEffect(() => {
    refreshAllData();
  }, [refreshAllData]);

  // When selectedEvidenceId changes, fetch item details
  useEffect(() => {
    if (selectedEvidenceId === null) return;
    let isMounted = true;
    getEvidenceDetail(selectedEvidenceId)
      .then((detail) => {
        if (!isMounted) return;
        setSelectedEvidenceDetail({
          evidence: detail.evidence,
          claims: detail.claims || [],
          tamperFlags: detail.tamper_flags || [],
          contentPreview: detail.content_preview || "",
        });
      })
      .catch((err) => {
        console.error("Failed to fetch detail for evidence", selectedEvidenceId, err);
      });
    return () => {
      isMounted = false;
    };
  }, [selectedEvidenceId]);

  // Lookup map for claim objects by ID
  const claimsLookup = useMemo(() => {
    const map: Record<number, ExtractedClaim> = {};
    for (const c of selectedEvidenceDetail.claims) {
      map[c.id] = c;
    }
    return map;
  }, [selectedEvidenceDetail.claims]);

  // Handlers
  const handleSelectEvidence = (id: number) => {
    setSelectedEvidenceId(id);
    setSelectedClaimId(null);
  };

  const handleUpload = async (file: File) => {
    setIsLoading(true);
    try {
      const item = await uploadEvidenceFile(file);
      await refreshAllData();
      setSelectedEvidenceId(item.id);
    } catch (err: any) {
      alert(`Upload error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadSeedCase = async () => {
    setIsLoading(true);
    try {
      await resetSeedCase();
      await triggerAnalyze();
      await refreshAllData();
    } catch (err: any) {
      console.error("Seed case load error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReviewContradiction = async (
    id: number,
    decision: "accepted" | "rejected" | "needs_more_info",
    note?: string
  ) => {
    try {
      await reviewContradiction(id, decision, note);
      const [updatedContra, updatedAudit] = await Promise.all([
        getContradictions(),
        getAuditChain(),
      ]);
      setContradictions(updatedContra);
      setAuditChain(updatedAudit);
    } catch (err: any) {
      alert(`Review action failed: ${err.message}`);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-42px)] overflow-hidden">
      {/* Workbench Subheader Toolbar */}
      <div className="bg-desk border-b border-rule px-4 py-1.5 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center space-x-3">
          <span className="font-semibold text-ink">SYSTEM STATUS:</span>
          <span
            className={`px-2 py-0.5 border ${
              backendHealth === "ok"
                ? "border-fact text-fact bg-white font-bold"
                : "border-stamp text-stamp bg-white font-bold"
            }`}
          >
            BACKEND: {backendHealth.toUpperCase()}
          </span>
          <span className="text-ink/60">DB: WAL / SQLITE</span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setIsLoading(true);
              triggerAnalyze().then(refreshAllData).finally(() => setIsLoading(false));
            }}
            disabled={isLoading || evidenceList.length === 0}
            className="border border-ink bg-paper px-2.5 py-0.5 hover:bg-desk active:translate-y-px uppercase font-semibold disabled:opacity-50"
          >
            RUN INVESTIGATION ENGINE
          </button>
          <a
            href={`${API_URL}/api/report`}
            target="_blank"
            rel="noreferrer"
            className="border border-ink bg-paper px-2.5 py-0.5 hover:bg-desk active:translate-y-px uppercase font-semibold"
          >
            EXPORT REPORT
          </a>
        </div>
      </div>

      {/* Main 3-Column Workbench */}
      <div className="flex-1 grid grid-cols-12 min-h-0 overflow-hidden">
        {/* Left Column: Vault (Width 3/12) */}
        <div className="col-span-3 h-full overflow-hidden">
          <VaultPane
            evidenceList={evidenceList}
            selectedEvidenceId={selectedEvidenceId}
            onSelectEvidence={handleSelectEvidence}
            onUpload={handleUpload}
            onLoadSeedCase={handleLoadSeedCase}
            isLoading={isLoading}
          />
        </div>

        {/* Center Column: Inspector Paper Sheet (Width 5/12) */}
        <div className="col-span-5 h-full overflow-hidden">
          <InspectorPane
            evidence={selectedEvidenceDetail.evidence}
            claims={selectedEvidenceDetail.claims}
            tamperFlags={selectedEvidenceDetail.tamperFlags}
            contentPreview={selectedEvidenceDetail.contentPreview}
            selectedClaimId={selectedClaimId}
            onSelectClaim={(id) => setSelectedClaimId(id)}
          />
        </div>

        {/* Right Column: Timeline & Relationship Graph (Width 4/12) */}
        <div className="col-span-4 h-full overflow-hidden">
          <TimelineGraphPane
            timelineEvents={timelineEvents}
            graphData={graphData}
            onSelectEvidence={handleSelectEvidence}
            claimsLookup={claimsLookup}
          />
        </div>
      </div>

      {/* Bottom Drawer: Contradictions & Audit Log */}
      <AuditPane
        contradictions={contradictions}
        auditChain={auditChain}
        onReviewContradiction={handleReviewContradiction}
        onRefreshAudit={async () => {
          const audit = await getAuditChain();
          setAuditChain(audit);
        }}
      />
    </div>
  );
}

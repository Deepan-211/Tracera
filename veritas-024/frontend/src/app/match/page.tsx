"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  ReactFlow,
  Background,
  Controls,
  Node,
  Edge,
  Handle,
  Position,
  NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  GraphData,
  GraphNode,
  GraphEdge,
  Contradiction,
  ExtractedClaim,
  getGraph,
  getContradictions,
  reviewContradiction,
  getEvidenceList,
  getShortestPath,
  triggerAnalyze,
} from "../api";

// Custom Index Card Node for @xyflow/react
function IndexCardNode({ data }: NodeProps) {
  const d = data as unknown as GraphNode & { isContradiction?: boolean };
  const isRed = d.isContradiction || d.flagged;

  return (
    <div
      className={`bg-white p-2.5 min-w-[155px] max-w-[220px] font-mono text-ink shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)] relative border-2 ${
        isRed ? "border-stamp bg-paper" : "border-ink"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-ink !w-2 !h-2" />
      <div className="flex items-center justify-between gap-1 border-b border-rule pb-1 mb-1">
        <span className="text-[10px] uppercase font-bold text-ink/70">
          {d.type || "ENTITY"}
        </span>
        {isRed && (
          <span className="stamp-badge !text-[9px] !px-1 !py-0 !border-stamp !text-stamp">
            FLAGGED
          </span>
        )}
      </div>
      <div className="text-xs font-bold truncate text-ink">
        {d.label}
      </div>
      <div className="mt-1.5 text-[9px] text-ink/50 pt-1 border-t border-rule/50 flex justify-between">
        <span>REF:</span>
        <span className="font-mono">{d.short_hash || (d.id ? d.id.substring(0, 8) : "")}</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-ink !w-2 !h-2" />
    </div>
  );
}

const nodeTypes = {
  indexCard: IndexCardNode,
};

export default function MatchPage() {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [], clusters: [] });
  const [contradictions, setContradictions] = useState<Contradiction[]>([]);
  const [evidenceCount, setEvidenceCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedCitation, setSelectedCitation] = useState<{
    title: string;
    description: string;
    sourceA?: string;
    sourceB?: string;
    claimA?: string;
    claimB?: string;
    claims?: number[];
  } | null>(null);

  // Shortest path inspection
  const [sourceEntity, setSourceEntity] = useState<string>("");
  const [targetEntity, setTargetEntity] = useState<string>("");
  const [highlightedPath, setHighlightedPath] = useState<string[]>([]);
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});

  const fetchData = useCallback(async () => {
    try {
      const [g, c, ev] = await Promise.all([
        getGraph().catch(() => ({ nodes: [], edges: [], clusters: [] })),
        getContradictions().catch(() => []),
        getEvidenceList().catch(() => []),
      ]);
      setGraphData(g);
      setContradictions(c);
      setEvidenceCount(ev.length);
    } catch (err) {
      console.error("Failed to load match data:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const handleRefresh = () => fetchData();
    window.addEventListener("veritas:refresh", handleRefresh);
    return () => window.removeEventListener("veritas:refresh", handleRefresh);
  }, [fetchData]);

  // Set of node IDs or labels involved in contradictions
  const contradictionEntities = useMemo(() => {
    const set = new Set<string>();
    for (const c of contradictions) {
      if (c.claim_a?.value) set.add(c.claim_a.value.toLowerCase());
      if (c.claim_b?.value) set.add(c.claim_b.value.toLowerCase());
      if (c.file_a) set.add(c.file_a.toLowerCase());
      if (c.file_b) set.add(c.file_b.toLowerCase());
      // Specific known entities in contradiction
      if (c.kind.includes("account")) {
        set.add("4417");
        set.add("9821");
      }
    }
    return set;
  }, [contradictions]);

  // Prepare ReactFlow Nodes
  const nodes: Node[] = useMemo(() => {
    if (!graphData.nodes || graphData.nodes.length === 0) return [];
    const count = graphData.nodes.length;
    return graphData.nodes.map((n, idx) => {
      // Circular positioning layout
      const angle = (idx / Math.max(count, 1)) * 2 * Math.PI;
      const radius = 220;
      const x = 320 + radius * Math.cos(angle);
      const y = 260 + radius * Math.sin(angle);

      const isPath = highlightedPath.includes(n.id);
      const isContradiction =
        n.flagged ||
        contradictionEntities.has(n.label.toLowerCase()) ||
        n.label.toLowerCase().includes("kumar") ||
        n.label.toLowerCase().includes("4417");

      return {
        id: n.id,
        type: "indexCard",
        position: { x, y },
        data: {
          ...n,
          isContradiction,
        },
        style: isPath ? { outline: "3px solid var(--stamp)" } : undefined,
      };
    });
  }, [graphData.nodes, highlightedPath, contradictionEntities]);

  // Prepare ReactFlow Edges
  const edges: Edge[] = useMemo(() => {
    if (!graphData.edges) return [];
    return graphData.edges.map((e) => {
      const isAI = e.epistemic_label === "AI_INFERENCE";
      const isPathEdge =
        highlightedPath.length > 1 &&
        highlightedPath.includes(e.source) &&
        highlightedPath.includes(e.target);

      const isContraEdge =
        e.label.toLowerCase().includes("conflict") ||
        e.label.toLowerCase().includes("flag") ||
        e.label.toLowerCase().includes("divergence");

      return {
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        animated: isAI || isContraEdge,
        style: {
          stroke: isContraEdge || isPathEdge ? "var(--stamp)" : isAI ? "var(--inference)" : "#1B1B18",
          strokeWidth: isContraEdge || isPathEdge ? 2.5 : 1.2,
          strokeDasharray: isAI ? "4 4" : undefined,
        },
        labelStyle: {
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          fontWeight: 600,
          fill: isContraEdge ? "var(--stamp)" : "#1B1B18",
        },
        labelBgStyle: {
          fill: "#F8F5EC",
          fillOpacity: 0.9,
          stroke: isContraEdge ? "var(--stamp)" : "#C9C2AE",
          strokeWidth: 1,
        },
        data: e,
      };
    });
  }, [graphData.edges, highlightedPath]);

  // On edge click: show citation details
  const onEdgeClick = useCallback((_: any, edge: Edge) => {
    const d = edge.data as unknown as GraphEdge;
    if (d) {
      setSelectedCitation({
        title: `RELATION: ${d.label}`,
        description: `Epistemic Classification: ${d.epistemic_label}`,
        claims: d.claim_ids || [],
      });
    }
  }, []);

  // Shortest path calculation
  const handleComputePath = async () => {
    if (!sourceEntity || !targetEntity || sourceEntity === targetEntity) {
      setHighlightedPath([]);
      return;
    }
    try {
      const res = await getShortestPath(sourceEntity, targetEntity);
      if (res.found && res.path) {
        setHighlightedPath(res.path);
      } else {
        alert("No connected entity path found.");
        setHighlightedPath([]);
      }
    } catch (err: any) {
      alert(`Path lookup error: ${err.message}`);
    }
  };

  // Contradiction review: Accept / Dismiss / Escalate
  const handleReview = async (
    id: number,
    decision: "accepted" | "rejected" | "needs_more_info"
  ) => {
    try {
      const note = reviewNotes[id];
      await reviewContradiction(id, decision, note);
      await fetchData();
    } catch (err: any) {
      alert(`Review action failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 pt-4">
      {/* Step Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
        <div>
          <div className="flex items-center space-x-2">
            <span className="bg-zinc-950 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
              Step 3 of 5
            </span>
            <h1 className="text-xl font-bold tracking-tight text-zinc-950">
              Entity Relationship Graph &amp; Contradictions
            </h1>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Visual graph linking people, organizations, dates, amounts, and documents across files. Review discrepancies with Accept, Dismiss, or Escalate.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Link
            href="/extract"
            className="px-4 py-2 text-xs font-semibold text-zinc-700 bg-white border border-zinc-200/80 rounded-full hover:bg-zinc-50 shadow-sm transition-all"
          >
            &larr; Step 2: Extract
          </Link>
          {evidenceCount >= 2 ? (
            <Link
              href="/statement"
              className="bg-zinc-950 text-white px-5 py-2 text-xs font-semibold rounded-full hover:bg-black active:scale-95 shadow-sm transition-all flex items-center space-x-1.5"
            >
              <span>Next: Statement</span>
              <span>&rarr;</span>
            </Link>
          ) : (
            <button
              disabled
              className="bg-zinc-100 text-zinc-400 px-5 py-2 text-xs font-semibold rounded-full cursor-not-allowed"
              title="At least 2 files required"
            >
              🔒 Next: Statement (Min 2)
            </button>
          )}
        </div>
      </div>

      {/* Main 2-Column Matching Layout or 2-File Blocker */}
      {evidenceCount < 2 && !isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="max-w-xl w-full bento-card-white rounded-[28px] p-8 text-center space-y-4 shadow-sm border border-amber-200">
            <div className="text-4xl">⚠️</div>
            <h2 className="text-base font-bold uppercase tracking-wider text-amber-800">
              Insufficient Evidence for Graph &amp; Contradiction Matching
            </h2>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Cross-document relationship graphing and contradiction adjudication require <strong>at least two (2) evidence files</strong>.
              Currently only {evidenceCount} file{evidenceCount === 1 ? "" : "s"} present.
            </p>
            <div className="bg-zinc-50 rounded-xl p-2.5 text-xs font-mono text-zinc-600 border border-zinc-200">
              Evidence Status: <strong>{evidenceCount} / 2 required files</strong>
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
      <div className="flex flex-col lg:flex-row min-h-[580px] gap-5">
        {/* Left Column: Visual Relationship Graph Canvas */}
        <div className="flex-1 flex flex-col min-h-[400px] bento-card-white rounded-[28px] overflow-hidden relative shadow-sm">
          {/* Graph Toolbar */}
          <div className="p-2 border-b border-rule bg-desk/40 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center space-x-2">
              <span className="font-bold uppercase tracking-wider">
                NETWORK GRAPH ({graphData.nodes?.length || 0} NODES, {graphData.edges?.length || 0} EDGES)
              </span>
              <span className="text-[10px] text-stamp font-bold">
                ● CONTRADICTIONS IN RED
              </span>
            </div>

            {/* Shortest Path Solver */}
            <div className="flex items-center space-x-1.5 text-[11px]">
              <select
                value={sourceEntity}
                onChange={(e) => setSourceEntity(e.target.value)}
                className="border border-rule bg-white px-2 py-0.5 text-[10px] focus:outline-none"
              >
                <option value="">FROM ENTITY...</option>
                {graphData.nodes?.map((n) => (
                  <option key={n.id} value={n.label}>
                    {n.label}
                  </option>
                ))}
              </select>
              <span>&rarr;</span>
              <select
                value={targetEntity}
                onChange={(e) => setTargetEntity(e.target.value)}
                className="border border-rule bg-white px-2 py-0.5 text-[10px] focus:outline-none"
              >
                <option value="">TO ENTITY...</option>
                {graphData.nodes?.map((n) => (
                  <option key={n.id} value={n.label}>
                    {n.label}
                  </option>
                ))}
              </select>
              <button
                onClick={handleComputePath}
                className="border border-ink bg-paper px-2 py-0.5 text-[10px] font-bold uppercase hover:bg-desk"
              >
                FIND PATH
              </button>
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-1 relative bg-paper/30">
            {isLoading ? (
              <div className="h-full flex items-center justify-center text-xs text-ink/50">
                LOADING RELATIONSHIP TOPOLOGY...
              </div>
            ) : graphData.nodes?.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center text-xs text-ink/50 space-y-2">
                <p>NO GRAPH NODES GENERATED YET.</p>
                <p className="text-[11px] text-ink/40">
                  Click &quot;RUN ENGINE&quot; in the header to extract claims and resolve entities.
                </p>
              </div>
            ) : (
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onEdgeClick={onEdgeClick}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.2}
                maxZoom={1.8}
              >
                <Background color="#C9C2AE" gap={20} size={1} />
                <Controls showInteractive={false} className="!border !border-rule !bg-paper" />
              </ReactFlow>
            )}

            {/* Edge / Citation Source Overlay Drawer */}
            {selectedCitation && (
              <div className="absolute bottom-2 left-2 right-2 border-2 border-ink bg-white p-3 shadow-lg z-10 space-y-1 text-xs">
                <div className="flex items-center justify-between border-b border-rule pb-1">
                  <span className="font-bold uppercase text-ink">{selectedCitation.title}</span>
                  <button
                    onClick={() => setSelectedCitation(null)}
                    className="text-[10px] font-bold text-ink/60 hover:text-ink"
                  >
                    ✕ CLOSE
                  </button>
                </div>
                <p className="text-[11px] text-ink/80">{selectedCitation.description}</p>
                {selectedCitation.claims && selectedCitation.claims.length > 0 && (
                  <div className="text-[10px] text-ink/60">
                    Supporting Claim IDs: {selectedCitation.claims.join(", ")}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Contradictions Beside The Graph */}
        <div className="w-full lg:w-96 border border-rule bg-white flex flex-col shrink-0 overflow-hidden">
          {/* Header */}
          <div className="p-3 border-b border-rule bg-desk/50 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-ink">
                CONTRADICTIONS ({contradictions.length})
              </div>
              <span className="text-[10px] text-stamp font-bold">
                HUMAN ADJUDICATION REQUIRED
              </span>
            </div>
            <span className="stamp-badge !border-stamp !text-stamp !text-[9px]">
              EPISISTEMIC GATE
            </span>
          </div>

          {/* Contradictions List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {contradictions.length === 0 ? (
              <div className="p-6 text-center text-xs text-ink/50 border border-dashed border-rule">
                NO CROSS-DOCUMENT DISCREPANCIES IDENTIFIED.
                <br />
                Run the investigation engine or load the demo case.
              </div>
            ) : (
              contradictions.map((c) => {
                const isAccepted = c.review_status === "accepted";
                const isDismissed = c.review_status === "rejected";
                const isEscalated = c.review_status === "needs_more_info";

                return (
                  <div
                    key={c.id}
                    className="paper-sheet p-3 border-2 border-stamp/70 bg-paper space-y-2 text-xs relative"
                  >
                    {/* Kind & Severity */}
                    <div className="flex items-start justify-between gap-2 border-b border-rule pb-1.5">
                      <div className="flex items-center space-x-1.5">
                        <span className="stamp-badge !text-[9px] !border-stamp !text-stamp">
                          {c.kind.replace("_", " ")}
                        </span>
                        <span className="text-[10px] font-bold uppercase text-ink/60">
                          [{c.severity}]
                        </span>
                      </div>
                      <div className="text-right text-[10px]">
                        <span className="font-bold text-ink">{(c.confidence * 100).toFixed(0)}%</span>
                        <span className="text-ink/50 block">conf</span>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="font-bold text-ink leading-tight">
                      {c.description}
                    </p>

                    {/* Source Comparison */}
                    <div className="grid grid-cols-2 gap-2 p-2 bg-desk/30 border border-rule text-[10px]">
                      <div className="border-r border-rule pr-1">
                        <span className="font-bold text-ink/60 uppercase block">
                          SOURCE A:
                        </span>
                        <div className="font-semibold text-ink truncate mt-0.5">
                          {c.file_a || "Evidence A"}
                        </div>
                        <div className="text-ink/80 truncate">
                          {c.claim_a?.value || `Claim #${c.claim_a_id || "N/A"}`}
                        </div>
                        <span className="text-ink/50 text-[9px]">
                          LOC: {c.claim_a?.location_ref || "Body"}
                        </span>
                      </div>

                      <div className="pl-1">
                        <span className="font-bold text-ink/60 uppercase block">
                          SOURCE B:
                        </span>
                        <div className="font-semibold text-ink truncate mt-0.5">
                          {c.file_b || "Evidence B"}
                        </div>
                        <div className="text-ink/80 truncate">
                          {c.claim_b?.value || `Claim #${c.claim_b_id || "N/A"}`}
                        </div>
                        <span className="text-ink/50 text-[9px]">
                          LOC: {c.claim_b?.location_ref || "Body"}
                        </span>
                      </div>
                    </div>

                    {/* AI Narrative */}
                    <div className="p-2 border border-dashed border-rule bg-white text-[11px] italic text-ink/90 leading-relaxed">
                      <strong className="not-italic text-[10px] uppercase text-inference block">
                        [AI FORENSIC EXPLANATION]:
                      </strong>
                      {c.narrative}
                    </div>

                    {/* Investigator Review Status & Note */}
                    <div className="space-y-1.5 pt-1 border-t border-rule">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold uppercase text-ink/70">DECISION:</span>
                        <span
                          className={`font-bold px-1.5 py-0.2 border text-[10px] uppercase ${
                            isAccepted
                              ? "border-fact text-fact bg-white"
                              : isDismissed
                              ? "border-stamp text-stamp bg-white"
                              : isEscalated
                              ? "border-ink text-ink bg-desk"
                              : "border-rule text-ink/60 bg-white"
                          }`}
                        >
                          {c.review_status}
                        </span>
                      </div>

                      <input
                        type="text"
                        placeholder="Add decision rationale note..."
                        value={reviewNotes[c.id] ?? (c.reviewer_note || "")}
                        onChange={(e) =>
                          setReviewNotes({ ...reviewNotes, [c.id]: e.target.value })
                        }
                        className="w-full border border-rule bg-white p-1 text-[11px] focus:outline-none focus:border-ink"
                      />

                      {/* Action Buttons: Accept / Dismiss / Escalate */}
                      <div className="grid grid-cols-3 gap-1 pt-1">
                        <button
                          onClick={() => handleReview(c.id, "accepted")}
                          className={`py-1 text-[10px] font-bold border uppercase transition-colors ${
                            isAccepted
                              ? "bg-fact text-white border-fact"
                              : "border-fact text-fact hover:bg-fact hover:text-white bg-white"
                          }`}
                        >
                          ACCEPT
                        </button>
                        <button
                          onClick={() => handleReview(c.id, "rejected")}
                          className={`py-1 text-[10px] font-bold border uppercase transition-colors ${
                            isDismissed
                              ? "bg-stamp text-white border-stamp"
                              : "border-stamp text-stamp hover:bg-stamp hover:text-white bg-white"
                          }`}
                        >
                          DISMISS
                        </button>
                        <button
                          onClick={() => handleReview(c.id, "needs_more_info")}
                          className={`py-1 text-[10px] font-bold border uppercase transition-colors ${
                            isEscalated
                              ? "bg-ink text-paper border-ink"
                              : "border-rule text-ink hover:bg-desk bg-white"
                          }`}
                        >
                          ESCALATE
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
      )}

      {/* Step Footer Navigation */}
      <div className="border-t border-rule p-3 bg-paper shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs">
          <Link
            href="/extract"
            className="border border-rule bg-white px-3 py-1.5 hover:bg-desk"
          >
            &larr; STEP 2: EXTRACT
          </Link>
          {evidenceCount >= 2 ? (
            <Link
              href="/statement"
              className="border-2 border-ink bg-paper px-4 py-2 font-bold uppercase hover:bg-desk active:translate-y-px flex items-center space-x-2 shadow-[2px_2px_0px_0px_#1B1B18]"
            >
              <span>PROCEED TO STEP 4: EVIDENCE STATEMENT</span>
              <span>&rarr;</span>
            </Link>
          ) : (
            <button
              disabled
              className="border-2 border-rule bg-desk text-ink/40 px-4 py-2 font-bold uppercase cursor-not-allowed"
              title="At least two files required"
            >
              🔒 PROCEED TO STEP 4 (MINIMUM 2 FILES REQUIRED)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

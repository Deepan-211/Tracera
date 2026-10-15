"use client";

import React, { useState, useMemo, useCallback } from "react";
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
import { TimelineEvent, GraphData, GraphNode, GraphEdge, ExtractedClaim } from "./api";

// Custom Index-Card Node for @xyflow/react
function IndexCardNode({ data }: NodeProps) {
  const d = data as unknown as GraphNode;
  return (
    <div className="bg-white border border-ink p-2.5 min-w-[150px] shadow-offset-dark text-ink relative">
      <Handle type="target" position={Position.Top} className="!bg-ink !w-2 !h-2" />
      <div className="flex items-center justify-between gap-1 border-b border-rule pb-1 mb-1.5">
        <span className="text-[10px] font-mono uppercase tracking-wider text-ink/70">
          {d.type || "ENTITY"}
        </span>
        {d.flagged && (
          <span className="stamp-badge !text-[9px] !px-1">FLAG</span>
        )}
      </div>
      <div className="text-xs font-semibold font-sans truncate text-ink">
        {d.label}
      </div>
      <div className="mt-2 text-[9px] font-mono text-ink/50 pt-1 border-t border-rule/50 flex justify-between">
        <span>REF:</span>
        <span className="font-mono">{d.short_hash || d.id.substring(0, 8)}</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-ink !w-2 !h-2" />
    </div>
  );
}

const nodeTypes = {
  indexCard: IndexCardNode,
};

interface TimelineGraphPaneProps {
  timelineEvents: TimelineEvent[];
  graphData: GraphData;
  onSelectEvidence: (evidenceId: number) => void;
  claimsLookup?: Record<number, ExtractedClaim>;
}

export default function TimelineGraphPane({
  timelineEvents,
  graphData,
  onSelectEvidence,
  claimsLookup = {},
}: TimelineGraphPaneProps) {
  const [activeTab, setActiveTab] = useState<"timeline" | "graph">("timeline");
  const [selectedEdgeClaims, setSelectedEdgeClaims] = useState<{
    edgeLabel: string;
    claimIds: number[];
  } | null>(null);

  // Shortest path state
  const [sourceEntity, setSourceEntity] = useState<string>("");
  const [targetEntity, setTargetEntity] = useState<string>("");
  const [highlightedPath, setHighlightedPath] = useState<string[]>([]);

  // Prepare @xyflow nodes and edges
  const nodes: Node[] = useMemo(() => {
    if (!graphData?.nodes) return [];
    const count = graphData.nodes.length;
    return graphData.nodes.map((n, idx) => {
      // Circular or grid layout
      const angle = (idx / Math.max(count, 1)) * 2 * Math.PI;
      const radius = 220;
      const x = 320 + radius * Math.cos(angle);
      const y = 260 + radius * Math.sin(angle);

      const isPath = highlightedPath.includes(n.id);

      return {
        id: n.id,
        type: "indexCard",
        position: { x, y },
        data: n,
        style: isPath ? { outline: "2px solid var(--stamp)" } : undefined,
      };
    });
  }, [graphData?.nodes, highlightedPath]);

  const edges: Edge[] = useMemo(() => {
    if (!graphData?.edges) return [];
    return graphData.edges.map((e) => {
      const isAI = e.epistemic_label === "AI_INFERENCE";
      const isPathEdge =
        highlightedPath.length > 1 &&
        highlightedPath.includes(e.source) &&
        highlightedPath.includes(e.target);

      return {
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        animated: isAI,
        style: {
          stroke: isPathEdge ? "var(--stamp)" : "#1B1B18",
          strokeWidth: isPathEdge ? 2.5 : 1,
          strokeDasharray: isAI ? "4 4" : undefined,
        },
        data: e,
      };
    });
  }, [graphData?.edges, highlightedPath]);

  const onEdgeClick = useCallback((_: any, edge: Edge) => {
    const d = edge.data as unknown as GraphEdge;
    if (d && d.claim_ids) {
      setSelectedEdgeClaims({
        edgeLabel: d.label || "RELATION",
        claimIds: d.claim_ids,
      });
    }
  }, []);

  const handleComputePath = () => {
    if (!sourceEntity || !targetEntity || sourceEntity === targetEntity) {
      setHighlightedPath([]);
      return;
    }
    // BFS on client graphData
    const queue: string[][] = [[sourceEntity]];
    const visited = new Set<string>([sourceEntity]);
    let foundPath: string[] = [];

    while (queue.length > 0) {
      const currentPath = queue.shift()!;
      const current = currentPath[currentPath.length - 1];
      if (current === targetEntity) {
        foundPath = currentPath;
        break;
      }
      const neighbors = graphData.edges
        .filter((e) => e.source === current || e.target === current)
        .map((e) => (e.source === current ? e.target : e.source));

      for (const next of neighbors) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push([...currentPath, next]);
        }
      }
    }
    setHighlightedPath(foundPath);
  };

  return (
    <div className="h-full flex flex-col bg-paper border-l border-rule">
      {/* Folder Tabs Header */}
      <div className="flex items-center border-b border-rule bg-desk px-2 pt-2 gap-1">
        <button
          onClick={() => setActiveTab("timeline")}
          className={`folder-tab ${activeTab === "timeline" ? "active" : ""}`}
        >
          TIMELINE ({timelineEvents.length})
        </button>
        <button
          onClick={() => setActiveTab("graph")}
          className={`folder-tab ${activeTab === "graph" ? "active" : ""}`}
        >
          RELATIONSHIP GRAPH ({graphData?.nodes?.length || 0})
        </button>
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === "timeline" ? (
          <div className="h-full flex flex-col p-4 overflow-y-auto">
            <div className="case-section-header flex items-center justify-between">
              <span>CHRONOLOGICAL AUDIT TRAIL</span>
              <span className="text-[10px] font-mono text-ink/60">ORDERED BY ISO TIMESTAMP</span>
            </div>

            {timelineEvents.length === 0 ? (
              <div className="p-8 text-center text-xs font-mono text-ink/50 border border-rule bg-white">
                NO CHRONOLOGICAL EVENTS LOGGED YET.
                <br />
                RUN INVESTIGATION ENGINE OR SEED DEMO CASE.
              </div>
            ) : (
              <div className="relative border-l border-ink ml-3 space-y-4 my-2 pl-4">
                {timelineEvents.map((evt) => {
                  let badge = "label-extracted-obs";
                  if (evt.label === "VERIFIED_FACT") badge = "label-verified-fact";
                  if (evt.label === "AI_INFERENCE") badge = "label-ai-inference";
                  if (evt.label === "TAMPER_INDICATOR") badge = "label-tamper-indicator";

                  return (
                    <div key={evt.id} className="relative group">
                      {/* Bullet node on timeline line */}
                      <span className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 bg-paper border border-ink" />

                      <div className="paper-sheet p-3 bg-white hover:bg-paper transition-colors">
                        <div className="flex items-center justify-between gap-2 border-b border-rule/60 pb-1 mb-1.5">
                          <span className="font-mono text-xs font-bold text-ink">
                            {evt.date}
                          </span>
                          <span className={badge}>{evt.label}</span>
                        </div>

                        <p className="text-xs font-sans text-ink leading-relaxed">
                          {evt.description}
                        </p>

                        <div className="mt-2 pt-1 border-t border-rule/40 flex items-center justify-between text-[10px] font-mono text-ink/70">
                          <button
                            onClick={() => onSelectEvidence(evt.evidence_id)}
                            className="underline hover:text-ink font-mono font-medium truncate max-w-[200px]"
                          >
                            SRC: {evt.filename}
                          </button>
                          {evt.location_ref && (
                            <span className="bg-desk px-1.5 py-0.5 border border-rule">
                              LOC: {evt.location_ref}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col">
            {/* Graph controls & Shortest Path Toolbar */}
            <div className="p-2 border-b border-rule bg-desk/40 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
              <div className="flex items-center space-x-2">
                <span className="font-semibold">SHORTEST PATH:</span>
                <select
                  value={sourceEntity}
                  onChange={(e) => setSourceEntity(e.target.value)}
                  className="border border-rule bg-white px-2 py-0.5 text-xs font-mono"
                >
                  <option value="">-- FROM --</option>
                  {graphData.nodes?.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.label}
                    </option>
                  ))}
                </select>
                <span>&rarr;</span>
                <select
                  value={targetEntity}
                  onChange={(e) => setTargetEntity(e.target.value)}
                  className="border border-rule bg-white px-2 py-0.5 text-xs font-mono"
                >
                  <option value="">-- TO --</option>
                  {graphData.nodes?.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleComputePath}
                  className="border border-ink bg-paper px-2 py-0.5 hover:bg-desk font-semibold"
                >
                  FIND PATH
                </button>
              </div>

              {highlightedPath.length > 0 && (
                <div className="text-[11px] text-stamp font-bold">
                  PATH FOUND: {highlightedPath.join(" → ")}
                </div>
              )}
            </div>

            {/* React Flow Canvas */}
            <div className="flex-1 relative bg-[#DFDACB]">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onEdgeClick={onEdgeClick}
                fitView
              >
                <Background color="#C9C2AE" gap={16} size={1} />
                <Controls className="!border !border-rule !shadow-none" />
              </ReactFlow>

              {/* Edge Supporting Claims Drawer */}
              {selectedEdgeClaims && (
                <div className="absolute top-2 right-2 max-w-sm w-72 bg-white border border-ink p-3 shadow-offset-dark z-20 font-mono text-xs">
                  <div className="flex items-center justify-between border-b border-rule pb-1 mb-2">
                    <span className="font-bold uppercase">
                      SUPPORTING CLAIMS ({selectedEdgeClaims.claimIds.length})
                    </span>
                    <button
                      onClick={() => setSelectedEdgeClaims(null)}
                      className="font-bold hover:text-stamp"
                    >
                      [X]
                    </button>
                  </div>
                  <div className="text-[11px] text-ink/70 mb-2">
                    RELATION: {selectedEdgeClaims.edgeLabel}
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {selectedEdgeClaims.claimIds.map((cid) => {
                      const claim = claimsLookup[cid];
                      return (
                        <div key={cid} className="p-1.5 border border-rule bg-paper text-[10px]">
                          <div className="font-semibold">CLAIM #{cid}</div>
                          {claim ? (
                            <div>
                              <div className="font-sans text-ink">{claim.value}</div>
                              <div className="text-ink/60 mt-0.5">
                                LOC: {claim.location_ref || "N/A"} | CONF: {(claim.confidence * 100).toFixed(0)}%
                              </div>
                            </div>
                          ) : (
                            <div className="text-ink/60">Extracted fact reference ID {cid}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Strict Epistemic Legend */}
              <div className="absolute bottom-2 left-2 bg-white border border-ink p-2 text-[10px] font-mono space-y-1 z-10 shadow-offset">
                <div className="font-bold border-b border-rule pb-0.5 mb-1 uppercase">
                  EPISTEMIC LABELS
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="label-verified-fact !text-[8px] !px-1">FACT</span>
                  <span>Deterministic (Header / Hash)</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="label-extracted-obs !text-[8px] !px-1">OBS</span>
                  <span>Content Read (OCR / Parser)</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="label-ai-inference !text-[8px] !px-1">AI:INF</span>
                  <span>Hypothesis (Dashed line)</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="stamp-badge !text-[8px] !px-1">STAMP</span>
                  <span>Statistical Anomaly / Discrepancy</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

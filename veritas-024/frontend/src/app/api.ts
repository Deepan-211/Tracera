/**
 * API client and TypeScript definitions for VERITAS-024
 */

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : "http://127.0.0.1:8000");

export type EpistemicLabel =
  | "VERIFIED_FACT"
  | "EXTRACTED_OBSERVATION"
  | "TAMPER_INDICATOR"
  | "AI_INFERENCE";

export interface EvidenceItem {
  id: number;
  filename: string;
  file_type: string;
  sha256: string;
  phash?: string | null;
  size_bytes: number;
  uploaded_at_utc: string;
  vault_path: string;
  source_note?: string | null;
  duplicate_of_id?: number | null;
  meta_json?: string | null;
  tamper_flags?: TamperFlag[];
}

export interface ExtractedClaim {
  id: number;
  evidence_id: number;
  claim_type: "date" | "amount" | "person" | "org" | "location" | "account" | "txn_ref" | "statement";
  value: string;
  normalized_value?: string | null;
  label: EpistemicLabel;
  location_ref?: string | null;
  confidence: number;
  method: "parser" | "gemini" | "rapidocr" | "regex" | "human_correction" | string;
}

export interface TamperFlag {
  id: number;
  evidence_id: number;
  flag_type: string;
  detail: string;
  region_json?: string | null;
  score: number;
  label: "TAMPER_INDICATOR";
}

export interface Contradiction {
  id: number;
  kind: string;
  description: string;
  claim_a_id?: number | null;
  claim_b_id?: number | null;
  severity: "low" | "medium" | "high";
  confidence: number;
  confidence_reason: string;
  narrative: string;
  review_status: "pending" | "accepted" | "rejected" | "needs_more_info";
  reviewer_note?: string | null;
  label: "TAMPER_INDICATOR";
  claim_a?: ExtractedClaim | null;
  claim_b?: ExtractedClaim | null;
  file_a?: string | null;
  file_b?: string | null;
}

export interface AuditEntry {
  id: number;
  timestamp_utc: string;
  actor: "system" | "human";
  action: string;
  target: string;
  detail_json?: string;
  detail?: any;
  prev_hash: string;
  entry_hash: string;
}

export interface GraphNode extends Record<string, any> {
  id: string;
  label: string;
  type: string;
  flagged?: boolean;
  short_hash?: string;
}

export interface GraphEdge extends Record<string, any> {
  id: string;
  source: string;
  target: string;
  label: string;
  epistemic_label: EpistemicLabel;
  claim_ids: number[];
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: string[][];
}

export interface TimelineEvent {
  id: string;
  date: string;
  description: string;
  evidence_id: number;
  filename: string;
  location_ref?: string | null;
  label: EpistemicLabel;
}

export interface HealthResponse {
  status: string;
  app: string;
  version: string;
  database: string;
  banner: string;
}

// Fetch helper with error handling
async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  try {
    const res = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        "Accept": "application/json",
        ...options?.headers,
      },
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`API Error ${res.status}: ${errorText}`);
    }
    return res.json();
  } catch (err: any) {
    if (err.name === "TypeError" && err.message?.includes("Failed to fetch")) {
      console.warn(`Connection error fetching ${API_URL}${endpoint}`);
    }
    throw err;
  }
}

export async function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/api/health");
}

export async function getEvidenceList(): Promise<EvidenceItem[]> {
  const res = await apiFetch<{ evidence: EvidenceItem[] }>("/api/evidence");
  return res.evidence;
}

export async function getEvidenceDetail(id: number): Promise<{
  evidence: EvidenceItem;
  claims: ExtractedClaim[];
  tamper_flags: TamperFlag[];
  content_preview?: string;
}> {
  return apiFetch(`/api/evidence/${id}`);
}

export async function uploadEvidenceFile(file: File, note?: string): Promise<EvidenceItem> {
  const formData = new FormData();
  formData.append("file", file);
  if (note) formData.append("source_note", note);

  const res = await fetch(`${API_URL}/api/evidence/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Upload failed: ${err}`);
  }
  return res.json();
}

export async function deleteEvidence(evidenceId: number): Promise<void> {
  const res = await fetch(`${API_URL}/api/evidence/${evidenceId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Delete failed: ${err}`);
  }
}


export async function triggerAnalyze(): Promise<{ status: string; message: string }> {
  return apiFetch("/api/analyze", { method: "POST" });
}

export async function getTimeline(): Promise<{ events: TimelineEvent[]; unplaced: any[] }> {
  return apiFetch("/api/timeline");
}

export async function getGraph(): Promise<GraphData> {
  return apiFetch("/api/graph");
}

export async function getShortestPath(fromEntity: string, toEntity: string): Promise<{ path: string[]; found: boolean }> {
  return apiFetch(`/api/graph/path?from=${encodeURIComponent(fromEntity)}&to=${encodeURIComponent(toEntity)}`);
}

export async function getContradictions(): Promise<Contradiction[]> {
  const res = await apiFetch<{ contradictions: Contradiction[] }>("/api/contradictions");
  return res.contradictions;
}

export async function reviewContradiction(
  id: number,
  decision: "accepted" | "rejected" | "needs_more_info",
  note?: string
): Promise<Contradiction> {
  return apiFetch(`/api/contradictions/${id}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: jsonStringifySafe({ decision, note }),
  });
}

export async function getAuditChain(): Promise<AuditEntry[]> {
  const res = await apiFetch<{ chain: AuditEntry[] }>("/api/audit");
  return res.chain;
}

export async function verifyAuditChain(): Promise<{
  valid: boolean;
  entries_checked?: number;
  broken_id?: number;
  reason?: string;
  message?: string;
}> {
  return apiFetch("/api/audit/verify");
}

export async function resetSeedCase(): Promise<{ status: string; message: string }> {
  return apiFetch("/api/seed/reset", { method: "POST" });
}

export async function clearCase(): Promise<{ status: string; message: string }> {
  return apiFetch("/api/case/clear", { method: "POST" });
}

export interface StatementSentence {
  sentence: string;
  citation: string;
  type: "verified_fact" | "ai_inference";
  confidence?: number;
}

export interface StatementStep {
  step_number: number;
  title: string;
  description: string;
  sentences: StatementSentence[];
}

export interface VerifiedFactItem {
  fact: string;
  citation: string;
  label: "VERIFIED_FACT";
  evidence_id: number;
}

export interface AIInferenceItem {
  inference: string;
  confidence: number;
  confidence_reason: string;
  citations: string[];
  review_status: string;
  reviewer_note?: string | null;
}

export interface StatementData {
  summary: string;
  steps: StatementStep[];
  verified_facts: VerifiedFactItem[];
  ai_inferences: AIInferenceItem[];
  insufficient_evidence?: boolean;
  evidence_count?: number;
  footer: string;
}

export async function correctClaim(
  claimId: number,
  correctedValue: string,
  note?: string
): Promise<{ status: string; original_claim: ExtractedClaim; corrected_claim: ExtractedClaim; message: string }> {
  return apiFetch(`/api/claims/${claimId}/correct`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ corrected_value: correctedValue, note }),
  });
}

export async function getStatement(): Promise<StatementData> {
  return apiFetch<StatementData>("/api/statement");
}

function jsonStringifySafe(obj: any): string {
  return JSON.stringify(obj);
}


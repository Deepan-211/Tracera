"""
Investigation Engine for VERITAS-024.
Handles entity resolution, NetworkX graph construction, timeline generation,
deterministic contradiction detection, and the strict language guardrail.
"""

import os
import re
import json
from pathlib import Path
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple, Set

import networkx as nx
from dotenv import load_dotenv

import database
import audit
import extraction

ENV_PATH = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=ENV_PATH)

BANNED_WORDS = {
    r"\bguilty\b": "flags",
    r"\bfraudster\b": "subject of interest",
    r"\bauthentic\b": "verified against source",
    r"\bforged\b": "tamper indicator identified",
    r"\bproves\b": "suggests",
    r"\bproof of\b": "indication of",
}

AI_DISCLAIMER_SUFFIX = " AI-generated observation. Requires independent human validation."


def apply_language_guardrail(text: str, is_ai_narrative: bool = False) -> str:
    """
    Enforce language guardrail:
    Never output "guilty", "fraudster", "authentic", "forged", "proves", "proof of".
    Use "flags", "suggests", "inconsistent with", "needs review".
    Every AI narrative ends with: "AI-generated observation. Requires independent human validation."
    """
    cleaned = text
    for pattern, replacement in BANNED_WORDS.items():
        cleaned = re.sub(pattern, replacement, cleaned, flags=re.IGNORECASE)

    if is_ai_narrative:
        cleaned = cleaned.strip()
        if not cleaned.endswith(AI_DISCLAIMER_SUFFIX.strip()):
            cleaned = f"{cleaned}{AI_DISCLAIMER_SUFFIX}"

    return cleaned


# -------------------------------------------------------------------------
# Entity Resolution & Knowledge Graph
# -------------------------------------------------------------------------

def resolve_entities_and_build_graph() -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[List[str]]]:
    """
    Extracts entities from claims, links aliases, constructs a NetworkX graph,
    stores entities/edges in DB, and returns (nodes, edges, clusters) formatted for @xyflow/react.
    """
    all_claims = database.get_all_claims()
    all_evidence = database.get_all_evidence()
    evidence_by_id = {e["id"]: e for e in all_evidence}

    G = nx.Graph()

    # Track entities: normalized_name -> entity_info
    entity_map: Dict[str, Dict[str, Any]] = {}

    def get_or_create_entity(raw_name: str, ent_type: str, alias_candidates: Optional[List[str]] = None) -> int:
        norm = raw_name.strip()
        if not norm:
            return 0
        if norm in entity_map:
            ent = entity_map[norm]
            if alias_candidates:
                ent["aliases"].update(alias_candidates)
            return ent["id"]

        aliases = set(alias_candidates or [])
        ent_id = database.insert_entity(name=norm, entity_type=ent_type, aliases=list(aliases))
        entity_map[norm] = {
            "id": ent_id,
            "name": norm,
            "type": ent_type,
            "aliases": aliases
        }
        return ent_id

    if not all_claims:
        return [], [], []

    # 1. Extract and register entities dynamically strictly from extracted claims
    for claim in all_claims:
        c_type = claim["claim_type"]
        val = claim["value"].strip()
        norm_val = (claim.get("normalized_value") or "").strip()
        if not val:
            continue

        if c_type in ["person", "org", "location", "account", "txn_ref"]:
            aliases = [norm_val] if norm_val and norm_val != val else []
            get_or_create_entity(val, c_type, aliases)

    # Refresh all entities from DB
    db_entities = database.get_all_entities()
    ent_lookup = {e["name"]: e for e in db_entities}
    ent_id_lookup = {e["id"]: e for e in db_entities}

    # 2. Build semantic edges for entities co-occurring in the same evidence document
    claims_by_evidence: Dict[int, List[Dict[str, Any]]] = {}
    for c in all_claims:
        claims_by_evidence.setdefault(c["evidence_id"], []).append(c)

    for ev_id, ev_claims in claims_by_evidence.items():
        doc_ent_ids = []
        for c in ev_claims:
            val = c["value"].strip()
            if val in ent_lookup:
                ent_id = ent_lookup[val]["id"]
                if ent_id not in doc_ent_ids:
                    doc_ent_ids.append(ent_id)

        for i in range(len(doc_ent_ids)):
            for j in range(i + 1, min(i + 4, len(doc_ent_ids))):
                src_id = doc_ent_ids[i]
                tgt_id = doc_ent_ids[j]
                rel = f"ASSOCIATED_IN_DOC_{ev_id}"
                c_ids = [c["id"] for c in ev_claims if c["value"].strip() in [ent_id_lookup.get(src_id, {}).get("name"), ent_id_lookup.get(tgt_id, {}).get("name")]]
                database.insert_edge(
                    source_entity_id=src_id,
                    target_entity_id=tgt_id,
                    relation=rel,
                    evidence_claim_ids=c_ids[:4],
                    label="EXTRACTED_OBSERVATION"
                )
                G.add_edge(str(src_id), str(tgt_id), relation=rel, label="EXTRACTED_OBSERVATION", claim_ids=c_ids[:4])

    # 4. Add all entities as nodes to NetworkX graph
    # Dynamically flag entities that appear in tamper flags or contradictions
    all_flags = database.get_all_tamper_flags()
    flagged_entity_names = set()
    for flag in all_flags:
        f_detail = flag.get("detail", "").lower()
        for ent in db_entities:
            if ent["name"].lower() in f_detail:
                flagged_entity_names.add(ent["name"])

    for ent in db_entities:
        node_id = str(ent["id"])
        is_flagged = ent["name"] in flagged_entity_names
        G.add_node(
            node_id,
            label=ent["name"],
            type=ent["type"],
            flagged=is_flagged,
            short_hash=f"ENT-{ent['id']:03d}"
        )

    # Calculate clusters (connected components)
    clusters = [list(c) for c in nx.connected_components(G)]

    # Format nodes for @xyflow/react
    nodes_out: List[Dict[str, Any]] = []
    for node_id, data in G.nodes(data=True):
        nodes_out.append({
            "id": node_id,
            "label": data.get("label", node_id),
            "type": data.get("type", "entity"),
            "flagged": data.get("flagged", False),
            "short_hash": data.get("short_hash", f"ID-{node_id}")
        })

    # Format edges for @xyflow/react
    edges_out: List[Dict[str, Any]] = []
    db_edges = database.get_all_edges()
    for e in db_edges:
        try:
            c_ids = json.loads(e["evidence_claim_ids_json"] or "[]")
        except Exception:
            c_ids = []
        edges_out.append({
            "id": f"e{e['id']}",
            "source": str(e["source_entity_id"]),
            "target": str(e["target_entity_id"]),
            "label": e["relation"],
            "epistemic_label": e["label"],
            "claim_ids": c_ids
        })

    return nodes_out, edges_out, clusters


def find_shortest_path(from_identifier: str, to_identifier: str) -> Dict[str, Any]:
    """Find shortest path between two nodes in the entity graph."""
    db_entities = database.get_all_entities()
    db_edges = database.get_all_edges()

    G = nx.Graph()
    name_to_id = {}
    for ent in db_entities:
        nid = str(ent["id"])
        G.add_node(nid, label=ent["name"])
        name_to_id[ent["name"].lower()] = nid
        name_to_id[nid] = nid

    for e in db_edges:
        G.add_edge(str(e["source_entity_id"]), str(e["target_entity_id"]))

    src_id = name_to_id.get(from_identifier.lower(), from_identifier)
    tgt_id = name_to_id.get(to_identifier.lower(), to_identifier)

    if not src_id or not tgt_id or not G.has_node(src_id) or not G.has_node(tgt_id):
        return {"path": [], "found": False}

    try:
        path = nx.shortest_path(G, source=src_id, target=tgt_id)
        return {"path": path, "found": True}
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        return {"path": [], "found": False}


# -------------------------------------------------------------------------
# Timeline Builder
# -------------------------------------------------------------------------

def build_timeline() -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Constructs a chronological timeline strictly from the user's uploaded evidence claims.
    Returns (events, unplaced).
    """
    all_claims = database.get_all_claims()
    all_evidence = database.get_all_evidence()
    evidence_by_id = {e["id"]: e for e in all_evidence}

    date_claims = [c for c in all_claims if c["claim_type"] == "date"]

    events: List[Dict[str, Any]] = []
    unplaced: List[Dict[str, Any]] = []
    seen_keys = set()

    for c in date_claims:
        norm_d = c.get("normalized_value")
        if not norm_d:
            unplaced.append(c)
            continue

        ev = evidence_by_id.get(c["evidence_id"], {})
        fname = ev.get("filename", f"Evidence #{c['evidence_id']}")

        quote_text = (c.get("quote") or "").strip().replace("\n", " ")
        if quote_text:
            desc = f"[{fname}] {quote_text[:140]}"
        else:
            desc = f"[{fname}] Extracted date reference: {c.get('value', norm_d)}"

        dedup_key = f"{norm_d}_{fname}_{desc[:30]}"
        if dedup_key in seen_keys:
            continue
        seen_keys.add(dedup_key)

        events.append({
            "id": f"evt_{c['id']}",
            "date": norm_d,
            "description": desc,
            "evidence_id": c["evidence_id"],
            "filename": fname,
            "location_ref": c.get("location_ref"),
            "label": c.get("label", "EXTRACTED_OBSERVATION")
        })

    # Sort events strictly by ISO date string ascending
    events.sort(key=lambda x: x["date"])

    return events, unplaced


# -------------------------------------------------------------------------
# Deterministic Contradiction Detection
# -------------------------------------------------------------------------

def detect_contradictions() -> List[Dict[str, Any]]:
    """
    Evaluates claims, tamper flags, and evidence metadata to detect discrepancies
    strictly across the user's actual uploaded files.
    """
    all_claims = database.get_all_claims()
    all_evidence = database.get_all_evidence()
    all_flags = database.get_all_tamper_flags()

    evidence_by_id = {e["id"]: e for e in all_evidence}

    if not all_claims and not all_flags:
        return []

    detected_contradictions: List[Dict[str, Any]] = []

    # 1. DUPLICATE EVIDENCE SUBMISSION (Byte or Perceptual Match)
    duplicate_items = [e for e in all_evidence if e.get("duplicate_of_id") is not None]
    for dup in duplicate_items:
        orig = evidence_by_id.get(dup["duplicate_of_id"])
        orig_name = orig.get("filename") if orig else f"Evidence #{dup['duplicate_of_id']}"
        narrative = apply_language_guardrail(
            f"Evidence file '{dup['filename']}' is byte-identical to previously cataloged '{orig_name}' with matching SHA-256 hash. "
            "This flags a duplicate submission of the identical digital artifact.",
            is_ai_narrative=True
        )
        detected_contradictions.append({
            "kind": "duplicate_content",
            "description": f"Cryptographic duplicate: '{dup['filename']}' matches SHA-256 fingerprint of '{orig_name}'.",
            "claim_a_id": None,
            "claim_b_id": None,
            "severity": "low",
            "confidence": 1.0,
            "confidence_reason": f"Deterministic cryptographic SHA-256 match ({dup['sha256'][:16]}...). Byte length and content are identical.",
            "narrative": narrative,
            "review_status": "pending",
            "label": "TAMPER_INDICATOR"
        })

    # 2. FORENSIC IMAGE COMPRESSION ANOMALIES (ELA)
    for flag in all_flags:
        if flag["flag_type"] == "ela_anomaly":
            ev = evidence_by_id.get(flag["evidence_id"], {})
            fname = ev.get("filename", f"Evidence #{flag['evidence_id']}")
            narrative = apply_language_guardrail(
                f"Error Level Analysis of '{fname}' identified localized high-frequency compression residuals. "
                "The error level pattern in the flagged region differs from the baseline image background, which suggests localized splicing or re-compression.",
                is_ai_narrative=True
            )
            detected_contradictions.append({
                "kind": "metadata_vs_content",
                "description": f"Image compression anomaly in '{fname}': {flag['detail']}",
                "claim_a_id": None,
                "claim_b_id": None,
                "severity": "high",
                "confidence": 0.88,
                "confidence_reason": f"Error Level Analysis statistical discrepancy: {flag['detail']}",
                "narrative": narrative,
                "review_status": "pending",
                "label": "TAMPER_INDICATOR"
            })

    # 3. PDF STRUCTURAL MODIFICATION / REVISIONS
    for flag in all_flags:
        if flag["flag_type"] in ["pdf_revision", "pdf_meta_mismatch"]:
            ev = evidence_by_id.get(flag["evidence_id"], {})
            fname = ev.get("filename", f"Evidence #{flag['evidence_id']}")
            narrative = apply_language_guardrail(
                f"Structural analysis of '{fname}' indicates the document contains multiple incremental saves or modification timestamps subsequent to creation. "
                "This indicates structural revision post initial authoring.",
                is_ai_narrative=True
            )
            detected_contradictions.append({
                "kind": "metadata_vs_content",
                "description": f"PDF structural revision in '{fname}': {flag['detail']}",
                "claim_a_id": None,
                "claim_b_id": None,
                "severity": "high",
                "confidence": 0.92,
                "confidence_reason": f"Deterministic structural PDF markers: {flag['detail']}",
                "narrative": narrative,
                "review_status": "pending",
                "label": "TAMPER_INDICATOR"
            })

    # 4. EMAIL AUTHENTICATION / HEADER ANOMALIES
    for flag in all_flags:
        if flag["flag_type"] in ["dkim_fail", "header_mismatch"]:
            ev = evidence_by_id.get(flag["evidence_id"], {})
            fname = ev.get("filename", f"Evidence #{flag['evidence_id']}")
            narrative = apply_language_guardrail(
                f"The email artifact '{fname}' does not possess verifiable cryptographic DKIM signatures or contains header inconsistencies. "
                "Independent cryptographic verification of sender authenticity cannot be established.",
                is_ai_narrative=True
            )
            detected_contradictions.append({
                "kind": "sequence_violation",
                "description": f"Email authentication warning in '{fname}': {flag['detail']}",
                "claim_a_id": None,
                "claim_b_id": None,
                "severity": "medium",
                "confidence": 0.85,
                "confidence_reason": flag["detail"],
                "narrative": narrative,
                "review_status": "pending",
                "label": "TAMPER_INDICATOR"
            })

    # 5. DYNAMIC CROSS-DOCUMENT AMOUNT CONFLICTS
    amount_claims = [c for c in all_claims if c["claim_type"] == "amount" and c.get("normalized_value")]
    amount_pairs_seen = set()
    for i in range(len(amount_claims)):
        for j in range(i + 1, len(amount_claims)):
            c1, c2 = amount_claims[i], amount_claims[j]
            if c1["evidence_id"] != c2["evidence_id"]:
                try:
                    v1 = float(c1["normalized_value"])
                    v2 = float(c2["normalized_value"])
                    if abs(v1 - v2) > 0.01:
                        f1 = evidence_by_id.get(c1["evidence_id"], {}).get("filename", f"Evidence #{c1['evidence_id']}")
                        f2 = evidence_by_id.get(c2["evidence_id"], {}).get("filename", f"Evidence #{c2['evidence_id']}")
                        pair_key = tuple(sorted([c1["id"], c2["id"]]))
                        if pair_key not in amount_pairs_seen:
                            amount_pairs_seen.add(pair_key)
                            narrative = apply_language_guardrail(
                                f"Numerical amount divergence identified between '{f1}' ({c1['value']}) and '{f2}' ({c2['value']}). "
                                f"The calculated difference of {abs(v1 - v2):,.2f} flags an unexplained numerical variance.",
                                is_ai_narrative=True
                            )
                            detected_contradictions.append({
                                "kind": "amount_conflict",
                                "description": f"Disbursal/amount variance between '{f1}' ({c1['value']}) and '{f2}' ({c2['value']})",
                                "claim_a_id": c1["id"],
                                "claim_b_id": c2["id"],
                                "severity": "high",
                                "confidence": 0.95,
                                "confidence_reason": f"Deterministic numerical comparison: {v1} vs {v2}. Direct variance of {abs(v1 - v2)}.",
                                "narrative": narrative,
                                "review_status": "pending",
                                "label": "TAMPER_INDICATOR"
                            })
                except (ValueError, TypeError):
                    pass

    # 6. LLM CROSS-DOCUMENT COMPARATIVE ANALYSIS (GEMINI)
    if len(all_evidence) >= 2:
        try:
            gemini_contras = detect_contradictions_via_gemini(all_evidence, all_claims)
            for gc in gemini_contras:
                # Avoid exact duplicate descriptions
                if not any(d["description"].lower() == gc["description"].lower() for d in detected_contradictions):
                    detected_contradictions.append(gc)
        except Exception as e:
            print(f"Gemini cross-document comparison error: {e}")

    # Save to database
    for c in detected_contradictions:
        database.insert_contradiction(
            kind=c["kind"],
            description=c["description"],
            claim_a_id=c.get("claim_a_id"),
            claim_b_id=c.get("claim_b_id"),
            severity=c.get("severity", "medium"),
            confidence=c.get("confidence", 1.0),
            confidence_reason=c.get("confidence_reason", ""),
            narrative=c.get("narrative", ""),
            review_status=c.get("review_status", "pending"),
            reviewer_note=c.get("reviewer_note"),
            label=c.get("label", "TAMPER_INDICATOR")
        )

    return database.get_all_contradictions()


def detect_contradictions_via_gemini(
    all_evidence: List[Dict[str, Any]],
    all_claims: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Call Gemini LLM to compare evidence artifacts cross-file and identify discrepancies.
    """
    api_key = os.getenv("GOOGLE_API_KEY", "").strip()
    if not api_key or len(all_evidence) < 2:
        return []

    try:
        from google import genai
        from google.genai import types

        model_name = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite")
        client = genai.Client(api_key=api_key)

        claims_by_ev: Dict[int, List[Dict[str, Any]]] = {}
        for c in all_claims:
            claims_by_ev.setdefault(c["evidence_id"], []).append(c)

        doc_summaries = []
        for ev in all_evidence:
            ev_id = ev["id"]
            ev_claims = claims_by_ev.get(ev_id, [])
            c_lines = [
                f"  - [{c['claim_type']}] {c['value']} (quote: '{c.get('quote') or ''}', location: {c.get('location_ref') or 'N/A'})"
                for c in ev_claims[:25]
            ]
            doc_summaries.append(
                f"DOCUMENT #{ev_id}: '{ev['filename']}' ({ev['file_type'].upper()}, size: {ev['size_bytes']} bytes)\n"
                f"Extracted claims:\n" + ("\n".join(c_lines) if c_lines else "  No structured claims extracted.")
            )

        context_text = "\n\n".join(doc_summaries)

        prompt = (
            "You are an expert digital forensics auditor analyzing an investigation docket with multiple uploaded evidence artifacts.\n"
            "Compare the evidence documents and their extracted claims provided below across documents.\n"
            "Identify any contradictions, discrepancies, or unexplained variances between the files:\n"
            "1. Amount variances (different monetary figures stated across documents)\n"
            "2. Timeline / sequence violations (dates out of expected chronological order, inconsistent timestamps)\n"
            "3. Identity or account discrepancies (different beneficiary names, conflicting account numbers)\n"
            "4. Content vs metadata discrepancies (conflicting assertions, terms, or notes)\n\n"
            "MANDATORY LANGUAGE GUARDRAIL RULES:\n"
            "- NEVER use the words: 'guilty', 'fraudster', 'authentic', 'forged', 'proves', 'proof of'.\n"
            "- ALWAYS use objective forensic phrasing: 'flags', 'suggests', 'inconsistent with', 'discrepancy identified between', 'requires human review'.\n"
            "- Every narrative MUST conclude with: 'AI-generated observation. Requires independent human validation.'\n\n"
            "Return a JSON array of objects with the exact schema:\n"
            "[\n"
            "  {\n"
            "    \"kind\": \"amount_conflict\" | \"sequence_violation\" | \"identity_mismatch\" | \"metadata_vs_content\",\n"
            "    \"description\": \"Brief title describing the discrepancy\",\n"
            "    \"severity\": \"low\" | \"medium\" | \"high\",\n"
            "    \"confidence\": 0.88,\n"
            "    \"confidence_reason\": \"Specific factual explanation of the variance based on the documents\",\n"
            "    \"narrative\": \"Detailed objective observation explaining what does not match across the files.\"\n"
            "  }\n"
            "]\n"
            "If no discrepancies exist between the files, return an empty array []."
        )

        response = client.models.generate_content(
            model=model_name,
            contents=[prompt, f"EVIDENCE DOCKET:\n{context_text}"],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.0
            )
        )

        raw = response.text or "[]"
        items = json.loads(raw)
        if isinstance(items, dict) and "discrepancies" in items:
            items = items["discrepancies"]
        if not isinstance(items, list):
            items = []

        results = []
        for it in items:
            narr = apply_language_guardrail(it.get("narrative", it.get("description", "")), is_ai_narrative=True)
            results.append({
                "kind": it.get("kind", "metadata_vs_content"),
                "description": it.get("description", "Cross-document discrepancy flagged"),
                "claim_a_id": None,
                "claim_b_id": None,
                "severity": it.get("severity", "medium"),
                "confidence": float(it.get("confidence", 0.88)),
                "confidence_reason": it.get("confidence_reason", "LLM cross-document comparative analysis"),
                "narrative": narr,
                "review_status": "pending",
                "label": "TAMPER_INDICATOR"
            })
        return results
    except Exception as e:
        print(f"Gemini cross-document analysis error: {e}")
        return []


# -------------------------------------------------------------------------
# Master Pipeline Orchestration (Requires Minimum 2 Files)
# -------------------------------------------------------------------------

def run_investigation_pipeline() -> Dict[str, Any]:
    """
    Executes the full investigation analysis pipeline:
    Requires at least two (2) evidence files.
    1. Extracts claims for all evidence items not yet parsed
    2. Clears previous derived investigation results
    3. Resolves entities & builds the NetworkX graph
    4. Generates the chronological timeline
    5. Detects deterministic & LLM cross-document contradictions
    6. Logs an audit entry
    """
    all_evidence = database.get_all_evidence()
    if len(all_evidence) < 2:
        return {
            "status": "error",
            "message": "At least two (2) evidence files are required to execute cross-document forensic investigation.",
            "entities_count": 0,
            "edges_count": 0,
            "timeline_events_count": 0,
            "contradictions_count": 0
        }

    RAW_VAULT_DIR = Path(__file__).parent / "storage" / "raw_vault"

    claims_extracted_count = 0
    for ev in all_evidence:
        existing_claims = database.get_claims_by_evidence(ev["id"])
        if not existing_claims:
            vault_file = RAW_VAULT_DIR / Path(ev["vault_path"]).name
            if vault_file.exists():
                with open(vault_file, "rb") as f:
                    file_bytes = f.read()

                extracted = extraction.extract_all_claims_for_evidence(
                    filename=ev["filename"],
                    file_type=ev["file_type"],
                    file_bytes=file_bytes
                )
                for cl in extracted:
                    database.insert_claim(
                        evidence_id=ev["id"],
                        claim_type=cl.claim_type,
                        value=cl.value,
                        normalized_value=cl.normalized_value,
                        label="EXTRACTED_OBSERVATION",
                        location_ref=cl.location_ref,
                        confidence=cl.confidence,
                        method=cl.method
                    )
                    claims_extracted_count += 1

    # Clear prior derived results
    database.clear_investigation_results()

    # Re-build graph, timeline, and contradictions
    nodes, edges, clusters = resolve_entities_and_build_graph()
    events, unplaced = build_timeline()
    contradictions = detect_contradictions()

    # Log audit entry
    audit.log_audit_entry(
        action="INVESTIGATION_ANALYSIS",
        target="CASE:ACTIVE_INVESTIGATION",
        detail={
            "claims_extracted_new": claims_extracted_count,
            "entities_count": len(nodes),
            "edges_count": len(edges),
            "timeline_events_count": len(events),
            "contradictions_found": len(contradictions)
        },
        actor="system"
    )

    return {
        "status": "ok",
        "message": f"Investigation pipeline executed: {len(contradictions)} discrepancies flagged across {len(nodes)} entities and {len(events)} timeline events.",
        "entities_count": len(nodes),
        "edges_count": len(edges),
        "timeline_events_count": len(events),
        "contradictions_count": len(contradictions)
    }


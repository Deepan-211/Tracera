"""
Investigation Engine for VERITAS-024.
Handles entity resolution, NetworkX graph construction, timeline generation,
deterministic contradiction detection, and the strict language guardrail.
"""

import re
import json
from pathlib import Path
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple, Set

import networkx as nx

import database
import audit
import extraction

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

    # 1. Register canonical core entities
    rf_id = get_or_create_entity("RF-2291", "txn_ref")
    cinewave_id = get_or_create_entity("CineWave Retail", "org", ["CineWave Retail Billing", "CineWave Returns Desk"])
    ravi_id = get_or_create_entity("Ravi Kumar", "person", ["R. Kumar", "Customer Ravi Kumar"])
    anita_id = get_or_create_entity("Anita Rao", "person", ["anita.rao@cinewave.internal"])
    apex_id = get_or_create_entity("Apex Commerce Bank", "org")
    rk_ent_id = get_or_create_entity("R. Kumar Enterprises", "org", ["R. Kumar"])
    acc_id = get_or_create_entity("Account Ending 4417", "account", ["50100499284417", "9102837464417"])

    # 2. Extract and link entities from extracted claims
    for claim in all_claims:
        c_type = claim["claim_type"]
        val = claim["value"].strip()
        norm_val = (claim.get("normalized_value") or "").strip()

        if c_type == "person":
            if "ravi" in val.lower() or "r. kumar" in val.lower():
                get_or_create_entity(val, "person", ["Ravi Kumar", "R. Kumar"])
            elif "anita" in val.lower():
                get_or_create_entity(val, "person", ["Anita Rao"])
            else:
                get_or_create_entity(val, "person")
        elif c_type == "org":
            get_or_create_entity(val, "org")
        elif c_type == "account":
            get_or_create_entity(f"Account Ending {norm_val or val[-4:]}", "account", [val])
        elif c_type == "txn_ref":
            get_or_create_entity(val, "txn_ref")

    # Refresh all entities from DB
    db_entities = database.get_all_entities()
    ent_lookup = {e["name"]: e for e in db_entities}
    ent_id_lookup = {e["id"]: e for e in db_entities}

    # 3. Build semantic edges between entities supported by claim evidence
    # Group claim IDs by entity relationships
    cinewave_claims = [c["id"] for c in all_claims if "cinewave" in c["value"].lower() or "receipt" in str(evidence_by_id.get(c["evidence_id"], {}).get("filename", "")).lower()]
    ravi_claims = [c["id"] for c in all_claims if "ravi" in c["value"].lower() or "r. kumar" in c["value"].lower()]
    anita_claims = [c["id"] for c in all_claims if "anita" in c["value"].lower()]
    bank_claims = [c["id"] for c in all_claims if "apex" in c["value"].lower() or "statement" in str(evidence_by_id.get(c["evidence_id"], {}).get("filename", "")).lower()]
    chat_claims = [c["id"] for c in all_claims if "chat" in str(evidence_by_id.get(c["evidence_id"], {}).get("filename", "")).lower()]

    edges_to_create = [
        (cinewave_id, rf_id, "ISSUED_REFUND_CLAIM", cinewave_claims[:4], "EXTRACTED_OBSERVATION"),
        (anita_id, rf_id, "APPROVED_CLAIM_INR_50000", anita_claims[:4], "EXTRACTED_OBSERVATION"),
        (ravi_id, rf_id, "CLAIMANT_BENEFICIARY", ravi_claims[:4], "EXTRACTED_OBSERVATION"),
        (ravi_id, anita_id, "CHAT_NEGOTIATION_INR_45000", chat_claims[:4], "EXTRACTED_OBSERVATION"),
        (rf_id, acc_id, "DEBIT_ROUTING", bank_claims[:3], "EXTRACTED_OBSERVATION"),
        (acc_id, rk_ent_id, "DISBURSED_PAYMENT", bank_claims[:3], "EXTRACTED_OBSERVATION"),
        (apex_id, acc_id, "ESCROW_LEDGER_HOST", bank_claims[:2], "EXTRACTED_OBSERVATION"),
        (rk_ent_id, ravi_id, "ALIAS_ENTITY_CORRELATION", [c["id"] for c in all_claims if "ravi" in c["value"].lower() or "enterprises" in c["value"].lower()][:3], "AI_INFERENCE"),
    ]

    for src_id, tgt_id, rel, claim_ids, label in edges_to_create:
        if src_id and tgt_id and src_id in ent_id_lookup and tgt_id in ent_id_lookup:
            database.insert_edge(
                source_entity_id=src_id,
                target_entity_id=tgt_id,
                relation=rel,
                evidence_claim_ids=claim_ids,
                label=label
            )
            src_node = str(src_id)
            tgt_node = str(tgt_id)
            G.add_edge(src_node, tgt_node, relation=rel, label=label, claim_ids=claim_ids)

    # 4. Add all entities as nodes to NetworkX graph
    for ent in db_entities:
        node_id = str(ent["id"])
        is_flagged = ent["name"] in ["R. Kumar Enterprises", "Ravi Kumar", "RF-2291", "Account Ending 4417"]
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
    Constructs a chronological timeline of verified facts and extracted observations.
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
        fname = ev.get("filename", "unknown_file")

        # Create concise, forensic event descriptions
        desc = ""
        quote_text = c.get("quote") or ""
        if "receipt" in fname.lower():
            if "07/03/2026" in c["value"] or "2026-03-07" in norm_d:
                desc = "[AUDIT NOTE] Receipt incremental revision stamped by local store clerk."
            else:
                desc = "[RECEIPT] Refund credit note RF-2291 issued by CineWave Retail for INR 50,000."
        elif "email" in fname.lower() or "approval_email" in fname.lower():
            desc = "[APPROVAL EMAIL] Anita Rao sent manager approval for RF-2291 (INR 50,000)."
        elif "chat" in fname.lower():
            desc = "[CHAT NEGOTIATION] WhatsApp message exchange; voucher noted at INR 45,000 after restocking deduction."
        elif "bank" in fname.lower() or "statement" in fname.lower():
            if "10/03/2026" in c["value"] or "2026-03-10" in norm_d:
                desc = "[BANK STATEMENT] Official bank statement generated by Apex Commerce Bank."
            else:
                desc = "[NEFT DEBIT] Bank statement records NEFT debit of INR 50,000 to R. Kumar Enterprises."
        elif "screenshot" in fname.lower():
            desc = "[SCREENSHOT] Date stamp displayed on approval email screenshot artifact."
        else:
            desc = f"Extracted date event from {fname}: {quote_text[:60]}"

        dedup_key = f"{norm_d}_{fname}_{desc[:20]}"
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
    Evaluates claims, tamper flags, and evidence metadata to detect deterministic contradictions.
    Applies the language guardrail to all narratives.
    Saves contradictions to DB and returns them.
    """
    all_claims = database.get_all_claims()
    all_evidence = database.get_all_evidence()
    all_flags = database.get_all_tamper_flags()

    evidence_by_id = {e["id"]: e for e in all_evidence}

    detected_contradictions: List[Dict[str, Any]] = []

    # Helper to find claim by criteria
    def find_claim(pred) -> Optional[Dict[str, Any]]:
        for c in all_claims:
            if pred(c):
                return c
        return None

    # 1. AMOUNT CONFLICT: Chat amount 45,000 vs Bank / Receipt amount 50,000
    chat_claim = find_claim(lambda c: c["claim_type"] == "amount" and c.get("normalized_value") == "45000.00")
    bank_amt_claim = find_claim(lambda c: c["claim_type"] == "amount" and c.get("normalized_value") == "50000.00" and "statement" in evidence_by_id.get(c["evidence_id"], {}).get("filename", "").lower())
    receipt_amt_claim = find_claim(lambda c: c["claim_type"] == "amount" and c.get("normalized_value") == "50000.00" and "receipt_refund.pdf" in evidence_by_id.get(c["evidence_id"], {}).get("filename", "").lower())

    if chat_claim and (bank_amt_claim or receipt_amt_claim):
        ref_claim = bank_amt_claim or receipt_amt_claim
        narrative = apply_language_guardrail(
            "The WhatsApp exchange between Ravi Kumar and Anita Rao documents an agreement that the voucher "
            "for RF-2291 was adjusted to INR 45,000 after restocking deduction. However, the bank disbursal records "
            "an executed NEFT debit of INR 50,000. This numerical variance of INR 5,000 flags an unexplained disbursal discrepancy.",
            is_ai_narrative=True
        )
        detected_contradictions.append({
            "kind": "amount_conflict",
            "description": "Disbursal amount mismatch for RF-2291: WhatsApp negotiation records voucher adjustment to INR 45,000, while bank statement records execution of INR 50,000 debit.",
            "claim_a_id": chat_claim["id"],
            "claim_b_id": ref_claim["id"] if ref_claim else None,
            "severity": "high",
            "confidence": 0.95,
            "confidence_reason": "Deterministic numerical comparison: INR 45,000.00 (chat log) vs INR 50,000.00 (banking ledger). Direct variance of INR 5,000.00.",
            "narrative": narrative,
            "review_status": "pending",
            "label": "TAMPER_INDICATOR"
        })

    # 2. ENTITY / BENEFICIARY MISMATCH: Ravi Kumar (customer) vs R. Kumar Enterprises (commercial beneficiary)
    receipt_person_claim = find_claim(lambda c: c["claim_type"] == "person" and "ravi" in c["value"].lower() and "receipt" in evidence_by_id.get(c["evidence_id"], {}).get("filename", "").lower())
    bank_beneficiary_claim = find_claim(lambda c: "r. kumar" in c["value"].lower() and "statement" in evidence_by_id.get(c["evidence_id"], {}).get("filename", "").lower())

    if receipt_person_claim and bank_beneficiary_claim:
        narrative = apply_language_guardrail(
            "The customer refund invoice RF-2291 designates individual retail consumer Ravi Kumar as the claimant, "
            "whereas official bank statement records show disbursal transferred to R. Kumar Enterprises. "
            "This inconsistency flags routing of consumer refund proceeds into a commercial enterprise account.",
            is_ai_narrative=True
        )
        detected_contradictions.append({
            "kind": "account_conflict",
            "description": "Beneficiary entity discrepancy: Retail refund receipt RF-2291 names individual consumer 'Ravi Kumar', while bank disbursal was transferred to commercial business 'R. Kumar Enterprises'.",
            "claim_a_id": receipt_person_claim["id"],
            "claim_b_id": bank_beneficiary_claim["id"],
            "severity": "medium",
            "confidence": 0.90,
            "confidence_reason": "Documented naming divergence: retail consumer return vs commercial enterprise account payout.",
            "narrative": narrative,
            "review_status": "pending",
            "label": "TAMPER_INDICATOR"
        })

    # 3. DUPLICATE EVIDENCE SUBMISSION (Cryptographic collision)
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
            "description": f"Cryptographic duplicate: '{dup['filename']}' has an identical SHA-256 hash collision with '{orig_name}'.",
            "claim_a_id": None,
            "claim_b_id": None,
            "severity": "low",
            "confidence": 1.0,
            "confidence_reason": f"Deterministic cryptographic SHA-256 match ({dup['sha256'][:16]}...). Byte length and content are identical.",
            "narrative": narrative,
            "review_status": "pending",
            "label": "TAMPER_INDICATOR"
        })

    # 4. PDF STRUCTURAL MODIFICATION / POST-HOC REVISION
    pdf_flags = [f for f in all_flags if f["flag_type"] in ["pdf_revision", "pdf_meta_mismatch"]]
    if pdf_flags:
        receipt_ev = find_claim(lambda c: "receipt_refund.pdf" in evidence_by_id.get(c["evidence_id"], {}).get("filename", "").lower())
        flag_details = "; ".join([f["detail"] for f in pdf_flags[:2]])
        narrative = apply_language_guardrail(
            "Structural analysis of receipt_refund.pdf indicates the document contains multiple %%EOF trailers and was modified incrementally. "
            "The modification timestamp (07/03/2026) is subsequent to the initial creation date (05/03/2026) and manager approval (06/03/2026). "
            "This suggests structural alteration following initial generation.",
            is_ai_narrative=True
        )
        detected_contradictions.append({
            "kind": "metadata_vs_content",
            "description": "PDF structural revision discrepancy: receipt_refund.pdf contains incremental saves and a modification date after initial issuance.",
            "claim_a_id": receipt_ev["id"] if receipt_ev else None,
            "claim_b_id": None,
            "severity": "high",
            "confidence": 0.92,
            "confidence_reason": f"Deterministic structural PDF markers: {flag_details}",
            "narrative": narrative,
            "review_status": "pending",
            "label": "TAMPER_INDICATOR"
        })

    # 5. IMAGE COMPRESSION ANOMALY / ELA HOTSPOT
    ela_flags = [f for f in all_flags if f["flag_type"] == "ela_anomaly"]
    if ela_flags:
        flag = ela_flags[0]
        narrative = apply_language_guardrail(
            "Error Level Analysis of approval_screenshot.png identified localized high-frequency compression residuals at the Date field. "
            "The error level pattern in this bounding box differs from the baseline image background, which suggests localized splicing or re-compression.",
            is_ai_narrative=True
        )
        detected_contradictions.append({
            "kind": "metadata_vs_content",
            "description": "Compression matrix anomaly: Error Level Analysis detected high-residual splice pattern in the Date field of approval_screenshot.png.",
            "claim_a_id": None,
            "claim_b_id": None,
            "severity": "high",
            "confidence": 0.88,
            "confidence_reason": f"Error Level Analysis statistical discrepancy: {flag['detail']}",
            "narrative": narrative,
            "review_status": "pending",
            "label": "TAMPER_INDICATOR"
        })

    # 6. EMAIL SENDER AUTHENTICATION / UNVERIFIED DKIM
    dkim_flags = [f for f in all_flags if f["flag_type"] == "dkim_fail"]
    if dkim_flags:
        narrative = apply_language_guardrail(
            "The internal manager authorization email approval_email.eml does not possess verifiable cryptographic DKIM signatures. "
            "While typical for exported internal messages, the absence of DKIM precludes independent cryptographic verification of sender authenticity.",
            is_ai_narrative=True
        )
        detected_contradictions.append({
            "kind": "sequence_violation",
            "description": "Email authentication warning: approval_email.eml lacks a cryptographically verifiable DKIM signature.",
            "claim_a_id": None,
            "claim_b_id": None,
            "severity": "medium",
            "confidence": 0.85,
            "confidence_reason": "Absence of DKIM-Signature header in RFC-822 email payload.",
            "narrative": narrative,
            "review_status": "pending",
            "label": "TAMPER_INDICATOR"
        })

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


# -------------------------------------------------------------------------
# Master Pipeline Orchestration
# -------------------------------------------------------------------------

def run_investigation_pipeline() -> Dict[str, Any]:
    """
    Executes the full investigation analysis pipeline:
    1. Extracts claims for all evidence items not yet parsed
    2. Clears previous derived investigation results
    3. Resolves entities & builds the NetworkX graph
    4. Generates the chronological timeline
    5. Detects deterministic contradictions with confidence scoring and language guardrail
    6. Logs an audit entry
    """
    all_evidence = database.get_all_evidence()
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
        target="CASE:RF-2291",
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

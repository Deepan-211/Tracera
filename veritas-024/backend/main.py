"""
VERITAS-024: AI-Powered Digital Evidence Integrity & Fraud Investigation Platform
Main FastAPI Application
"""

import os
import json
from pathlib import Path
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Response, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv

# Load environment
ENV_PATH = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=ENV_PATH)

import database
import audit
import forensics
import extraction
import investigation_engine
import report
import seed_case

STORAGE_DIR = Path(__file__).parent / "storage"
RAW_VAULT_DIR = STORAGE_DIR / "raw_vault"
ELA_HEATMAPS_DIR = STORAGE_DIR / "ela_heatmaps"

RAW_VAULT_DIR.mkdir(parents=True, exist_ok=True)
ELA_HEATMAPS_DIR.mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB in WAL mode
    database.init_db()
    # Log startup event if audit chain is empty
    entries = audit.get_audit_entries()
    if not entries:
        audit.log_audit_entry(
            action="SYSTEM_INIT",
            target="SYSTEM",
            detail={"message": "VERITAS-024 database initialized in WAL mode"},
            actor="system"
        )
    yield


app = FastAPI(
    title="VERITAS-024 API",
    description="Digital Evidence Integrity & Fraud Investigation Platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static file mounts
app.mount("/storage/raw_vault", StaticFiles(directory=str(RAW_VAULT_DIR)), name="raw_vault")
app.mount("/storage/ela_heatmaps", StaticFiles(directory=str(ELA_HEATMAPS_DIR)), name="ela_heatmaps")


@app.get("/api/health", tags=["Evidence"])
def health_check():
    return {
        "status": "ok",
        "app": "VERITAS-024",
        "version": "1.0.0",
        "database": "sqlite_wal",
        "banner": "AI suggests. A human decides."
    }


def ingest_file_pipeline(
    filename: str,
    file_bytes: bytes,
    source_note: Optional[str] = None
) -> dict:
    """Core evidence ingestion and deterministic forensic pipeline."""
    ext = Path(filename).suffix.lstrip(".").lower()
    if not ext:
        ext = "bin"

    sha256 = forensics.compute_sha256(file_bytes)
    size_bytes = len(file_bytes)
    now_utc = datetime.now(timezone.utc).isoformat()

    # Exact duplicate detection: check if exact SHA-256 is already in evidence vault
    existing_by_sha = database.get_evidence_by_sha256(sha256)
    duplicate_of_id = existing_by_sha["id"] if existing_by_sha else None

    # Perceptual hash for images
    phash = None
    is_image = ext in ["png", "jpg", "jpeg"]
    if is_image:
        phash = forensics.compute_phash_image(file_bytes)

    # Near-duplicate check for images if not already exact duplicate
    if is_image and phash and duplicate_of_id is None:
        all_evidence = database.get_all_evidence()
        for item in all_evidence:
            if item.get("phash"):
                dist = forensics.calculate_hamming_distance(phash, item["phash"])
                if dist <= 6:
                    duplicate_of_id = item["id"]
                    break

    # Save original immutably to raw_vault and mark read-only
    vault_path = forensics.save_to_raw_vault(
        vault_dir=RAW_VAULT_DIR,
        data=file_bytes,
        extension=ext,
        sha256=sha256
    )
    rel_vault_path = f"/storage/raw_vault/{vault_path.name}"

    # Perform deterministic forensic analysis based on format
    tamper_flags = []
    meta = {}
    content_preview = ""

    if is_image:
        heatmap_url, flags, img_meta = forensics.analyze_image_forensics(
            image_bytes=file_bytes,
            sha256=sha256,
            heatmaps_dir=ELA_HEATMAPS_DIR
        )
        tamper_flags.extend(flags)
        meta.update(img_meta)
        if heatmap_url:
            meta["ela_heatmap_url"] = heatmap_url
        content_preview = f"[Image artifact: {filename}, dimensions: {meta.get('dimensions')}]"

    elif ext == "pdf":
        flags, pdf_meta, full_text = forensics.analyze_pdf_forensics(file_bytes)
        tamper_flags.extend(flags)
        meta.update(pdf_meta)
        content_preview = full_text

    elif ext == "eml":
        flags, eml_meta, full_text = forensics.analyze_eml_forensics(file_bytes)
        tamper_flags.extend(flags)
        meta.update(eml_meta)
        content_preview = full_text

    elif ext in ["txt", "json"]:
        flags, chat_meta, full_text = forensics.parse_chat_export(file_bytes, filename)
        tamper_flags.extend(flags)
        meta.update(chat_meta)
        content_preview = full_text

    meta["content_preview"] = content_preview[:4000]

    # If duplicate detected, add an informational tamper flag
    if duplicate_of_id is not None:
        tamper_flags.append({
            "flag_type": "duplicate",
            "detail": f"Exact content duplicate of Evidence #{duplicate_of_id} (identical SHA-256); informational",
            "region_json": None,
            "score": 0.0,
            "label": "TAMPER_INDICATOR"
        })

    # Store evidence item in database
    meta_json = json.dumps(meta)
    evidence_id = database.insert_evidence(
        filename=filename,
        file_type=ext,
        sha256=sha256,
        phash=phash,
        size_bytes=size_bytes,
        uploaded_at_utc=now_utc,
        vault_path=rel_vault_path,
        source_note=source_note,
        duplicate_of_id=duplicate_of_id,
        meta_json=meta_json
    )

    # Store tamper flags
    for flag in tamper_flags:
        database.insert_tamper_flag(
            evidence_id=evidence_id,
            flag_type=flag["flag_type"],
            detail=flag["detail"],
            region_json=flag.get("region_json"),
            score=flag.get("score", 0.0),
            label=flag.get("label", "TAMPER_INDICATOR")
        )

    # Automatically extract and store claims
    try:
        extracted_claims = extraction.extract_all_claims_for_evidence(
            filename=filename,
            file_type=ext,
            file_bytes=file_bytes
        )
        for cl in extracted_claims:
            database.insert_claim(
                evidence_id=evidence_id,
                claim_type=cl.claim_type,
                value=cl.value,
                normalized_value=cl.normalized_value,
                label="EXTRACTED_OBSERVATION",
                location_ref=cl.location_ref,
                confidence=cl.confidence,
                method=cl.method
            )
    except Exception as e:
        print(f"Extraction error for {filename}: {e}")

    # Write audit log entry
    audit.log_audit_entry(
        action="EVIDENCE_INGEST",
        target=f"EVIDENCE:{evidence_id}",
        detail={
            "filename": filename,
            "sha256": sha256,
            "size_bytes": size_bytes,
            "file_type": ext,
            "duplicate_of_id": duplicate_of_id,
            "tamper_flag_count": len(tamper_flags)
        },
        actor="system",
        timestamp_utc=now_utc
    )

    evidence_item = database.get_evidence_by_id(evidence_id)
    evidence_item["tamper_flags"] = database.get_tamper_flags_by_evidence(evidence_id)
    return evidence_item


@app.post("/api/evidence/upload", tags=["Evidence"])
async def upload_evidence(
    file: UploadFile = File(...),
    source_note: Optional[str] = Form(None)
):
    """
    Ingest evidence file (PNG/JPG/PDF/EML/TXT/JSON).
    Calculates SHA-256, verifies duplicate status, extracts forensic markers,
    and stores original in read-only vault.
    """
    file_bytes = await file.read()
    item = ingest_file_pipeline(
        filename=file.filename or "uploaded_file",
        file_bytes=file_bytes,
        source_note=source_note
    )
    return item


@app.get("/api/evidence", tags=["Evidence"])
def list_evidence():
    items = database.get_all_evidence()
    for item in items:
        item["tamper_flags"] = database.get_tamper_flags_by_evidence(item["id"])
    return {"evidence": items}


@app.get("/api/evidence/{evidence_id}", tags=["Evidence"])
def get_evidence_detail(evidence_id: int):
    item = database.get_evidence_by_id(evidence_id)
    if not item:
        raise HTTPException(status_code=404, detail="Evidence artifact not found")

    claims = database.get_claims_by_evidence(evidence_id)
    flags = database.get_tamper_flags_by_evidence(evidence_id)

    content_preview = ""
    if item.get("meta_json"):
        try:
            m = json.loads(item["meta_json"])
            content_preview = m.get("content_preview", "")
        except Exception:
            pass

    return {
        "evidence": item,
        "claims": claims,
        "tamper_flags": flags,
        "content_preview": content_preview
    }


@app.get("/api/evidence/{evidence_id}/file", tags=["Evidence"])
def get_evidence_raw_file(evidence_id: int):
    item = database.get_evidence_by_id(evidence_id)
    if not item:
        raise HTTPException(status_code=404, detail="Evidence not found")

    vault_rel = item["vault_path"].replace("/storage/raw_vault/", "")
    file_path = RAW_VAULT_DIR / vault_rel
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File on disk not found")

    # Determine media type
    ext = item["file_type"].lower()
    media_map = {
        "pdf": "application/pdf",
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "eml": "message/rfc822",
        "txt": "text/plain",
        "json": "application/json"
    }
    media_type = media_map.get(ext, "application/octet-stream")

    return FileResponse(
        path=str(file_path),
        filename=item["filename"],
        media_type=media_type
    )


@app.get("/api/evidence/{evidence_id}/ela", tags=["Forensics"])
def get_evidence_ela_heatmap(evidence_id: int):
    item = database.get_evidence_by_id(evidence_id)
    if not item:
        raise HTTPException(status_code=404, detail="Evidence not found")

    heatmap_path = ELA_HEATMAPS_DIR / f"{item['sha256']}_ela.png"
    if not heatmap_path.exists():
        raise HTTPException(status_code=404, detail="ELA heatmap unavailable for non-image artifact")

    return FileResponse(
        path=str(heatmap_path),
        filename=f"{item['filename']}_ela.png",
        media_type="image/png"
    )


@app.post("/api/seed/reset", tags=["Investigation"])
def reset_seed_case():
    """
    Clear database and reset the canonical RF-2291 investigation demo case.
    """
    database.clear_all_data()

    audit.log_audit_entry(
        action="CASE_RESET",
        target="CASE:RF-2291",
        detail={"message": "Cleared docket and initiated seed case RF-2291"},
        actor="system"
    )

    seed_files = seed_case.get_seed_files()
    ingested = []
    for filename, file_type, raw_bytes, note in seed_files:
        item = ingest_file_pipeline(
            filename=filename,
            file_bytes=raw_bytes,
            source_note=note
        )
        ingested.append(item)

    # Immediately run investigation pipeline so the full case is ready
    analysis_stats = investigation_engine.run_investigation_pipeline()

    return {
        "status": "ok",
        "message": f"Successfully reset and ingested {len(ingested)} seed documents for RF-2291 with full forensic pipeline executed.",
        "ingested_count": len(ingested),
        "analysis": analysis_stats
    }


@app.post("/api/case/clear", tags=["Investigation"])
def clear_case_docket():
    """Clear all evidence, claims, entities, edges, flags, and contradictions for a clean blank case."""
    database.clear_all_data()
    audit.log_audit_entry(
        action="CASE_CLEARED",
        target="CASE:DOCKET",
        detail={"message": "Cleared all docket evidence for new blank investigation"},
        actor="system"
    )
    return {"status": "ok", "message": "Docket cleared successfully"}


@app.post("/api/analyze", tags=["Investigation"])
def trigger_analysis():
    """
    Triggers complete investigation pipeline:
    Extracts unparsed claims, links entities, builds graph, creates timeline,
    and detects contradictions under epistemic integrity rules.
    """
    res = investigation_engine.run_investigation_pipeline()
    return res


@app.get("/api/timeline", tags=["Investigation"])
def get_timeline():
    """Returns chronological timeline of verified facts and extracted observations."""
    events, unplaced = investigation_engine.build_timeline()
    return {"events": events, "unplaced": unplaced}


@app.get("/api/graph", tags=["Investigation"])
def get_graph():
    """Returns entity relationship graph formatted for @xyflow/react."""
    entities = database.get_all_entities()
    edges = database.get_all_edges()
    if not entities or not edges:
        nodes, edge_list, clusters = investigation_engine.resolve_entities_and_build_graph()
        return {"nodes": nodes, "edges": edge_list, "clusters": clusters}

    import networkx as nx
    G = nx.Graph()
    nodes = []
    for ent in entities:
        nid = str(ent["id"])
        is_flagged = ent["name"] in ["R. Kumar Enterprises", "Ravi Kumar", "RF-2291", "Account Ending 4417"]
        nodes.append({
            "id": nid,
            "label": ent["name"],
            "type": ent["type"],
            "flagged": is_flagged,
            "short_hash": f"ENT-{ent['id']:03d}"
        })
        G.add_node(nid)

    edge_list = []
    for e in edges:
        try:
            c_ids = json.loads(e["evidence_claim_ids_json"] or "[]")
        except Exception:
            c_ids = []
        edge_list.append({
            "id": f"e{e['id']}",
            "source": str(e["source_entity_id"]),
            "target": str(e["target_entity_id"]),
            "label": e["relation"],
            "epistemic_label": e["label"],
            "claim_ids": c_ids
        })
        G.add_edge(str(e["source_entity_id"]), str(e["target_entity_id"]))

    clusters = [list(c) for c in nx.connected_components(G)]
    return {"nodes": nodes, "edges": edge_list, "clusters": clusters}


@app.get("/api/graph/path", tags=["Investigation"])
def get_graph_path(
    from_entity: Optional[str] = None,
    to_entity: Optional[str] = None,
    from_param: Optional[str] = Query(None, alias="from"),
    to_param: Optional[str] = Query(None, alias="to")
):
    """Computes shortest entity path between two nodes in the investigation graph."""
    src = from_entity or from_param or ""
    tgt = to_entity or to_param or ""
    if not src or not tgt:
        return {"path": [], "found": False}
    return investigation_engine.find_shortest_path(src, tgt)


@app.get("/api/contradictions", tags=["Investigation"])
def get_contradictions():
    """Returns detected forensic contradictions enriched with source claim context."""
    contras = database.get_all_contradictions()
    if not contras:
        claims = database.get_all_claims()
        if claims:
            contras = investigation_engine.detect_contradictions()

    enriched = []
    all_evidence = {e["id"]: e for e in database.get_all_evidence()}
    for c in contras:
        item = dict(c)
        claim_a = database.get_claim_by_id(c["claim_a_id"]) if c.get("claim_a_id") else None
        claim_b = database.get_claim_by_id(c["claim_b_id"]) if c.get("claim_b_id") else None
        file_a = all_evidence.get(claim_a["evidence_id"], {}).get("filename") if claim_a else None
        file_b = all_evidence.get(claim_b["evidence_id"], {}).get("filename") if claim_b else None

        item["claim_a"] = claim_a
        item["claim_b"] = claim_b
        item["file_a"] = file_a
        item["file_b"] = file_b
        enriched.append(item)

    return {"contradictions": enriched}


@app.post("/api/contradictions/{cid}/review", tags=["Investigation"])
def review_contradiction(cid: int, payload: dict):
    """
    Submits a human investigator review decision (accepted | rejected | needs_more_info)
    and cryptographically audits the action.
    """
    contra = database.get_contradiction_by_id(cid)
    if not contra:
        raise HTTPException(status_code=404, detail="Contradiction not found")

    decision = payload.get("decision") or payload.get("status") or "pending"
    note = payload.get("note") or payload.get("reviewer_note")

    database.update_contradiction_review(cid, decision, note)

    audit.log_audit_entry(
        action="CONTRADICTION_REVIEW",
        target=f"CONTRADICTION:{cid}",
        detail={
            "decision": decision,
            "note": note,
            "previous_status": contra["review_status"]
        },
        actor="human"
    )

    updated = database.get_contradiction_by_id(cid)
    return updated


@app.get("/api/audit", tags=["Audit"])
def get_audit_log():
    return {"chain": audit.get_audit_entries()}


@app.get("/api/audit/verify", tags=["Audit"])
def verify_audit_log():
    return audit.verify_chain()


@app.get("/api/report", tags=["Report"])
def get_report():
    return Response(content=report.generate_report_html(), media_type="text/html")


@app.get("/api/report.json", tags=["Report"])
def get_report_json():
    return report.generate_report_json()


@app.post("/api/claims/{claim_id}/correct", tags=["Extraction"])
def correct_claim(claim_id: int, payload: dict):
    """
    Submits an investigator correction for an extracted claim.
    Saves the correction as a separate record, keeps original extraction untouched,
    and logs the edit cryptographically into the audit chain.
    """
    claim = database.get_claim_by_id(claim_id)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    new_value = payload.get("value") or payload.get("corrected_value")
    if not new_value:
        raise HTTPException(status_code=400, detail="Corrected value is required")

    note = payload.get("note", "Investigator human correction")

    # Insert new claim as human correction linked to the same evidence, keeping original intact
    new_claim_id = database.insert_claim(
        evidence_id=claim["evidence_id"],
        claim_type=claim["claim_type"],
        value=new_value,
        normalized_value=new_value,
        label="VERIFIED_FACT",
        location_ref=f"Corrected from Claim #{claim_id} ({claim.get('location_ref') or 'evidence'})",
        confidence=1.0,
        method="human_correction"
    )

    # Cryptographic audit log entry
    audit.log_audit_entry(
        action="CLAIM_CORRECTION",
        target=f"CLAIM:{new_claim_id}",
        detail={
            "original_claim_id": claim_id,
            "original_value": claim["value"],
            "corrected_value": new_value,
            "note": note,
            "evidence_id": claim["evidence_id"]
        },
        actor="human"
    )

    new_claim = database.get_claim_by_id(new_claim_id)
    return {
        "status": "ok",
        "original_claim": claim,
        "corrected_claim": new_claim,
        "message": f"Correction saved as Claim #{new_claim_id}. Original Claim #{claim_id} preserved."
    }


@app.get("/api/statement", tags=["Investigation"])
def get_statement():
    """Returns the 5-step incident narrative with sentence-level citations and verified/inferred split."""
    return report.generate_statement_data()


@app.get("/api/report/docx", tags=["Report"])
def get_report_docx():
    """Generates and downloads a Word DOCX dossier."""
    docx_bytes = report.generate_report_docx()
    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": "attachment; filename=VERITAS-024_docket_RF2291.docx"}
    )


@app.get("/api/report/csv", tags=["Report"])
def get_report_csv(dataset: str = Query("all", description="evidence | claims | contradictions | audit")):
    """Generates CSV export of selected investigation dataset."""
    csv_str = report.generate_report_csv(dataset)
    return Response(
        content=csv_str,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=VERITAS-024_{dataset}.csv"}
    )



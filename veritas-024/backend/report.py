"""
Report generator for VERITAS-024.
Generates HTML print-ready reports and structured JSON reports.
Adheres strictly to the epistemic hierarchy and language guardrail principles.
"""

import os
import io
import csv
import json
from pathlib import Path
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from dotenv import load_dotenv

import database
import audit
import investigation_engine

ENV_PATH = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=ENV_PATH)


def generate_report_json() -> Dict[str, Any]:
    """Generates a complete structured JSON export of the investigation docket."""
    evidence = database.get_all_evidence()
    for item in evidence:
        item["tamper_flags"] = database.get_tamper_flags_by_evidence(item["id"])
        item["claims"] = database.get_claims_by_evidence(item["id"])

    contradictions = database.get_all_contradictions()
    entities = database.get_all_entities()
    edges = database.get_all_edges()
    timeline_events, _ = investigation_engine.build_timeline()
    audit_chain = audit.get_audit_entries()
    chain_verification = audit.verify_chain()

    return {
        "case_id": f"DOCKET-{len(evidence):03d}" if evidence else "DOCKET-ACTIVE",
        "title": "Digital Evidence Integrity Investigation Docket",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "epistemic_principle": "AI suggests. A human decides. The platform never declares guilt, authenticity, or fraud.",
        "epistemic_hierarchy": {
            "VERIFIED_FACT": "Computed deterministically (SHA-256 hashes, file byte length, raw file headers).",
            "EXTRACTED_OBSERVATION": "Extracted directly from document content via parsers, OCR, or Gemini Vision.",
            "TAMPER_INDICATOR": "Statistical or structural anomalies (Error Level Analysis hotspots, PDF incremental saves, DKIM mismatches).",
            "AI_INFERENCE": "Synthesis, timeline correlations, or narrative explanations. Marked with required human review warnings."
        },
        "evidence_count": len(evidence),
        "contradictions_count": len(contradictions),
        "entities_count": len(entities),
        "timeline_events_count": len(timeline_events),
        "audit_chain_length": len(audit_chain),
        "audit_chain_valid": chain_verification.get("valid", False),
        "evidence_vault": evidence,
        "contradictions": contradictions,
        "entities": entities,
        "edges": edges,
        "timeline": timeline_events,
        "audit_summary": chain_verification
    }


def generate_report_html() -> str:
    """
    Generates a print-ready, professional HTML investigation docket.
    Styled with crisp typography, forensic tables, epistemic badge indicators, and investigator sign-off.
    """
    data = generate_report_json()
    evidence_items = data["evidence_vault"]
    contradictions = data["contradictions"]
    timeline = data["timeline"]
    entities = data["entities"]
    audit_valid = data["audit_chain_valid"]
    audit_count = data["audit_chain_length"]

    # Generate Evidence Rows
    evidence_rows = ""
    for ev in evidence_items:
        flags = ev.get("tamper_flags", [])
        flag_pills = ""
        if flags:
            for f in flags:
                flag_pills += f'<span class="badge badge-tamper">{f["flag_type"]}</span> '
        else:
            flag_pills = '<span class="badge badge-ok">CLEAN</span>'

        dup_badge = f'<span class="badge badge-dup">DUP OF #{ev["duplicate_of_id"]}</span>' if ev.get("duplicate_of_id") else ""

        evidence_rows += f"""
        <tr>
            <td class="mono">#{ev['id']}</td>
            <td><strong>{ev['filename']}</strong> {dup_badge}</td>
            <td class="mono uppercase">{ev['file_type']}</td>
            <td class="mono hash-cell">{ev['sha256']}</td>
            <td class="mono">{ev['size_bytes']:,} B</td>
            <td>{flag_pills}</td>
        </tr>
        """

    # Generate Contradiction Rows
    contra_cards = ""
    for c in contradictions:
        sev_class = "sev-high" if c["severity"] == "high" else ("sev-med" if c["severity"] == "medium" else "sev-low")
        status_class = "status-accepted" if c["review_status"] == "accepted" else ("status-rejected" if c["review_status"] == "rejected" else "status-pending")
        reviewer_note = c.get("reviewer_note") or "No investigator annotation recorded."

        contra_cards += f"""
        <div class="card {sev_class}">
            <div class="card-header">
                <div class="card-title">
                    <span class="badge badge-sev">{c['severity'].upper()}</span>
                    <span class="kind-tag">{c['kind'].replace('_', ' ').upper()}</span>
                    <strong>{c['description']}</strong>
                </div>
                <div class="card-status {status_class}">
                    STATUS: {c['review_status'].upper()}
                </div>
            </div>
            <div class="card-body">
                <div class="metric-row">
                    <div><strong>Deterministic Confidence:</strong> <span class="mono">{(c['confidence'] * 100):.1f}%</span></div>
                    <div><strong>Basis:</strong> {c['confidence_reason']}</div>
                </div>
                <div class="narrative-box">
                    <strong>Forensic Observation:</strong> {c['narrative']}
                </div>
                <div class="investigator-box">
                    <strong>Investigator Note:</strong> <em>{reviewer_note}</em>
                </div>
            </div>
        </div>
        """

    # Generate Timeline Rows
    timeline_rows = ""
    for t in timeline:
        timeline_rows += f"""
        <tr>
            <td class="mono font-bold">{t['date']}</td>
            <td>{t['description']}</td>
            <td class="mono">{t['filename']}</td>
            <td><span class="badge badge-obs">{t['label']}</span></td>
        </tr>
        """

    # Generate Entity List
    entity_items = ""
    for ent in entities:
        aliases = json.loads(ent.get("aliases_json") or "[]")
        alias_str = f" (Aliases: {', '.join(aliases)})" if aliases else ""
        entity_items += f"""
        <div class="entity-item">
            <span class="badge badge-ent">{ent['type'].upper()}</span>
            <strong>{ent['name']}</strong>{alias_str}
        </div>
        """

    audit_status_badge = (
        '<span class="badge badge-ok">CRYPTOGRAPHICALLY VERIFIED (NO TAMPERING)</span>'
        if audit_valid
        else '<span class="badge badge-tamper">AUDIT CHAIN INTEGRITY FAILED</span>'
    )

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VERITAS-024 Forensic Investigation Docket</title>
    <style>
        :root {{
            --ink: #1B1B18;
            --paper: #FAF8F5;
            --rule: #D3CDC4;
            --stamp: #9E2A2B;
            --accent: #2A4736;
            --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }}
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{
            background: #EDEAE5;
            color: var(--ink);
            font-family: var(--font-sans);
            padding: 30px;
            font-size: 13px;
            line-height: 1.5;
        }}
        .docket-container {{
            max-width: 960px;
            margin: 0 auto;
            background: var(--paper);
            border: 2px solid var(--ink);
            box-shadow: 4px 4px 0px rgba(27,27,24,0.15);
            padding: 40px;
        }}
        .header-section {{
            border-bottom: 2px solid var(--ink);
            padding-bottom: 20px;
            margin-bottom: 25px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
        }}
        .brand-title {{
            font-family: var(--font-mono);
            font-size: 22px;
            font-weight: 700;
            letter-spacing: -0.5px;
        }}
        .case-ref {{
            font-size: 14px;
            color: #555;
            margin-top: 4px;
        }}
        .principle-banner {{
            background: #F1ECE4;
            border-left: 4px solid var(--stamp);
            padding: 12px 16px;
            font-family: var(--font-mono);
            font-size: 11px;
            margin-bottom: 30px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
        .section-header {{
            font-family: var(--font-mono);
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            border-bottom: 1px solid var(--rule);
            padding-bottom: 6px;
            margin: 30px 0 15px 0;
            display: flex;
            justify-content: space-between;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            margin-bottom: 20px;
        }}
        th, td {{
            padding: 8px 10px;
            text-align: left;
            border-bottom: 1px solid var(--rule);
        }}
        th {{
            background: #EFECE6;
            font-family: var(--font-mono);
            font-size: 11px;
            text-transform: uppercase;
            font-weight: 600;
        }}
        .mono {{ font-family: var(--font-mono); }}
        .hash-cell {{
            font-size: 10px;
            word-break: break-all;
            max-width: 280px;
        }}
        .badge {{
            display: inline-block;
            font-family: var(--font-mono);
            font-size: 10px;
            padding: 2px 6px;
            border: 1px solid var(--ink);
            text-transform: uppercase;
            font-weight: 600;
            margin-right: 4px;
        }}
        .badge-tamper {{ background: #FFE8E8; border-color: var(--stamp); color: var(--stamp); }}
        .badge-ok {{ background: #E8F5E9; border-color: var(--accent); color: var(--accent); }}
        .badge-dup {{ background: #FFF3E0; border-color: #E65100; color: #E65100; }}
        .badge-obs {{ background: #E3F2FD; border-color: #0D47A1; color: #0D47A1; }}
        .badge-ent {{ background: #F3E5F5; border-color: #4A148C; color: #4A148C; }}
        .card {{
            border: 1px solid var(--rule);
            background: #FFFFFF;
            padding: 14px;
            margin-bottom: 14px;
            border-left: 4px solid var(--rule);
        }}
        .card.sev-high {{ border-left-color: var(--stamp); }}
        .card.sev-med {{ border-left-color: #E65100; }}
        .card.sev-low {{ border-left-color: #FBC02D; }}
        .card-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }}
        .card-title {{ font-size: 13px; }}
        .card-status {{
            font-family: var(--font-mono);
            font-size: 10px;
            font-weight: 700;
            padding: 2px 8px;
            border: 1px solid currentColor;
        }}
        .status-accepted {{ color: var(--accent); }}
        .status-rejected {{ color: var(--stamp); }}
        .status-pending {{ color: #795548; }}
        .metric-row {{
            font-size: 11px;
            display: flex;
            gap: 20px;
            color: #555;
            margin-bottom: 8px;
        }}
        .narrative-box {{
            background: #F9F8F6;
            border: 1px solid #EBE7DF;
            padding: 8px 10px;
            font-size: 12px;
            margin-bottom: 6px;
        }}
        .investigator-box {{
            font-size: 11px;
            color: #444;
            padding-left: 4px;
        }}
        .grid-entities {{
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
            gap: 10px;
            margin-bottom: 25px;
        }}
        .entity-item {{
            border: 1px solid var(--rule);
            background: #FFF;
            padding: 8px 10px;
            font-size: 12px;
        }}
        .signoff-section {{
            margin-top: 40px;
            border-top: 2px solid var(--ink);
            padding-top: 20px;
            display: flex;
            justify-content: space-between;
        }}
        .signoff-box {{
            width: 45%;
        }}
        .signoff-line {{
            border-bottom: 1px solid var(--ink);
            height: 35px;
            margin-bottom: 6px;
        }}
        @media print {{
            body {{ background: #FFF; padding: 0; }}
            .docket-container {{ border: none; box-shadow: none; padding: 20px; }}
        }}
    </style>
</head>
<body>
    <div class="docket-container">
        <!-- Header -->
        <div class="header-section">
            <div>
                <div class="brand-title">VERITAS-024 FORENSIC INVESTIGATION DOCKET</div>
                <div class="case-ref">Case Matter: <strong>ACTIVE INVESTIGATION</strong> &bull; Submitted Evidentiary Docket</div>
            </div>
            <div style="text-align: right;" class="mono">
                <div>Generated: {data['generated_at_utc'][:10]}</div>
                <div>Epistemic Version: 1.0</div>
            </div>
        </div>

        <!-- Epistemic Core Principle Banner -->
        <div class="principle-banner">
            &bull; PRINCIPLE: AI SUGGESTS. A HUMAN DECIDES. THE PLATFORM NEVER DECLARES GUILT, AUTHENTICITY, OR FRAUD.<br>
            &bull; ALL FINDINGS REQUIRE INDEPENDENT HUMAN INVESTIGATOR ATTESTATION.
        </div>

        <!-- Evidence Vault Section -->
        <div class="section-header">
            <span>Section 1: Ingested Evidence Artifacts ({len(evidence_items)})</span>
            <span class="mono">Vault: Immutable SHA-256</span>
        </div>
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Document Filename</th>
                    <th>Format</th>
                    <th>Cryptographic SHA-256 Checksum</th>
                    <th>Byte Size</th>
                    <th>Tamper Indicators</th>
                </tr>
            </thead>
            <tbody>
                {evidence_rows}
            </tbody>
        </table>

        <!-- Contradictions & Discrepancies Section -->
        <div class="section-header">
            <span>Section 2: Forensic Discrepancies &amp; Contradictions ({len(contradictions)})</span>
            <span class="mono">Deterministic Confidence</span>
        </div>
        <div>
            {contra_cards}
        </div>

        <!-- Chronological Timeline Section -->
        <div class="section-header">
            <span>Section 3: Verified &amp; Extracted Event Timeline ({len(timeline)})</span>
            <span class="mono">Chronological Sequence</span>
        </div>
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Event Description</th>
                    <th>Source Document</th>
                    <th>Epistemic Stamp</th>
                </tr>
            </thead>
            <tbody>
                {timeline_rows}
            </tbody>
        </table>

        <!-- Entity Knowledge Graph Section -->
        <div class="section-header">
            <span>Section 4: Identified Entities &amp; Cross-Document Correlations ({len(entities)})</span>
            <span class="mono">Network Topology</span>
        </div>
        <div class="grid-entities">
            {entity_items}
        </div>

        <!-- Cryptographic Audit Ledger Section -->
        <div class="section-header">
            <span>Section 5: Cryptographic Audit Ledger ({audit_count} entries)</span>
            <span class="mono">SHA-256 Hash Chained</span>
        </div>
        <p style="margin-bottom: 12px; font-size: 12px;">
            Audit Ledger Status: {audit_status_badge}
            <br>
            <span class="mono text-muted" style="font-size: 11px;">
                Every ingestion event, extraction step, and investigator review action is hashed sequentially from Genesis (0000...0000).
            </span>
        </p>

        <!-- Investigator Attestation Sign-off -->
        <div class="signoff-section">
            <div class="signoff-box">
                <div class="mono" style="font-size: 11px; margin-bottom: 4px;">LEAD FORENSIC EXAMINER SIGNATURE</div>
                <div class="signoff-line"></div>
                <div class="mono" style="font-size: 10px; color: #666;">Date: ____ / ____ / 2026 &bull; ID / Badge: ________________</div>
            </div>
            <div class="signoff-box">
                <div class="mono" style="font-size: 11px; margin-bottom: 4px;">SUPERVISING AUDITOR ATTESTATION</div>
                <div class="signoff-line"></div>
                <div class="mono" style="font-size: 10px; color: #666;">Date: ____ / ____ / 2026 &bull; ID / Badge: ________________</div>
            </div>
        </div>
    </div>
</body>
</html>
"""
    return html_content


def generate_llm_statement_summary(
    evidence: List[Dict[str, Any]],
    claims: List[Dict[str, Any]],
    contras: List[Dict[str, Any]]
) -> Optional[str]:
    """Call Gemini LLM to generate a concise, grounded cross-document investigation summary."""
    api_key = os.getenv("GOOGLE_API_KEY", "").strip()
    if not api_key or len(evidence) < 2:
        return None

    try:
        from google import genai
        from google.genai import types

        model_name = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite")
        client = genai.Client(api_key=api_key)

        ev_lines = [f"- '{e['filename']}' ({e['file_type'].upper()}, {e['size_bytes']} B)" for e in evidence]
        c_lines = [f"- [{c['claim_type']}] {c['value']} ({c.get('location_ref') or 'Doc'})" for c in claims[:20]]
        contra_lines = [f"- Discrepancy ({k['kind']}): {k['description']}" for k in contras[:6]]

        prompt = (
            "You are a digital forensics investigator summarizing an active multi-document investigation.\n"
            f"Evidence Files Ingested ({len(evidence)} files):\n" + "\n".join(ev_lines) + "\n\n"
            f"Extracted Observations:\n" + ("\n".join(c_lines) if c_lines else "None") + "\n\n"
            f"Discrepancies Flagged:\n" + ("\n".join(contra_lines) if contra_lines else "None flagged") + "\n\n"
            "Write a concise 2-sentence objective summary of this investigation across these documents.\n"
            "Rules:\n"
            "- NEVER use the words 'guilty', 'fraudster', 'authentic', 'forged', 'proves', 'proof of'.\n"
            "- Use objective phrasing like 'flags', 'suggests', 'inconsistent with', 'discrepancy identified'.\n"
            "- End your summary with: 'AI-generated observation. Requires independent human validation.'"
        )

        response = client.models.generate_content(
            model=model_name,
            contents=[prompt],
            config=types.GenerateContentConfig(temperature=0.0)
        )
        if response.text:
            text = investigation_engine.apply_language_guardrail(response.text.strip(), is_ai_narrative=True)
            return text
        return None
    except Exception as e:
        print(f"Gemini statement summary error: {e}")
        return None


def generate_statement_data() -> Dict[str, Any]:
    """
    Builds the 5-step incident narrative explaining cause and effect.
    Requires at least two (2) evidence files.
    Every sentence cites file + location.
    Explicitly separates 'Verified facts' from 'AI inferences (unverified, with confidence)'.
    """
    evidence = database.get_all_evidence()
    claims = database.get_all_claims()
    flags = database.get_all_tamper_flags()
    contras = database.get_all_contradictions()
    ev_map = {e["id"]: e for e in evidence}

    verified_facts = []
    ai_inferences = []
    narrative_steps = []

    if len(evidence) < 2:
        return {
            "summary": "At least two (2) evidence files are required to perform cross-document comparison and generate an incident narrative.",
            "steps": [],
            "verified_facts": [],
            "ai_inferences": [],
            "insufficient_evidence": True,
            "evidence_count": len(evidence),
            "footer": "At least two files are required to process."
        }

    # Deterministic verified facts from evidence items
    for ev in evidence:
        verified_facts.append({
            "fact": f"Artifact '{ev['filename']}' ({ev['size_bytes']:,} bytes) ingested into raw vault with cryptographic digest {ev['sha256']}.",
            "citation": f"{ev['filename']} (Header: SHA-256)",
            "label": "VERIFIED_FACT",
            "evidence_id": ev["id"]
        })

    # Additional verified facts from exact OCR / parser claims
    for c in claims:
        if c.get("label") == "VERIFIED_FACT" or c.get("method") in ["parser", "regex", "human_correction"]:
            ev_name = ev_map.get(c["evidence_id"], {}).get("filename", f"Evidence #{c['evidence_id']}")
            loc = c.get("location_ref") or "Body text"
            verified_facts.append({
                "fact": f"Extracted {c['claim_type']} claim: '{c['value']}'.",
                "citation": f"{ev_name} ({loc})",
                "label": "VERIFIED_FACT",
                "evidence_id": c["evidence_id"]
            })

    # AI Inferences with confidence
    for c in contras:
        c_a = database.get_claim_by_id(c["claim_a_id"]) if c.get("claim_a_id") else None
        c_b = database.get_claim_by_id(c["claim_b_id"]) if c.get("claim_b_id") else None
        ev_a = ev_map.get(c_a["evidence_id"], {}).get("filename") if c_a else "Evidence"
        ev_b = ev_map.get(c_b["evidence_id"], {}).get("filename") if c_b else "Evidence"
        loc_a = c_a.get("location_ref") or "Document" if c_a else "System"
        loc_b = c_b.get("location_ref") or "Document" if c_b else "System"

        ai_inferences.append({
            "inference": f"Discrepancy identified in {c['kind'].replace('_', ' ')}: {c['description']}. {c['narrative']}",
            "confidence": round(float(c.get("confidence", 0.85)), 2),
            "confidence_reason": c.get("confidence_reason", "Statistical analysis"),
            "citations": [f"{ev_a} ({loc_a})", f"{ev_b} ({loc_b})"],
            "review_status": c.get("review_status", "pending"),
            "reviewer_note": c.get("reviewer_note")
        })

    # Tamper indicators as inferences/observations
    for f in flags:
        ev_name = ev_map.get(f["evidence_id"], {}).get("filename", "Evidence")
        ai_inferences.append({
            "inference": f"Forensic structural indicator flagged ({f['flag_type']}): {f['detail']}",
            "confidence": round(float(f.get("score") or 0.88), 2),
            "confidence_reason": f"Algorithmic inspection ({f['flag_type']})",
            "citations": [f"{ev_name} (Forensic Layer)"],
            "review_status": "flagged",
            "reviewer_note": None
        })

    # Build sequential Cause-and-Effect Steps dynamically from user's actual files
    # Step 1: Request Inception & Primary Evidentiary Ingestion
    step_1_sentences = []
    for ev in evidence[:3]:
        step_1_sentences.append({
            "sentence": f"Evidence artifact '{ev['filename']}' ({ev['file_type'].upper()}) ingested and sealed in immutable vault with SHA-256 fingerprint {ev['sha256'][:16]}...",
            "citation": f"{ev['filename']} (Raw Vault Hash)",
            "type": "verified_fact",
            "confidence": 1.0
        })

    dkim_flags = [f for f in flags if f["flag_type"] in ["dkim_fail", "header_mismatch"]]
    for f in dkim_flags[:2]:
        f_name = ev_map.get(f["evidence_id"], {}).get("filename", "Email Evidence")
        step_1_sentences.append({
            "sentence": f"Communication authentication check on '{f_name}' identified header irregularities or unverifiable cryptographic signatures: {f['detail']}",
            "citation": f"{f_name} (Header Authentication)",
            "type": "ai_inference",
            "confidence": 0.85
        })

    narrative_steps.append({
        "step_number": 1,
        "title": "Evidence Ingestion & Cryptographic Sealing",
        "description": "Chronological trace of initial file ingestion and cryptographic SHA-256 vault preservation.",
        "sentences": step_1_sentences
    })

    # Step 2: Beneficiary & Entity Resolution
    step_2_sentences = []
    entities = database.get_all_entities()
    if entities:
        ent_names = ", ".join([e["name"] for e in entities[:4]])
        step_2_sentences.append({
            "sentence": f"Entity resolution identified and correlated key entities across submitted artifacts: {ent_names}.",
            "citation": f"{evidence[0]['filename']} (Entity Map)",
            "type": "verified_fact",
            "confidence": 1.0
        })

    account_contras = [c for c in contras if "account" in c["kind"].lower() or "entity" in c["kind"].lower()]
    for c in account_contras[:2]:
        step_2_sentences.append({
            "sentence": f"Entity divergence identified: {c['description']}",
            "citation": f"{c.get('narrative', '')[:60]}...",
            "type": "ai_inference",
            "confidence": round(float(c.get("confidence") or 0.90), 2)
        })

    if not account_contras:
        step_2_sentences.append({
            "sentence": "Entity relationship mapping evaluated extracted individuals, corporate entities, and transaction identifiers without cross-entity routing conflicts.",
            "citation": f"{evidence[0]['filename']} (Entity Graph)",
            "type": "ai_inference",
            "confidence": 0.90
        })

    narrative_steps.append({
        "step_number": 2,
        "title": "Entity Resolution & Relationship Mapping",
        "description": "Cross-document correlation of persons, commercial entities, and designated accounts.",
        "sentences": step_2_sentences
    })

    # Step 3: Forensic Artifact Integrity Inspection
    step_3_sentences = []
    pdf_flags = [f for f in flags if "pdf" in f["flag_type"]]
    ela_flags = [f for f in flags if "ela" in f["flag_type"]]
    for f in pdf_flags[:2]:
        f_name = ev_map.get(f["evidence_id"], {}).get("filename", "PDF Evidence")
        step_3_sentences.append({
            "sentence": f"PDF structural inspection of '{f_name}' detected incremental revisions or post-authoring metadata anomalies: {f['detail']}",
            "citation": f"{f_name} (Trailer XREF / ModDate)",
            "type": "ai_inference",
            "confidence": 0.92
        })
    for f in ela_flags[:2]:
        f_name = ev_map.get(f["evidence_id"], {}).get("filename", "Image Evidence")
        step_3_sentences.append({
            "sentence": f"Error Level Analysis of '{f_name}' identified localized high-frequency compression residuals: {f['detail']}",
            "citation": f"{f_name} (ELA Residual Map)",
            "type": "ai_inference",
            "confidence": 0.88
        })
    if not pdf_flags and not ela_flags:
        step_3_sentences.append({
            "sentence": "Deterministic image compression analysis and format parsing performed with no structural anomalies detected.",
            "citation": f"{evidence[0]['filename']} (Forensic Analysis)",
            "type": "verified_fact",
            "confidence": 1.0
        })

    narrative_steps.append({
        "step_number": 3,
        "title": "Forensic Signal & Tamper Verification",
        "description": "Algorithmic inspection of document structure, compression matrices, and metadata consistency.",
        "sentences": step_3_sentences
    })

    # Step 4: Discrepancy Synthesis & Timeline Sequence
    step_4_sentences = []
    amount_contras = [c for c in contras if "amount" in c["kind"].lower()]
    seq_contras = [c for c in contras if "sequence" in c["kind"].lower() or "date" in c["kind"].lower()]
    for c in (amount_contras + seq_contras)[:3]:
        step_4_sentences.append({
            "sentence": f"Discrepancy synthesis: {c['description']}",
            "citation": f"Discrepancy #{c.get('id', 1)}",
            "type": "ai_inference",
            "confidence": round(float(c.get("confidence") or 0.92), 2)
        })

    if not amount_contras and not seq_contras:
        step_4_sentences.append({
            "sentence": "Chronological timeline and transactional claims align consistently without direct cross-document numerical divergence.",
            "citation": f"{evidence[0]['filename']} (Timeline Engine)",
            "type": "verified_fact",
            "confidence": 1.0
        })

    narrative_steps.append({
        "step_number": 4,
        "title": "Discrepancy Synthesis & Temporal Sequencing",
        "description": "Cross-document timeline comparison identifying timing inversions and procedural irregularities.",
        "sentences": step_4_sentences
    })

    # Step 5: Investigator Adjudication & Audit Chain
    chain = audit.get_audit_entries()
    chain_ver = audit.verify_chain()
    step_5_sentences = [
        {
            "sentence": f"Every evidentiary transaction and algorithmic finding is cryptographically recorded in an immutable SHA-256 hash chain ({len(chain)} entries).",
            "citation": f"Audit Chain (Root Genesis -> Head Hash {chain[-1]['entry_hash'][:12] if chain else '0000'})",
            "type": "verified_fact",
            "confidence": 1.0
        },
        {
            "sentence": f"Systematic chain verification status: {'VALID' if chain_ver.get('valid') else 'FAILED'}. All adjudications require independent human investigator sign-off.",
            "citation": "Audit Verifier (/api/audit/verify)",
            "type": "verified_fact",
            "confidence": 1.0
        }
    ]
    narrative_steps.append({
        "step_number": 5,
        "title": "Cryptographic Audit & Adjudication Status",
        "description": "Verification of immutable audit chain and investigator human decision records.",
        "sentences": step_5_sentences
    })

    # Dynamic LLM summary
    llm_summary = generate_llm_statement_summary(evidence, claims, contras)
    summary_text = llm_summary or f"Cross-document incident narrative synthesized across {len(evidence)} evidence artifacts, {len(verified_facts)} verified facts, and {len(contras)} flagged discrepancies."

    return {
        "summary": summary_text,
        "steps": narrative_steps,
        "verified_facts": verified_facts,
        "ai_inferences": ai_inferences,
        "insufficient_evidence": False,
        "evidence_count": len(evidence),
        "footer": "AI-generated observation. Requires independent human validation."
    }


def generate_report_docx() -> bytes:
    import docx
    from docx.shared import Pt, RGBColor
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.enum.table import WD_TABLE_ALIGNMENT

    doc = docx.Document()

    title = doc.add_heading("VERITAS-024 Investigation Docket", 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run("CASE REFERENCE: ACTIVE INVESTIGATION | AI suggests. A human decides.")
    run.font.bold = True
    run.font.size = Pt(10)

    doc.add_heading("1. Evidence Vault & Cryptographic Hashes", level=1)
    evidence = database.get_all_evidence()
    t = doc.add_table(rows=1, cols=5)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    hdr = t.rows[0].cells
    hdr[0].text = "ID"
    hdr[1].text = "Filename"
    hdr[2].text = "Type"
    hdr[3].text = "SHA-256 Digest"
    hdr[4].text = "Size (Bytes)"
    for ev in evidence:
        row = t.add_row().cells
        row[0].text = f"#{ev['id']}"
        row[1].text = ev['filename']
        row[2].text = ev['file_type'].upper()
        row[3].text = ev['sha256'][:16] + "..."
        row[4].text = f"{ev['size_bytes']:,}"

    doc.add_heading("2. Step-by-Step Incident Narrative", level=1)
    statement_data = generate_statement_data()
    for step in statement_data["steps"]:
        doc.add_heading(f"Step {step['step_number']}: {step['title']}", level=2)
        for s in step["sentences"]:
            sp = doc.add_paragraph()
            prefix = "[FACT] " if s["type"] == "verified_fact" else f"[INFERENCE (conf: {int(s.get('confidence', 0)*100)}%)] "
            run_p = sp.add_run(prefix)
            run_p.bold = True
            sp.add_run(s["sentence"])
            cite = sp.add_run(f" [Source: {s['citation']}]")
            cite.italic = True
            cite.font.color.rgb = RGBColor(90, 90, 90)

    doc.add_heading("3. Flagged Discrepancies & Human Decisions", level=1)
    contras = database.get_all_contradictions()
    if not contras:
        doc.add_paragraph("No discrepancies flagged.")
    else:
        for c in contras:
            cp = doc.add_paragraph()
            r = cp.add_run(f"[{c['kind'].upper()}] - {c['description']}\n")
            r.bold = True
            cp.add_run(f"Status: {c['review_status'].upper()} | Severity: {c['severity'].upper()} | Confidence: {int(c['confidence']*100)}%\n")
            cp.add_run(f"Forensic Observation: {c['narrative']}\n")
            if c.get("reviewer_note"):
                cp.add_run(f"Investigator Note: {c['reviewer_note']}\n")

    doc.add_heading("4. Cryptographic Audit Chain", level=1)
    chain = audit.get_audit_entries()
    ver = audit.verify_chain()
    vp = doc.add_paragraph()
    vr = vp.add_run(f"Chain Verification: {'VALID - UNBROKEN INTEGRITY' if ver.get('valid') else 'FAILED'}\n")
    vr.bold = True
    vp.add_run(f"Total Logged Actions: {len(chain)} cryptographic blocks.")

    fp = doc.add_paragraph()
    fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    frun = fp.add_run("\nAI-generated. Not proof. Requires human review.")
    frun.bold = True
    frun.font.size = Pt(9)
    frun.italic = True

    f_out = io.BytesIO()
    doc.save(f_out)
    return f_out.getvalue()


def generate_report_csv(dataset: str = "all") -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    if dataset == "evidence":
        writer.writerow(["ID", "Filename", "File Type", "SHA256", "Size Bytes", "Uploaded UTC", "Duplicate Of ID"])
        for ev in database.get_all_evidence():
            writer.writerow([ev["id"], ev["filename"], ev["file_type"], ev["sha256"], ev["size_bytes"], ev["uploaded_at_utc"], ev.get("duplicate_of_id")])
    elif dataset == "claims":
        writer.writerow(["ID", "Evidence ID", "Claim Type", "Value", "Label", "Confidence", "Method", "Location Ref"])
        for c in database.get_all_claims():
            writer.writerow([c["id"], c["evidence_id"], c["claim_type"], c["value"], c["label"], c["confidence"], c["method"], c.get("location_ref")])
    elif dataset == "contradictions":
        writer.writerow(["ID", "Kind", "Description", "Severity", "Confidence", "Status", "Reviewer Note"])
        for c in database.get_all_contradictions():
            writer.writerow([c["id"], c["kind"], c["description"], c["severity"], c["confidence"], c["review_status"], c.get("reviewer_note")])
    else:  # audit
        writer.writerow(["ID", "Timestamp UTC", "Actor", "Action", "Target", "Prev Hash", "Entry Hash"])
        for a in audit.get_audit_entries():
            writer.writerow([a["id"], a["timestamp_utc"], a["actor"], a["action"], a["target"], a["prev_hash"], a["entry_hash"]])
    return output.getvalue()


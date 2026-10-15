"""
Report generator for VERITAS-024.
Generates HTML print-ready reports and structured JSON reports.
Adheres strictly to the epistemic hierarchy and language guardrail principles.
"""

import json
from datetime import datetime, timezone
from typing import Any, Dict, List

import database
import audit
import investigation_engine


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
        "case_id": "RF-2291",
        "title": "Suspected Irregular Refund Disbursal Investigation Docket",
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
    <title>VERITAS-024 Investigation Docket - RF-2291</title>
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
                <div class="case-ref">Case Matter: <strong>RF-2291</strong> &bull; CineWave Retail Disbursal Discrepancy</div>
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

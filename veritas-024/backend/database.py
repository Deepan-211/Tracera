"""
Database module for VERITAS-024
Manages SQLite in WAL mode with the strict 7-table schema.
"""

import os
import sqlite3
import json
from pathlib import Path
from typing import Any, Dict, List, Optional

DB_PATH = Path(__file__).parent / "veritas.db"


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


def init_db() -> None:
    """Initialize database tables and WAL mode."""
    conn = get_db_connection()
    with conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS evidence_vault (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            file_type TEXT NOT NULL,
            sha256 TEXT NOT NULL,
            phash TEXT,
            size_bytes INTEGER NOT NULL,
            uploaded_at_utc TEXT NOT NULL,
            vault_path TEXT NOT NULL,
            source_note TEXT,
            duplicate_of_id INTEGER REFERENCES evidence_vault(id),
            meta_json TEXT
        );

        CREATE TABLE IF NOT EXISTS extracted_claims (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            evidence_id INTEGER NOT NULL REFERENCES evidence_vault(id),
            claim_type TEXT NOT NULL, -- date | amount | person | org | location | account | txn_ref | statement
            value TEXT NOT NULL,
            normalized_value TEXT,
            label TEXT NOT NULL, -- VERIFIED_FACT | EXTRACTED_OBSERVATION | TAMPER_INDICATOR | AI_INFERENCE
            location_ref TEXT, -- page/line/bbox e.g. "page 1", "line 12", "[100,120,40,20]"
            confidence REAL NOT NULL DEFAULT 1.0,
            method TEXT NOT NULL -- parser | gemini | rapidocr | regex
        );

        CREATE TABLE IF NOT EXISTS entities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            type TEXT NOT NULL, -- person | org | location | account | txn_ref
            aliases_json TEXT -- JSON list of known aliases
        );

        CREATE TABLE IF NOT EXISTS edges (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_entity_id INTEGER NOT NULL REFERENCES entities(id),
            target_entity_id INTEGER NOT NULL REFERENCES entities(id),
            relation TEXT NOT NULL,
            evidence_claim_ids_json TEXT, -- JSON array of claim IDs supporting this edge
            label TEXT NOT NULL -- EXTRACTED_OBSERVATION | AI_INFERENCE
        );

        CREATE TABLE IF NOT EXISTS tamper_flags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            evidence_id INTEGER NOT NULL REFERENCES evidence_vault(id),
            flag_type TEXT NOT NULL, -- ela_anomaly | pdf_revision | pdf_meta_mismatch | dkim_fail | header_mismatch | duplicate
            detail TEXT NOT NULL,
            region_json TEXT, -- JSON bbox {x, y, w, h}
            score REAL NOT NULL DEFAULT 0.0,
            label TEXT NOT NULL DEFAULT 'TAMPER_INDICATOR'
        );

        CREATE TABLE IF NOT EXISTS contradictions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            kind TEXT NOT NULL, -- sequence_violation | date_conflict | amount_conflict | account_conflict | metadata_vs_content | duplicate_content
            description TEXT NOT NULL,
            claim_a_id INTEGER REFERENCES extracted_claims(id),
            claim_b_id INTEGER REFERENCES extracted_claims(id),
            severity TEXT NOT NULL, -- low | medium | high
            confidence REAL NOT NULL,
            confidence_reason TEXT NOT NULL,
            narrative TEXT NOT NULL,
            review_status TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | rejected | needs_more_info
            reviewer_note TEXT,
            label TEXT NOT NULL DEFAULT 'TAMPER_INDICATOR'
        );

        CREATE TABLE IF NOT EXISTS audit_chain (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp_utc TEXT NOT NULL,
            actor TEXT NOT NULL, -- system | human
            action TEXT NOT NULL,
            target TEXT NOT NULL,
            detail_json TEXT NOT NULL,
            prev_hash TEXT NOT NULL,
            entry_hash TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_claims_evidence ON extracted_claims(evidence_id);
        CREATE INDEX IF NOT EXISTS idx_tamper_evidence ON tamper_flags(evidence_id);
        CREATE INDEX IF NOT EXISTS idx_audit_prev_hash ON audit_chain(prev_hash);
        """)
    conn.close()


# Database helper functions

def insert_evidence(
    filename: str,
    file_type: str,
    sha256: str,
    phash: Optional[str],
    size_bytes: int,
    uploaded_at_utc: str,
    vault_path: str,
    source_note: Optional[str] = None,
    duplicate_of_id: Optional[int] = None,
    meta_json: Optional[str] = None
) -> int:
    conn = get_db_connection()
    with conn:
        cursor = conn.execute(
            """
            INSERT INTO evidence_vault (
                filename, file_type, sha256, phash, size_bytes,
                uploaded_at_utc, vault_path, source_note, duplicate_of_id, meta_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                filename, file_type, sha256, phash, size_bytes,
                uploaded_at_utc, vault_path, source_note, duplicate_of_id, meta_json
            )
        )
        evidence_id = cursor.lastrowid
    conn.close()
    return evidence_id


def get_all_evidence() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM evidence_vault ORDER BY id ASC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_evidence_by_id(evidence_id: int) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM evidence_vault WHERE id = ?", (evidence_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_evidence_by_sha256(sha256: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM evidence_vault WHERE sha256 = ?", (sha256,)).fetchone()
    conn.close()
    return dict(row) if row else None


def insert_claim(
    evidence_id: int,
    claim_type: str,
    value: str,
    normalized_value: Optional[str],
    label: str,
    location_ref: Optional[str],
    confidence: float,
    method: str
) -> int:
    conn = get_db_connection()
    with conn:
        cursor = conn.execute(
            """
            INSERT INTO extracted_claims (
                evidence_id, claim_type, value, normalized_value,
                label, location_ref, confidence, method
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                evidence_id, claim_type, value, normalized_value,
                label, location_ref, confidence, method
            )
        )
        claim_id = cursor.lastrowid
    conn.close()
    return claim_id


def get_claims_by_evidence(evidence_id: int) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute(
        "SELECT * FROM extracted_claims WHERE evidence_id = ? ORDER BY id ASC",
        (evidence_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_all_claims() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM extracted_claims ORDER BY id ASC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_claim_by_id(claim_id: int) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM extracted_claims WHERE id = ?", (claim_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def insert_tamper_flag(
    evidence_id: int,
    flag_type: str,
    detail: str,
    region_json: Optional[str],
    score: float,
    label: str = "TAMPER_INDICATOR"
) -> int:
    conn = get_db_connection()
    with conn:
        cursor = conn.execute(
            """
            INSERT INTO tamper_flags (
                evidence_id, flag_type, detail, region_json, score, label
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            (evidence_id, flag_type, detail, region_json, score, label)
        )
        flag_id = cursor.lastrowid
    conn.close()
    return flag_id


def get_tamper_flags_by_evidence(evidence_id: int) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute(
        "SELECT * FROM tamper_flags WHERE evidence_id = ? ORDER BY id ASC",
        (evidence_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_all_tamper_flags() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM tamper_flags ORDER BY id ASC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def clear_all_data() -> None:
    """Clear all data from all tables (used for seed reset)."""
    conn = get_db_connection()
    with conn:
        conn.execute("DELETE FROM audit_chain")
        conn.execute("DELETE FROM contradictions")
        conn.execute("DELETE FROM tamper_flags")
        conn.execute("DELETE FROM edges")
        conn.execute("DELETE FROM entities")
        conn.execute("DELETE FROM extracted_claims")
        conn.execute("DELETE FROM evidence_vault")
    conn.close()


def clear_investigation_results() -> None:
    """Clear derived investigation results (contradictions, edges, entities) before re-analysis."""
    conn = get_db_connection()
    with conn:
        conn.execute("DELETE FROM contradictions")
        conn.execute("DELETE FROM edges")
        conn.execute("DELETE FROM entities")
    conn.close()


def delete_claims_by_evidence(evidence_id: int) -> None:
    conn = get_db_connection()
    with conn:
        conn.execute("DELETE FROM extracted_claims WHERE evidence_id = ?", (evidence_id,))
    conn.close()


# -------------------------------------------------------------------------
# Entity helpers
# -------------------------------------------------------------------------

def insert_entity(name: str, entity_type: str, aliases: Optional[List[str]] = None) -> int:
    conn = get_db_connection()
    aliases_json = json.dumps(aliases or [])
    with conn:
        existing = conn.execute("SELECT id, aliases_json FROM entities WHERE name = ?", (name,)).fetchone()
        if existing:
            ent_id = existing["id"]
            if aliases:
                curr_aliases = set(json.loads(existing["aliases_json"] or "[]"))
                curr_aliases.update(aliases)
                conn.execute(
                    "UPDATE entities SET aliases_json = ? WHERE id = ?",
                    (json.dumps(list(curr_aliases)), ent_id)
                )
            conn.close()
            return ent_id

        cursor = conn.execute(
            "INSERT INTO entities (name, type, aliases_json) VALUES (?, ?, ?)",
            (name, entity_type, aliases_json)
        )
        ent_id = cursor.lastrowid
    conn.close()
    return ent_id


def get_entity_by_name(name: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM entities WHERE name = ?", (name,)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_entity_by_id(entity_id: int) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM entities WHERE id = ?", (entity_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_all_entities() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM entities ORDER BY id ASC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def update_entity_aliases(entity_id: int, aliases: List[str]) -> None:
    conn = get_db_connection()
    with conn:
        conn.execute(
            "UPDATE entities SET aliases_json = ? WHERE id = ?",
            (json.dumps(aliases), entity_id)
        )
    conn.close()


# -------------------------------------------------------------------------
# Edge helpers
# -------------------------------------------------------------------------

def insert_edge(
    source_entity_id: int,
    target_entity_id: int,
    relation: str,
    evidence_claim_ids: Optional[List[int]] = None,
    label: str = "EXTRACTED_OBSERVATION"
) -> int:
    conn = get_db_connection()
    claims_json = json.dumps(evidence_claim_ids or [])
    with conn:
        cursor = conn.execute(
            """
            INSERT INTO edges (
                source_entity_id, target_entity_id, relation,
                evidence_claim_ids_json, label
            ) VALUES (?, ?, ?, ?, ?)
            """,
            (source_entity_id, target_entity_id, relation, claims_json, label)
        )
        edge_id = cursor.lastrowid
    conn.close()
    return edge_id


def get_all_edges() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM edges ORDER BY id ASC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


# -------------------------------------------------------------------------
# Contradiction helpers
# -------------------------------------------------------------------------

def insert_contradiction(
    kind: str,
    description: str,
    claim_a_id: Optional[int] = None,
    claim_b_id: Optional[int] = None,
    severity: str = "medium",
    confidence: float = 1.0,
    confidence_reason: str = "",
    narrative: str = "",
    review_status: str = "pending",
    reviewer_note: Optional[str] = None,
    label: str = "TAMPER_INDICATOR"
) -> int:
    conn = get_db_connection()
    with conn:
        cursor = conn.execute(
            """
            INSERT INTO contradictions (
                kind, description, claim_a_id, claim_b_id,
                severity, confidence, confidence_reason, narrative,
                review_status, reviewer_note, label
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                kind, description, claim_a_id, claim_b_id,
                severity, confidence, confidence_reason, narrative,
                review_status, reviewer_note, label
            )
        )
        cid = cursor.lastrowid
    conn.close()
    return cid


def get_all_contradictions() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM contradictions ORDER BY id ASC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_contradiction_by_id(cid: int) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM contradictions WHERE id = ?", (cid,)).fetchone()
    conn.close()
    return dict(row) if row else None


def update_contradiction_review(
    cid: int,
    review_status: str,
    reviewer_note: Optional[str] = None
) -> bool:
    conn = get_db_connection()
    with conn:
        cursor = conn.execute(
            """
            UPDATE contradictions
            SET review_status = ?, reviewer_note = ?
            WHERE id = ?
            """,
            (review_status, reviewer_note, cid)
        )
        updated = cursor.rowcount > 0
    conn.close()
    return updated


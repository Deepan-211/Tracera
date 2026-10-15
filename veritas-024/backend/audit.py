"""
Audit log module with cryptographic hash-chaining for VERITAS-024.
entry_hash = SHA-256(prev_hash + timestamp + actor + action + target + detail_json)
"""

import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from database import get_db_connection

GENESIS_HASH = "0" * 64


def compute_entry_hash(
    prev_hash: str,
    timestamp_utc: str,
    actor: str,
    action: str,
    target: str,
    detail_json: str
) -> str:
    raw_payload = f"{prev_hash}{timestamp_utc}{actor}{action}{target}{detail_json}"
    return hashlib.sha256(raw_payload.encode("utf-8")).hexdigest()


def log_audit_entry(
    action: str,
    target: str,
    detail: Dict[str, Any],
    actor: str = "system",
    timestamp_utc: Optional[str] = None
) -> Dict[str, Any]:
    if timestamp_utc is None:
        timestamp_utc = datetime.now(timezone.utc).isoformat()

    detail_json = json.dumps(detail, sort_keys=True)

    conn = get_db_connection()
    with conn:
        # Get the latest entry's entry_hash
        cursor = conn.execute("SELECT entry_hash FROM audit_chain ORDER BY id DESC LIMIT 1")
        last_row = cursor.fetchone()
        prev_hash = last_row["entry_hash"] if last_row else GENESIS_HASH

        entry_hash = compute_entry_hash(
            prev_hash=prev_hash,
            timestamp_utc=timestamp_utc,
            actor=actor,
            action=action,
            target=target,
            detail_json=detail_json
        )

        cursor = conn.execute(
            """
            INSERT INTO audit_chain (
                timestamp_utc, actor, action, target, detail_json, prev_hash, entry_hash
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (timestamp_utc, actor, action, target, detail_json, prev_hash, entry_hash)
        )
        row_id = cursor.lastrowid

    conn.close()
    return {
        "id": row_id,
        "timestamp_utc": timestamp_utc,
        "actor": actor,
        "action": action,
        "target": target,
        "detail": detail,
        "prev_hash": prev_hash,
        "entry_hash": entry_hash
    }


def get_audit_entries() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM audit_chain ORDER BY id ASC").fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        try:
            d["detail"] = json.loads(d["detail_json"])
        except Exception:
            d["detail"] = d["detail_json"]
        result.append(d)
    return result


def verify_chain() -> Dict[str, Any]:
    """
    Recompute SHA-256 for every entry from genesis.
    Returns valid: True or broken_id, expected_hash, actual_hash.
    """
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM audit_chain ORDER BY id ASC").fetchall()
    conn.close()

    if not rows:
        return {"valid": True, "entries_checked": 0, "message": "Audit chain empty, valid by definition."}

    expected_prev = GENESIS_HASH
    for r in rows:
        row_id = r["id"]
        ts = r["timestamp_utc"]
        actor = r["actor"]
        action = r["action"]
        target = r["target"]
        detail_json = r["detail_json"]
        prev_hash = r["prev_hash"]
        entry_hash = r["entry_hash"]

        if prev_hash != expected_prev:
            return {
                "valid": False,
                "broken_id": row_id,
                "reason": f"prev_hash mismatch: expected {expected_prev[:12]}..., got {prev_hash[:12]}...",
                "entry": dict(r)
            }

        recalculated = compute_entry_hash(
            prev_hash=prev_hash,
            timestamp_utc=ts,
            actor=actor,
            action=action,
            target=target,
            detail_json=detail_json
        )

        if recalculated != entry_hash:
            return {
                "valid": False,
                "broken_id": row_id,
                "reason": f"entry_hash tampering detected at row {row_id}: computed {recalculated[:12]}..., stored {entry_hash[:12]}...",
                "entry": dict(r)
            }

        expected_prev = entry_hash

    return {
        "valid": True,
        "entries_checked": len(rows),
        "latest_hash": expected_prev,
        "message": f"Audit chain verified successfully across {len(rows)} entries."
    }

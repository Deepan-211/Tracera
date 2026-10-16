"""
Zero-Mock Evidence Architecture for Tracera.
All mock, hardcoded, and synthetic case data has been removed.

The platform operates strictly on real user-uploaded evidence artifacts analyzed
dynamically using Google Gemini LLM and deterministic forensic engines.
"""

from typing import List, Tuple


def get_seed_files() -> List[Tuple[str, str, bytes, str]]:
    """
    All mock and hardcoded datasets have been completely removed.
    Returns an empty list so zero synthetic artifacts are ever seeded into the vault.
    """
    return []

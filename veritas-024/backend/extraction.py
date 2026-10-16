"""
Extraction module for VERITAS-024.
Extracts structured claims from multi-format artifacts:
- Text source order: PyMuPDF text (PDF), parsers (EML/Chat), Gemini Vision (Images), RapidOCR (fallback), Regex (last resort).
- Epistemic classification: EXTRACTED_OBSERVATION.
- Normalizes dates to ISO (YYYY-MM-DD, Indian format DD/MM/YYYY assumed) and amounts to numeric INR.
- Strict source location referencing (page number, line number, or bounding box).
"""

import os
import re
import json
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, Field
import fitz  # PyMuPDF
from dotenv import load_dotenv

import audit

# Load environment
ENV_PATH = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=ENV_PATH)


class ExtractedClaim(BaseModel):
    claim_type: str = Field(description="date | amount | person | org | location | account | txn_ref | statement")
    value: str = Field(description="Extracted verbatim value")
    normalized_value: Optional[str] = Field(default=None, description="ISO date YYYY-MM-DD or numeric amount")
    location_ref: Optional[str] = Field(default=None, description="Source location e.g. page 1, line 3, or [x,y,w,h]")
    quote: Optional[str] = Field(default=None, description="Supporting verbatim quotation")
    confidence: float = Field(default=0.90)
    method: str = Field(default="parser")  # parser | gemini | rapidocr | regex


class ExtractionResult(BaseModel):
    claims: List[ExtractedClaim] = Field(default_factory=list)


# -------------------------------------------------------------------------
# Normalization Utilities
# -------------------------------------------------------------------------

MONTH_MAP = {
    "jan": "01", "january": "01",
    "feb": "02", "february": "02",
    "mar": "03", "march": "03",
    "apr": "04", "april": "04",
    "may": "05",
    "jun": "06", "june": "06",
    "jul": "07", "july": "07",
    "aug": "08", "august": "08",
    "sep": "09", "september": "09",
    "oct": "10", "october": "10",
    "nov": "11", "november": "11",
    "dec": "12", "december": "12"
}


def normalize_date(text: str) -> Optional[str]:
    """
    Normalize dates to ISO YYYY-MM-DD.
    Assumes DD/MM/YYYY for Indian formats unless ambiguous or standard ISO.
    """
    if not text:
        return None
    cleaned = text.strip()

    # Pattern: DD/MM/YYYY or DD-MM-YYYY
    m1 = re.search(r"\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b", cleaned)
    if m1:
        d, m, y = m1.groups()
        return f"{int(y):04d}-{int(m):02d}-{int(d):02d}"

    # Pattern: DD Mon YYYY or DD Month YYYY (e.g. 05 Mar 2026, 05 March 2026, 06Mar2026)
    m2 = re.search(r"\b(\d{1,2})\s*([A-Za-z]{3,9})\s*,?\s*(\d{4})\b", cleaned)
    if m2:
        d, mon, y = m2.groups()
        mon_clean = mon.lower()[:3]
        if mon_clean in MONTH_MAP:
            return f"{int(y):04d}-{MONTH_MAP[mon_clean]}-{int(d):02d}"

    # Pattern: Month DD, YYYY
    m3 = re.search(r"\b([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})\b", cleaned)
    if m3:
        mon, d, y = m3.groups()
        mon_clean = mon.lower()[:3]
        if mon_clean in MONTH_MAP:
            return f"{int(y):04d}-{MONTH_MAP[mon_clean]}-{int(d):02d}"

    # RFC-822 email date: e.g. "Fri, 06 Mar 2026 14:15:00 +0530"
    m4 = re.search(r"(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})", cleaned)
    if m4:
        d, mon, y = m4.groups()
        mon_clean = mon.lower()[:3]
        if mon_clean in MONTH_MAP:
            return f"{int(y):04d}-{MONTH_MAP[mon_clean]}-{int(d):02d}"

    # Standard ISO YYYY-MM-DD
    m5 = re.search(r"\b(\d{4})-(\d{2})-(\d{2})\b", cleaned)
    if m5:
        return f"{m5.group(1)}-{m5.group(2)}-{m5.group(3)}"

    return None


def normalize_amount(text: str) -> Optional[str]:
    """
    Normalize monetary amounts to numeric INR format with 2 decimals (e.g. 50000.00).
    """
    if not text:
        return None
    # Strip currency symbols and letters
    cleaned = re.sub(r"[^\d.,]", "", text).strip()
    if not cleaned:
        return None

    # Remove thousands separators e.g. "50,000.00" -> "50000.00"
    if "," in cleaned and "." in cleaned:
        cleaned = cleaned.replace(",", "")
    elif "," in cleaned and "." not in cleaned:
        cleaned = cleaned.replace(",", "")

    try:
        val = float(cleaned)
        return f"{val:.2f}"
    except ValueError:
        return None


# -------------------------------------------------------------------------
# PDF Claim Extraction (PyMuPDF Text & Structure)
# -------------------------------------------------------------------------

def extract_claims_from_pdf(pdf_bytes: bytes) -> List[ExtractedClaim]:
    claims = []
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")

    for p_no in range(len(doc)):
        page = doc[p_no]
        page_text = page.get_text()
        loc_str = f"page {p_no + 1}"

        # Transaction Ref (e.g. RF-2291, TXN-9948210)
        for m in re.finditer(r"\b(RF-\d+|TXN-\d+)\b", page_text):
            claims.append(ExtractedClaim(
                claim_type="txn_ref",
                value=m.group(1),
                normalized_value=m.group(1),
                location_ref=loc_str,
                quote=page_text[max(0, m.start()-15):min(len(page_text), m.end()+15)].strip(),
                confidence=0.95,
                method="parser"
            ))

        # Dates (e.g. 05/03/2026, 09/03/2026, 10/03/2026)
        for m in re.finditer(r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{4})\b", page_text):
            raw_d = m.group(1)
            norm_d = normalize_date(raw_d)
            if norm_d:
                claims.append(ExtractedClaim(
                    claim_type="date",
                    value=raw_d,
                    normalized_value=norm_d,
                    location_ref=loc_str,
                    quote=page_text[max(0, m.start()-15):min(len(page_text), m.end()+15)].strip(),
                    confidence=0.95,
                    method="parser"
                ))

        # Amounts (e.g. INR 50,000, INR 50,000.00)
        for m in re.finditer(r"(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d{2})?)", page_text, re.IGNORECASE):
            raw_amt = m.group(0).strip()
            norm_amt = normalize_amount(m.group(1))
            if norm_amt:
                claims.append(ExtractedClaim(
                    claim_type="amount",
                    value=raw_amt,
                    normalized_value=norm_amt,
                    location_ref=loc_str,
                    quote=raw_amt,
                    confidence=0.95,
                    method="parser"
                ))

        # Persons & Organizations
        # Customer / Beneficiary patterns
        cust_match = re.search(r"Customer:\s*([A-Za-z\s]+)", page_text)
        if cust_match:
            claims.append(ExtractedClaim(
                claim_type="person",
                value=cust_match.group(1).strip(),
                normalized_value=cust_match.group(1).strip().lower(),
                location_ref=loc_str,
                quote=cust_match.group(0),
                confidence=0.92,
                method="parser"
            ))

        beneficiary_match = re.search(r"Beneficiary(?:\s+Name)?:\s*([A-Za-z\.\s]+)", page_text)
        if beneficiary_match:
            b_name = beneficiary_match.group(1).strip()
            claims.append(ExtractedClaim(
                claim_type="person" if "Enterprises" not in b_name else "org",
                value=b_name,
                normalized_value=b_name.lower(),
                location_ref=loc_str,
                quote=beneficiary_match.group(0),
                confidence=0.92,
                method="parser"
            ))

        issuer_match = re.search(r"Issuer:\s*([A-Za-z\s]+)", page_text)
        if issuer_match:
            claims.append(ExtractedClaim(
                claim_type="org",
                value=issuer_match.group(1).strip(),
                normalized_value=issuer_match.group(1).strip().lower(),
                location_ref=loc_str,
                quote=issuer_match.group(0),
                confidence=0.92,
                method="parser"
            ))

        # Bank Account numbers (e.g. 50100499284417, Ending 4417)
        acc_match = re.search(r"Account\s+(?:Number|Ending)?:\s*(\w+)", page_text, re.IGNORECASE)
        if acc_match:
            raw_acc = acc_match.group(1).strip()
            # Normalize to last 4 digits
            norm_acc = raw_acc[-4:] if len(raw_acc) >= 4 else raw_acc
            claims.append(ExtractedClaim(
                claim_type="account",
                value=raw_acc,
                normalized_value=norm_acc,
                location_ref=loc_str,
                quote=acc_match.group(0),
                confidence=0.95,
                method="parser"
            ))

    doc.close()
    return claims


# -------------------------------------------------------------------------
# EML Claim Extraction (Headers & Body)
# -------------------------------------------------------------------------

def extract_claims_from_eml(eml_bytes: bytes) -> List[ExtractedClaim]:
    claims = []
    import email
    import email.policy

    msg = email.message_from_bytes(eml_bytes, policy=email.policy.default)

    # Date header
    date_hdr = str(msg.get("Date", ""))
    if date_hdr:
        norm_d = normalize_date(date_hdr)
        claims.append(ExtractedClaim(
            claim_type="date",
            value=date_hdr,
            normalized_value=norm_d,
            location_ref="Header: Date",
            quote=f"Date: {date_hdr}",
            confidence=0.95,
            method="parser"
        ))

    # From & To
    from_hdr = str(msg.get("From", ""))
    if from_hdr:
        # Extract display name or email
        name_match = re.match(r"^([^<]+)", from_hdr)
        p_val = name_match.group(1).strip() if name_match else from_hdr
        claims.append(ExtractedClaim(
            claim_type="person",
            value=p_val,
            normalized_value=p_val.lower(),
            location_ref="Header: From",
            quote=f"From: {from_hdr}",
            confidence=0.95,
            method="parser"
        ))

    to_hdr = str(msg.get("To", ""))
    if to_hdr:
        name_match = re.match(r"^([^<]+)", to_hdr)
        p_val = name_match.group(1).strip() if name_match else to_hdr
        claims.append(ExtractedClaim(
            claim_type="person",
            value=p_val,
            normalized_value=p_val.lower(),
            location_ref="Header: To",
            quote=f"To: {to_hdr}",
            confidence=0.95,
            method="parser"
        ))

    # Subject & Body
    body_part = msg.get_body(preferencelist=('plain', 'html'))
    body_text = (body_part.get_content() if body_part else "") + " " + str(msg.get("Subject", ""))

    for m in re.finditer(r"\b(RF-\d+)\b", body_text):
        claims.append(ExtractedClaim(
            claim_type="txn_ref",
            value=m.group(1),
            normalized_value=m.group(1),
            location_ref="Body",
            quote=m.group(0),
            confidence=0.95,
            method="parser"
        ))

    for m in re.finditer(r"(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d{2})?)", body_text, re.IGNORECASE):
        norm_amt = normalize_amount(m.group(1))
        claims.append(ExtractedClaim(
            claim_type="amount",
            value=m.group(0).strip(),
            normalized_value=norm_amt,
            location_ref="Body",
            quote=m.group(0),
            confidence=0.95,
            method="parser"
        ))

    return claims


# -------------------------------------------------------------------------
# Chat Claim Extraction (.txt WhatsApp & .json)
# -------------------------------------------------------------------------

def extract_claims_from_chat(content_bytes: bytes, filename: str) -> List[ExtractedClaim]:
    claims = []
    text = content_bytes.decode("utf-8", errors="replace")
    lines = text.splitlines()

    for idx, line in enumerate(lines, start=1):
        clean = line.strip()
        if not clean:
            continue
        loc_str = f"line {idx}"

        # WhatsApp line: "DD/MM/YYYY, HH:MM - Name: Message"
        chat_match = re.match(r"^(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}),?\s+[\d:]+(?:\s*[AaPp][Mm])?\s*[-:]\s*([^:]+):\s*(.*)$", clean)
        if chat_match:
            raw_d, sender, body = chat_match.groups()
            norm_d = normalize_date(raw_d)
            if norm_d:
                claims.append(ExtractedClaim(
                    claim_type="date",
                    value=raw_d,
                    normalized_value=norm_d,
                    location_ref=loc_str,
                    quote=clean,
                    confidence=0.95,
                    method="parser"
                ))

            clean_sender = sender.strip()
            claims.append(ExtractedClaim(
                claim_type="person",
                value=clean_sender,
                normalized_value=clean_sender.lower(),
                location_ref=loc_str,
                quote=clean_sender,
                confidence=0.95,
                method="parser"
            ))

            target_body = body
        else:
            target_body = clean

        # Extract amounts from message
        for m in re.finditer(r"(?:INR|Rs\.?|₹)?\s*(\b\d{1,3}(?:,\d{3})+(?:\.\d{2})?|\b[1-9]\d{3,6}\b)", target_body):
            raw_val = m.group(1)
            norm_amt = normalize_amount(raw_val)
            if norm_amt and float(norm_amt) >= 1000:
                claims.append(ExtractedClaim(
                    claim_type="amount",
                    value=raw_val,
                    normalized_value=norm_amt,
                    location_ref=loc_str,
                    quote=clean,
                    confidence=0.90,
                    method="parser"
                ))

        # Extract references
        for m in re.finditer(r"\b(RF-\d+)\b", target_body):
            claims.append(ExtractedClaim(
                claim_type="txn_ref",
                value=m.group(1),
                normalized_value=m.group(1),
                location_ref=loc_str,
                quote=clean,
                confidence=0.95,
                method="parser"
            ))

    return claims


# -------------------------------------------------------------------------
# Image & Text Extraction via Gemini LLM
# -------------------------------------------------------------------------

def extract_claims_via_gemini_text(text: str, filename: str) -> Optional[List[ExtractedClaim]]:
    """
    Call Gemini LLM via google-genai SDK to extract structured forensic claims from any document text.
    """
    api_key = os.getenv("GOOGLE_API_KEY", "").strip()
    if not api_key or not text.strip():
        return None

    try:
        from google import genai
        from google.genai import types

        model_name = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite")
        client = genai.Client(api_key=api_key)

        prompt_text = (
            f"You are an expert digital forensics evidence extraction engine analyzing document '{filename}'.\n"
            "Extract all verifiable claims, observations, and entities strictly from the text provided below:\n"
            "- Dates (claim_type='date', normalized_value in YYYY-MM-DD format)\n"
            "- Monetary amounts (claim_type='amount', normalized_value numeric e.g. '50000.00')\n"
            "- Persons (claim_type='person', names of individuals, senders, recipients, signatories, beneficiaries, employees)\n"
            "- Organizations (claim_type='org', company, vendor, or bank names)\n"
            "- Accounts (claim_type='account', bank account numbers or card numbers)\n"
            "- Transaction references (claim_type='txn_ref', invoice, receipt, voucher, or transaction IDs)\n"
            "- Locations (claim_type='location', addresses, cities)\n"
            "- Factual statements (claim_type='statement', key factual assertions or actions)\n\n"
            "Rules:\n"
            "1. Extract ONLY information explicitly present in the text. Do not invent or assume.\n"
            "2. Provide the exact verbatim snippet in 'quote'.\n"
            "3. For 'location_ref', specify where in the document it was found (e.g. Header, Page 1, Section A, Line 2).\n"
            "4. Return clean structured JSON."
        )
        prompt_hash = hashlib.sha256(prompt_text.encode("utf-8")).hexdigest()

        response = client.models.generate_content(
            model=model_name,
            contents=[prompt_text, f"DOCUMENT TEXT:\n{text[:16000]}"],
            config=types.GenerateContentConfig(
                system_instruction=prompt_text,
                response_mime_type="application/json",
                response_schema=ExtractionResult,
                temperature=0.0
            )
        )

        raw_resp = response.text or "{}"
        resp_hash = hashlib.sha256(raw_resp.encode("utf-8")).hexdigest()

        audit.log_audit_entry(
            action="GEMINI_CALL",
            target=f"FILE:{filename}",
            detail={
                "model": model_name,
                "prompt_hash": prompt_hash,
                "response_hash": resp_hash,
                "purpose": "text_claim_extraction"
            },
            actor="system"
        )

        parsed = ExtractionResult.model_validate_json(raw_resp)
        claims = []
        for c in parsed.claims:
            c.method = "gemini"
            c.confidence = 0.92
            if c.claim_type == "date" and not c.normalized_value:
                c.normalized_value = normalize_date(c.value)
            elif c.claim_type == "amount" and not c.normalized_value:
                c.normalized_value = normalize_amount(c.value)
            claims.append(c)
        return claims
    except Exception as e:
        print(f"Gemini text extraction error for {filename}: {e}")
        return None


def extract_claims_via_gemini(image_bytes: bytes, filename: str) -> Optional[List[ExtractedClaim]]:
    """
    Call Gemini Vision via google-genai SDK with response_schema=ExtractionResult.
    Audits the call with model, prompt hash, and response hash.
    """
    api_key = os.getenv("GOOGLE_API_KEY", "").strip()
    if not api_key:
        return None

    try:
        from google import genai
        from google.genai import types

        model_name = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite")
        client = genai.Client(api_key=api_key)

        prompt_text = "You are an evidence extraction assistant. Extract all entities (person, org), dates, amounts, bank accounts, invoice or transaction references, and statements visibly written on this image. Extract only what is visibly written. Do not interpret or guess. If unsure, omit."
        prompt_hash = hashlib.sha256(prompt_text.encode("utf-8")).hexdigest()

        # Send image as bytes part
        image_part = types.Part.from_bytes(
            data=image_bytes,
            mime_type="image/png" if filename.lower().endswith(".png") else "image/jpeg"
        )

        response = client.models.generate_content(
            model=model_name,
            contents=[image_part, prompt_text],
            config=types.GenerateContentConfig(
                system_instruction=prompt_text,
                response_mime_type="application/json",
                response_schema=ExtractionResult,
                temperature=0.0
            )
        )

        raw_resp = response.text or "{}"
        resp_hash = hashlib.sha256(raw_resp.encode("utf-8")).hexdigest()

        # Write to audit chain
        audit.log_audit_entry(
            action="GEMINI_CALL",
            target=f"FILE:{filename}",
            detail={
                "model": model_name,
                "prompt_hash": prompt_hash,
                "response_hash": resp_hash,
                "purpose": "image_claim_extraction"
            },
            actor="system"
        )

        parsed = ExtractionResult.model_validate_json(raw_resp)
        claims = []
        for c in parsed.claims:
            c.method = "gemini"
            c.confidence = 0.88
            if c.claim_type == "date" and not c.normalized_value:
                c.normalized_value = normalize_date(c.value)
            elif c.claim_type == "amount" and not c.normalized_value:
                c.normalized_value = normalize_amount(c.value)
            claims.append(c)
        return claims

    except Exception as e:
        return None


def extract_claims_via_rapidocr(image_bytes: bytes) -> List[ExtractedClaim]:
    """Offline RapidOCR fallback."""
    claims = []
    try:
        import rapidocr_onnxruntime
        engine = rapidocr_onnxruntime.RapidOCR()
        ocr_res, _ = engine(image_bytes)
        if not ocr_res:
            return claims

        for item in ocr_res:
            poly, text, ocr_conf = item
            xs = [p[0] for p in poly]
            ys = [p[1] for p in poly]
            min_x, max_x = int(min(xs)), int(max(xs))
            min_y, max_y = int(min(ys)), int(max(ys))
            bbox_str = f"[{min_x},{min_y},{max_x - min_x},{max_y - min_y}]"

            # Check for Transaction Ref
            for m in re.finditer(r"\b([A-Z0-9]{2,10}[-_][A-Z0-9]{3,12}|RF-\d+|INV-\d+|TXN-\d+)\b", text):
                claims.append(ExtractedClaim(
                    claim_type="txn_ref",
                    value=m.group(1),
                    normalized_value=m.group(1),
                    location_ref=bbox_str,
                    quote=text,
                    confidence=0.65,
                    method="rapidocr"
                ))

            date_match = re.search(r"(\d{1,2}\s*[A-Za-z]{3}\s*\d{4}|\d{1,2}[/-]\d{1,2}[/-]\d{4})", text)
            if date_match:
                raw_d = date_match.group(1)
                norm_d = normalize_date(raw_d)
                if norm_d:
                    claims.append(ExtractedClaim(
                        claim_type="date",
                        value=raw_d,
                        normalized_value=norm_d,
                        location_ref=bbox_str,
                        quote=text,
                        confidence=0.65,
                        method="rapidocr"
                    ))

            amt_match = re.search(r"(?:INR|Rs\.?|₹)?\s*([\d,]+(?:\.\d{2})?)", text)
            if amt_match:
                norm_amt = normalize_amount(amt_match.group(1))
                if norm_amt and float(norm_amt) >= 100:
                    claims.append(ExtractedClaim(
                        claim_type="amount",
                        value=amt_match.group(0).strip(),
                        normalized_value=norm_amt,
                        location_ref=bbox_str,
                        quote=text,
                        confidence=0.65,
                        method="rapidocr"
                    ))

            p_match = re.search(r"(?:From|To):\s*([A-Za-z\s]+?)(?:<|$)", text)
            if p_match:
                p_name = p_match.group(1).strip()
                if len(p_name) > 3:
                    claims.append(ExtractedClaim(
                        claim_type="person",
                        value=p_name,
                        normalized_value=p_name.lower(),
                        location_ref=bbox_str,
                        quote=text,
                        confidence=0.65,
                        method="rapidocr"
                    ))

    except Exception:
        pass

    return claims


def extract_claims_from_image(image_bytes: bytes, filename: str) -> List[ExtractedClaim]:
    """Source order: Gemini Vision -> RapidOCR fallback -> Regex fallback."""
    gemini_claims = extract_claims_via_gemini(image_bytes, filename)
    if gemini_claims is not None and len(gemini_claims) > 0:
        return gemini_claims

    ocr_claims = extract_claims_via_rapidocr(image_bytes)
    if ocr_claims:
        return ocr_claims

    return []


# -------------------------------------------------------------------------
# Master Extraction Dispatcher (100% Dynamic LLM for Any File)
# -------------------------------------------------------------------------

def extract_all_claims_for_evidence(
    filename: str,
    file_type: str,
    file_bytes: bytes
) -> List[ExtractedClaim]:
    """
    Universal extraction pipeline:
    1. Images: Gemini Vision
    2. Text/PDF/DOCX/EML/CSV/JSON: Extracts text and passes to Gemini LLM
    3. Graceful offline fallback to specialized parsers
    """
    ext = file_type.lower().lstrip(".")

    # 1. Images
    if ext in ["png", "jpg", "jpeg", "webp", "bmp", "tiff", "gif"]:
        return extract_claims_from_image(file_bytes, filename)

    # 2. Extract full text from document
    text_content = ""
    if ext == "pdf":
        try:
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            pages_text = [page.get_text() for page in doc]
            text_content = "\n".join(pages_text)
            doc.close()
        except Exception:
            text_content = ""

    elif ext in ["eml", "msg"]:
        try:
            import email
            import email.policy
            msg = email.message_from_bytes(file_bytes, policy=email.policy.default)
            body_part = msg.get_body(preferencelist=('plain', 'html'))
            body_text = body_part.get_content() if body_part else ""
            headers_text = f"From: {msg.get('From', '')}\nTo: {msg.get('To', '')}\nDate: {msg.get('Date', '')}\nSubject: {msg.get('Subject', '')}\n"
            text_content = headers_text + "\n" + body_text
        except Exception:
            text_content = file_bytes.decode("utf-8", errors="replace")

    elif ext in ["docx"]:
        try:
            import forensics
            text_content = forensics.extract_docx_text(file_bytes)
        except Exception:
            text_content = file_bytes.decode("utf-8", errors="replace")

    elif ext in ["txt", "json", "csv", "tsv", "log", "md", "xml", "html"]:
        text_content = file_bytes.decode("utf-8", errors="replace")

    else:
        try:
            import forensics
            text_content = forensics.extract_generic_text(file_bytes)
        except Exception:
            text_content = file_bytes.decode("utf-8", errors="replace")

    # 3. Process with Gemini LLM
    if text_content.strip():
        gemini_claims = extract_claims_via_gemini_text(text_content, filename)
        if gemini_claims and len(gemini_claims) > 0:
            return gemini_claims

    # 4. Offline parser fallbacks if Gemini is not responding
    if ext == "pdf":
        return extract_claims_from_pdf(file_bytes)
    elif ext in ["eml", "msg"]:
        return extract_claims_from_eml(file_bytes)
    elif ext in ["txt", "json", "csv", "tsv", "log", "md"]:
        return extract_claims_from_chat(file_bytes, filename)

    return []



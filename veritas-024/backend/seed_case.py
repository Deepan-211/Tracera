"""
Seed case generator for VERITAS-024.
Scenario: Suspected fake refund RF-2291.
Generates the 6 synthetic test artifacts in memory / disk:
1. receipt_refund.pdf: Refund RF-2291, INR 50,000, 05 Mar 2026, CineWave Retail. Incremental save with later mod date.
2. receipt_refund_copy.pdf: Byte-identical copy of file 1 (exact duplicate).
3. approval_email.eml: Anita Rao, Date 06 Mar 2026, approves RF-2291 for INR 50,000 (unsigned, DKIM unverifiable).
4. chat_export.txt: WhatsApp style. Ravi Kumar on 08 Mar 2026: "I'll process RF-2291 tomorrow." Mentions "45,000" for RF-2291.
5. bank_statement.pdf: Debit 09 Mar 2026, INR 50,000, account ending 4417, beneficiary "R. Kumar Enterprises".
6. approval_screenshot.png: Approval email rendered with Pillow, with date region spliced with distinct compression (ELA hotspot).
"""

import io
from pathlib import Path
from typing import Dict, List, Tuple
from PIL import Image, ImageDraw, ImageFont
import fitz  # PyMuPDF


def create_receipt_refund_pdf() -> bytes:
    """Generate receipt_refund.pdf with incremental revision anomaly."""
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)  # A4

    content = """CINEWAVE RETAIL PRIVATE LIMITED
TAX INVOICE & REFUND CREDIT NOTE

Refund Reference: RF-2291
Date: 05/03/2026
Issuer: CineWave Retail
Beneficiary Customer: Ravi Kumar
Claim Reason: Defective Electronics Return

Line Items:
------------------------------------------------------------
1. Home Audio Amplifier System (Serial #CW-9921)
   Amount: INR 50,000
------------------------------------------------------------
TOTAL REFUND DISBURSAL: INR 50,000
Payment Method: Scheduled NEFT Disbursal
Authorized by: CineWave Returns Desk
"""
    rect = fitz.Rect(50, 60, 545, 780)
    page.insert_textbox(rect, content, fontsize=12, fontname="helv")

    doc.set_metadata({
        "title": "Refund Receipt RF-2291",
        "author": "CineWave Retail Billing",
        "creationDate": "D:20260305100000Z",
        "modDate": "D:20260305100000Z",
        "producer": "PyMuPDF PDF Generator 1.0"
    })

    initial_pdf_bytes = doc.tobytes()
    doc.close()

    # Re-open and apply an incremental update with a later modification date
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tf:
        tf.write(initial_pdf_bytes)
        tf_path = tf.name

    doc2 = fitz.open(tf_path)
    page2 = doc2[0]
    # Add an incremental audit mark
    page2.insert_text((50, 750), "Audit Check: Verified by Local Store Clerk 07/03/2026", fontsize=9, fontname="helv")
    doc2.set_metadata({
        "title": "Refund Receipt RF-2291",
        "author": "CineWave Retail Billing",
        "creationDate": "D:20260305100000Z",
        "modDate": "D:20260307183000Z",
        "producer": "PyMuPDF PDF Generator 1.0 - Re-saved"
    })

    # Saving incrementally to disk appends an incremental update and a second %%EOF marker
    doc2.save(doc2.name, incremental=True, encryption=fitz.PDF_ENCRYPT_KEEP)
    doc2.close()

    with open(tf_path, "rb") as f:
        incremental_bytes = f.read()

    try:
        os.unlink(tf_path)
    except Exception:
        pass

    return incremental_bytes


def create_approval_email_eml() -> bytes:
    """Generate approval_email.eml (unsigned RFC-822 email)."""
    eml_text = """From: Anita Rao <anita.rao@cinewave.internal>
To: Ravi Kumar <ravi.kumar@cinewave.internal>
Date: Fri, 06 Mar 2026 14:15:00 +0530
Subject: Internal Approval: Refund Claim RF-2291
Message-ID: <approval-rf2291-20260306@cinewave.internal>
Received: from mail.cinewave.internal (10.0.1.25) by gateway.cinewave.internal with SMTP; Fri, 06 Mar 2026 14:15:02 +0530
MIME-Version: 1.0
Content-Type: text/plain; charset="utf-8"

Ravi,

I have reviewed the refund request RF-2291 submitted for customer claim on 05 March 2026.
The amount of INR 50,000 is hereby approved for disbursal from the corporate account.

Please proceed with the payment processing.

Regards,
Anita Rao
Senior Operations Manager
CineWave Retail
"""
    return eml_text.encode("utf-8")


def create_chat_export_txt() -> bytes:
    """Generate WhatsApp-style chat_export.txt with amount contradiction."""
    chat_text = """08/03/2026, 11:20 - Ravi Kumar: Hi Anita, received approval for refund RF-2291. I'll process RF-2291 tomorrow.
08/03/2026, 11:22 - Anita Rao: Please verify the internal settlement balance before executing.
08/03/2026, 11:25 - Ravi Kumar: Checked ledger. Adjusted voucher to 45,000 for RF-2291 after standard restocking deduction.
08/03/2026, 11:27 - Anita Rao: Noted. Ensure disbursal voucher matches bank reference.
"""
    return chat_text.encode("utf-8")


def create_bank_statement_pdf() -> bytes:
    """Generate bank_statement.pdf with debit and beneficiary entity."""
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)

    content = """APEX COMMERCE BANK - OFFICIAL STATEMENT OF ACCOUNT
Account Number: 50100499284417
Account Ending: 4417
Account Title: CineWave Retail Disbursal Escrow

TRANSACTION DETAILS:
------------------------------------------------------------
Posting Date: 09/03/2026
Value Date: 09/03/2026
Transaction Type: NEFT DEBIT
Transaction Reference: RF-2291 / TXN-9948210
Beneficiary Name: R. Kumar Enterprises
Beneficiary Account: 9102837464417
Amount Debited: INR 50,000.00
Status: COMPLETED / SETTLED
------------------------------------------------------------
Balance After Transaction: INR 4,21,500.00
Statement Generated: 10/03/2026 09:00:00 UTC
"""
    rect = fitz.Rect(50, 60, 545, 780)
    page.insert_textbox(rect, content, fontsize=12, fontname="helv")
    doc.set_metadata({
        "title": "Account Statement - March 2026",
        "author": "Apex Commerce Bank",
        "creationDate": "D:20260310090000Z",
        "modDate": "D:20260310090000Z",
        "producer": "CoreBanking Statement Engine v4"
    })
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def create_approval_screenshot_png() -> bytes:
    """
    Generate approval_screenshot.png with Pillow.
    Splices a differently compressed/rendered patch at the Date region
    to produce a clear, detectable ELA hotspot.
    """
    import numpy as np
    width, height = 750, 420
    # Clean email client screenshot canvas
    img = Image.new("RGB", (width, height), color=(250, 250, 250))
    draw = ImageDraw.Draw(img)

    # Top app header bar
    draw.rectangle([0, 0, width, 40], fill=(235, 235, 235))
    draw.text((20, 12), "CineWave Internal Mail Client - Inbox", fill=(40, 40, 40))

    # Email details
    draw.text((30, 65), "From: Anita Rao <anita.rao@cinewave.internal>", fill=(20, 20, 20))
    draw.text((30, 95), "To: Ravi Kumar <ravi.kumar@cinewave.internal>", fill=(20, 20, 20))
    draw.text((30, 125), "Subject: Internal Approval: Refund Claim RF-2291", fill=(20, 20, 20))

    # Base email body
    body_text = (
        "Ravi,\n\n"
        "I have reviewed the refund request RF-2291 submitted for customer claim.\n"
        "The amount of INR 50,000 is approved for immediate bank transfer.\n\n"
        "Regards,\nAnita Rao\nSenior Operations Manager"
    )
    draw.text((30, 200), body_text, fill=(30, 30, 30))

    # Create a spliced patch for the Date field with distinct high-frequency compression matrix
    patch_w, patch_h = 240, 34
    noise = np.random.RandomState(42).randint(236, 248, (patch_h, patch_w, 3), dtype=np.uint8)
    patch = Image.fromarray(noise)
    patch_draw = ImageDraw.Draw(patch)
    patch_draw.text((8, 8), "Date: 06 Mar 2026, 14:15", fill=(10, 10, 10))

    # Heavily compress the patch at JPEG quality 25
    patch_buf = io.BytesIO()
    patch.save(patch_buf, format="JPEG", quality=25)
    patch_buf.seek(0)
    compressed_patch = Image.open(patch_buf)

    # Paste the differently compressed patch at (30, 155)
    img.paste(compressed_patch, (30, 155))

    out_buf = io.BytesIO()
    img.save(out_buf, format="PNG")
    return out_buf.getvalue()


def get_seed_files() -> List[Tuple[str, str, bytes, str]]:
    """
    Returns list of (filename, file_type, raw_bytes, source_note)
    """
    receipt_bytes = create_receipt_refund_pdf()
    copy_bytes = bytes(receipt_bytes)  # Byte-identical copy
    email_bytes = create_approval_email_eml()
    chat_bytes = create_chat_export_txt()
    bank_bytes = create_bank_statement_pdf()
    screenshot_bytes = create_approval_screenshot_png()

    return [
        ("receipt_refund.pdf", "pdf", receipt_bytes, "Original customer refund receipt provided by CineWave store"),
        ("receipt_refund_copy.pdf", "pdf", copy_bytes, "Duplicate receipt copy submitted to accounting ledger"),
        ("approval_email.eml", "eml", email_bytes, "Manager authorization email export from internal inbox"),
        ("chat_export.txt", "txt", chat_bytes, "Exported WhatsApp team conversation between manager and agent"),
        ("bank_statement.pdf", "pdf", bank_bytes, "Official bank statement showing debit payment to beneficiary"),
        ("approval_screenshot.png", "png", screenshot_bytes, "Screenshot of manager approval email claimed by agent"),
    ]

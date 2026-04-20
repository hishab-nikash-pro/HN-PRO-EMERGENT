"""E2E tests for AI Import Center (P0) — upload, process, get, confirm, delete, workflow-alerts."""
import os
import base64
import io
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://business-ledger-113.preview.emergentagent.com").rstrip("/")
TOKEN = "test_session_ukrrqssgkvg"
COMPANY_ID = "ckfrozen"
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}


def _tiny_png_b64():
    # 100x100 white PNG with dark text-ish pattern using PIL if available, else pure PNG header.
    try:
        from PIL import Image, ImageDraw
        img = Image.new("RGB", (240, 140), "white")
        d = ImageDraw.Draw(img)
        d.rectangle([0, 0, 239, 139], outline="black", width=2)
        d.text((10, 10), "EXPENSE RECEIPT", fill="black")
        d.text((10, 35), "Vendor: Acme Cafe", fill="black")
        d.text((10, 55), "Date: 2025-12-10", fill="black")
        d.text((10, 75), "Amount: $42.50", fill="black")
        d.text((10, 95), "Category: Meals", fill="black")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return base64.b64encode(buf.getvalue()).decode()
    except Exception:
        # smallest transparent 1x1 png
        one_px = bytes.fromhex(
            "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C489"
            "0000000D49444154785E63FCCF00000003010100F6A8F81D0000000049454E44AE426082"
        )
        return base64.b64encode(one_px).decode()


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update(HEADERS)
    return s


@pytest.fixture(scope="module")
def png_b64():
    return _tiny_png_b64()


@pytest.fixture
def created_upload(session, png_b64):
    payload = {
        "file_name": "TEST_ai_receipt.png",
        "file_type": "image/png",
        "file_size": 1000,
        "file_base64": png_b64,
    }
    r = session.post(f"{BASE_URL}/api/companies/{COMPANY_ID}/ai-uploads", json=payload)
    assert r.status_code == 201, r.text
    data = r.json()
    upload_id = data["upload_id"]
    yield upload_id
    # cleanup
    try:
        session.delete(f"{BASE_URL}/api/companies/{COMPANY_ID}/ai-uploads/{upload_id}")
    except Exception:
        pass


class TestAIUploadCreate:
    def test_create_upload_returns_pending(self, session, png_b64):
        r = session.post(
            f"{BASE_URL}/api/companies/{COMPANY_ID}/ai-uploads",
            json={
                "file_name": "TEST_create.png",
                "file_type": "image/png",
                "file_size": 500,
                "file_base64": png_b64,
            },
        )
        assert r.status_code == 201, r.text
        d = r.json()
        assert "upload_id" in d
        assert d.get("status") in ("pending", "processing", "ready")
        # cleanup
        session.delete(f"{BASE_URL}/api/companies/{COMPANY_ID}/ai-uploads/{d['upload_id']}")


class TestAIUploadList:
    def test_list_uploads(self, session, created_upload):
        r = session.get(f"{BASE_URL}/api/companies/{COMPANY_ID}/ai-uploads")
        assert r.status_code == 200
        d = r.json()
        assert "data" in d
        assert isinstance(d["data"], list)
        ids = [u["upload_id"] for u in d["data"]]
        assert created_upload in ids


class TestAIUploadGet:
    def test_get_single_upload(self, session, created_upload):
        r = session.get(f"{BASE_URL}/api/companies/{COMPANY_ID}/ai-uploads/{created_upload}")
        assert r.status_code == 200
        d = r.json().get("data") or r.json()
        assert d["upload_id"] == created_upload
        assert "status" in d


class TestAIUploadProcessAndConfirm:
    def _process(self, session, upload_id):
        r = session.post(f"{BASE_URL}/api/companies/{COMPANY_ID}/ai-uploads/{upload_id}/process")
        assert r.status_code == 200, r.text
        return r.json()

    def test_process_returns_extracted(self, session, created_upload):
        d = self._process(session, created_upload)
        # May be nested under data
        payload = d.get("data") or d
        assert "detected_type" in payload or "extracted_fields" in payload or "extracted_data" in payload
        # Verify status via GET
        r = session.get(f"{BASE_URL}/api/companies/{COMPANY_ID}/ai-uploads/{created_upload}")
        doc = r.json().get("data") or r.json()
        assert doc["status"] in ("ready", "error")

    def test_confirm_expense(self, session, png_b64):
        # Create + process a fresh upload, then confirm as expense
        r = session.post(
            f"{BASE_URL}/api/companies/{COMPANY_ID}/ai-uploads",
            json={"file_name": "TEST_exp.png", "file_type": "image/png", "file_size": 500, "file_base64": png_b64},
        )
        uid = r.json()["upload_id"]
        self._process(session, uid)
        time.sleep(1)
        body = {
            "destination": "expense",
            "data": {
                "vendor_name": "TEST Vendor",
                "date": "2025-12-10",
                "amount": 25.50,
                "category": "Meals",
                "payment_method": "Cash",
                "reference": "TEST-REF",
                "memo": "ai import test",
            },
        }
        rc = session.post(
            f"{BASE_URL}/api/companies/{COMPANY_ID}/ai-uploads/{uid}/confirm", json=body
        )
        assert rc.status_code in (200, 201), rc.text
        out = rc.json().get("data") or rc.json()
        assert out.get("expense_id") or out.get("id") or out.get("destination_id")
        # status becomes confirmed
        r2 = session.get(f"{BASE_URL}/api/companies/{COMPANY_ID}/ai-uploads/{uid}")
        doc = r2.json().get("data") or r2.json()
        assert doc["status"] == "confirmed"
        session.delete(f"{BASE_URL}/api/companies/{COMPANY_ID}/ai-uploads/{uid}")

    def test_confirm_invoice(self, session, png_b64):
        r = session.post(
            f"{BASE_URL}/api/companies/{COMPANY_ID}/ai-uploads",
            json={"file_name": "TEST_inv.png", "file_type": "image/png", "file_size": 500, "file_base64": png_b64},
        )
        uid = r.json()["upload_id"]
        self._process(session, uid)
        body = {
            "destination": "invoice",
            "data": {
                "customer_name": "TEST Customer",
                "invoice_number": "TEST-INV-001",
                "invoice_date": "2025-12-10",
                "due_date": "2025-12-20",
                "items": [{"description": "Service", "quantity": 1, "price": 100}],
                "subtotal": 100, "tax": 0, "total": 100, "status": "Draft",
            },
        }
        rc = session.post(
            f"{BASE_URL}/api/companies/{COMPANY_ID}/ai-uploads/{uid}/confirm", json=body
        )
        assert rc.status_code in (200, 201), rc.text
        out = rc.json().get("data") or rc.json()
        assert out.get("invoice_id") or out.get("id")
        session.delete(f"{BASE_URL}/api/companies/{COMPANY_ID}/ai-uploads/{uid}")

    def test_confirm_bill(self, session, png_b64):
        r = session.post(
            f"{BASE_URL}/api/companies/{COMPANY_ID}/ai-uploads",
            json={"file_name": "TEST_bill.png", "file_type": "image/png", "file_size": 500, "file_base64": png_b64},
        )
        uid = r.json()["upload_id"]
        self._process(session, uid)
        body = {
            "destination": "bill",
            "data": {
                "vendor_name": "TEST Vendor",
                "bill_number": "TEST-BILL-001",
                "bill_date": "2025-12-10",
                "due_date": "2025-12-30",
                "items": [{"description": "Supplies", "quantity": 2, "cost": 50}],
                "total": 100,
            },
        }
        rc = session.post(
            f"{BASE_URL}/api/companies/{COMPANY_ID}/ai-uploads/{uid}/confirm", json=body
        )
        assert rc.status_code in (200, 201), rc.text
        out = rc.json().get("data") or rc.json()
        assert out.get("bill_id") or out.get("id")
        session.delete(f"{BASE_URL}/api/companies/{COMPANY_ID}/ai-uploads/{uid}")

    def test_confirm_stock_receipt(self, session, png_b64):
        r = session.post(
            f"{BASE_URL}/api/companies/{COMPANY_ID}/ai-uploads",
            json={"file_name": "TEST_sr.png", "file_type": "image/png", "file_size": 500, "file_base64": png_b64},
        )
        uid = r.json()["upload_id"]
        self._process(session, uid)
        body = {
            "destination": "stock_receipt",
            "data": {
                "vendor_name": "TEST Vendor",
                "date": "2025-12-10",
                "reference": "TEST-SR-001",
                "items": [{"description": "Frozen Fish 1kg", "quantity": 3, "unit_cost": 15}],
            },
        }
        rc = session.post(
            f"{BASE_URL}/api/companies/{COMPANY_ID}/ai-uploads/{uid}/confirm", json=body
        )
        assert rc.status_code in (200, 201), rc.text
        out = rc.json().get("data") or rc.json()
        assert out.get("receipt_id") or out.get("stock_receipt_id") or out.get("id")
        session.delete(f"{BASE_URL}/api/companies/{COMPANY_ID}/ai-uploads/{uid}")


class TestAIUploadDelete:
    def test_delete_upload(self, session, png_b64):
        r = session.post(
            f"{BASE_URL}/api/companies/{COMPANY_ID}/ai-uploads",
            json={"file_name": "TEST_del.png", "file_type": "image/png", "file_size": 500, "file_base64": png_b64},
        )
        uid = r.json()["upload_id"]
        d = session.delete(f"{BASE_URL}/api/companies/{COMPANY_ID}/ai-uploads/{uid}")
        assert d.status_code in (200, 204)
        g = session.get(f"{BASE_URL}/api/companies/{COMPANY_ID}/ai-uploads/{uid}")
        assert g.status_code == 404


class TestWorkflowAlerts:
    def test_workflow_alerts(self, session):
        r = session.get(f"{BASE_URL}/api/companies/{COMPANY_ID}/workflow-alerts")
        assert r.status_code == 200
        d = r.json()
        # Expected either {data: [...]} or list
        assert "data" in d or isinstance(d, list)

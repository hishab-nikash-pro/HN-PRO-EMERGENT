"""
E2E Workflow tests for Hishab Nikash Pro - iteration 10.
Covers 11 user-requested end-to-end flows (customer payments, vendor payments,
stock receiving, reports, AI chat, company switching).
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://business-ledger-113.preview.emergentagent.com").rstrip("/")
TOKEN = "test_session_ukrrqssgkvg"
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
CO = "ckfrozen"
CO2 = "haor"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update(HEADERS)
    return sess


# ---------- Flow 1: Invoice -> Customer Payment -> AR drops ----------
class TestFlow1CustomerPayment:
    def test_create_invoice_and_receive_payment(self, s):
        # get customer
        customers = s.get(f"{BASE_URL}/api/companies/{CO}/customers").json()
        cust = customers[0]
        cid = cust["customer_id"]
        bal_before = cust.get("open_balance", 0)

        # get a product
        products = s.get(f"{BASE_URL}/api/companies/{CO}/products").json()
        p = products[0]

        # create invoice
        payload = {
            "customer_id": cid,
            "customer_name": cust["name"],
            "invoice_date": "2026-01-15",
            "due_date": "2026-02-15",
            "items": [{"product_id": p["product_id"], "name": p["name"], "quantity": 1,
                       "unit_price": 100.0, "total": 100.0}],
            "subtotal": 100.0, "tax_total": 0, "discount_total": 0, "total": 100.0,
            "notes": "E2E TEST_invoice", "terms": "Net 30",
        }
        r = s.post(f"{BASE_URL}/api/companies/{CO}/invoices", json=payload)
        assert r.status_code in (200, 201), r.text
        inv = r.json()
        inv_id = inv["invoice_id"]
        assert inv["total"] == 100.0
        assert inv["balance_due"] == 100.0

        # verify AR increased
        cust_after = next(c for c in s.get(f"{BASE_URL}/api/companies/{CO}/customers").json() if c["customer_id"] == cid)
        assert cust_after["open_balance"] >= bal_before + 99.99

        # record payment of 60
        pay = {
            "customer_id": cid,
            "payment_date": "2026-01-16",
            "payment_method": "Bank Transfer",
            "reference": "TEST_ref_001",
            "applications": [{"invoice_id": inv_id, "amount": 60.0}],
        }
        rp = s.post(f"{BASE_URL}/api/companies/{CO}/receive-payment", json=pay)
        assert rp.status_code == 200, rp.text
        assert rp.json()["total_applied"] == 60.0

        # verify invoice balance drops
        inv2 = s.get(f"{BASE_URL}/api/companies/{CO}/invoices/{inv_id}").json()
        assert abs(inv2["balance_due"] - 40.0) < 0.01
        assert inv2["payment_status"] == "Partial"
        assert len(inv2["payments"]) >= 1

        # verify AR dropped
        cust_after2 = next(c for c in s.get(f"{BASE_URL}/api/companies/{CO}/customers").json() if c["customer_id"] == cid)
        assert cust_after2["open_balance"] < cust_after["open_balance"]

        # verify payment in customer-payments list
        pays = s.get(f"{BASE_URL}/api/companies/{CO}/customer-payments").json()
        assert any(p2.get("invoice_id") == inv_id for p2 in pays["payments"])


# ---------- Flow 2: Bill -> Vendor Payment -> AP drops ----------
class TestFlow2VendorPayment:
    def test_create_bill_and_pay_vendor(self, s):
        vendors = s.get(f"{BASE_URL}/api/companies/{CO}/vendors").json()
        v = vendors[0]
        vid = v["vendor_id"]
        bal_before = v.get("payable_balance", 0)

        bill_payload = {
            "vendor_id": vid,
            "vendor_name": v["name"],
            "bill_number": f"TEST-BILL-{int(time.time())}",
            "bill_date": "2026-01-15",
            "due_date": "2026-02-15",
            "items": [{"description": "Test item", "quantity": 1, "unit_price": 200.0, "total": 200.0, "account_code": "5000"}],
            "total": 200.0, "notes": "E2E TEST_bill",
        }
        r = s.post(f"{BASE_URL}/api/companies/{CO}/bills", json=bill_payload)
        assert r.status_code in (200, 201), r.text
        bill = r.json()
        bill_id = bill["bill_id"]
        assert bill["total"] == 200.0

        # verify vendor AP increased
        v_after = next(x for x in s.get(f"{BASE_URL}/api/companies/{CO}/vendors").json() if x["vendor_id"] == vid)
        assert v_after.get("payable_balance", 0) >= bal_before + 199.99

        # pay 150
        pay = {
            "vendor_id": vid,
            "payment_date": "2026-01-17",
            "payment_method": "Bank Transfer",
            "reference": "TEST_vref_001",
            "applications": [{"bill_id": bill_id, "amount": 150.0}],
        }
        rp = s.post(f"{BASE_URL}/api/companies/{CO}/pay-vendor", json=pay)
        assert rp.status_code == 200, rp.text

        # verify vendor payments list
        vps = s.get(f"{BASE_URL}/api/companies/{CO}/vendor-payments").json()
        assert any(p.get("bill_id") == bill_id for p in vps["payments"])

        # verify vendor AP dropped
        v_after2 = next(x for x in s.get(f"{BASE_URL}/api/companies/{CO}/vendors").json() if x["vendor_id"] == vid)
        assert v_after2.get("payable_balance", 0) < v_after.get("payable_balance", 0)


# ---------- Flow 3: Receive stock -> inventory increases ----------
class TestFlow3ReceiveStock:
    def test_receive_stock_increases_qty(self, s):
        inv_list = s.get(f"{BASE_URL}/api/companies/{CO}/inventory").json()
        if not inv_list:
            pytest.skip("no inventory seeded")
        item = inv_list[0]
        item_id = item["item_id"]
        qty_before = item.get("stock_on_hand", 0)

        vendors = s.get(f"{BASE_URL}/api/companies/{CO}/vendors").json()
        vid = vendors[0]["vendor_id"] if vendors else ""

        payload = {
            "vendor_id": vid,
            "vendor_name": vendors[0]["name"] if vendors else "TEST Vendor",
            "receive_date": "2026-01-15",
            "reference": "TEST_RCPT_001",
            "items": [{"item_id": item_id, "name": item.get("name", "x"), "quantity": 10, "unit_cost": 5.0}],
            "notes": "E2E TEST_stock",
        }
        r = s.post(f"{BASE_URL}/api/companies/{CO}/stock-receipts", json=payload)
        assert r.status_code in (200, 201), r.text

        item_after = s.get(f"{BASE_URL}/api/companies/{CO}/inventory/{item_id}").json()
        assert item_after["stock_on_hand"] == qty_before + 10


# ---------- Flow 4 & 5: P&L and Balance Sheet reports ----------
class TestFlow45Reports:
    def test_profit_loss(self, s):
        r = s.get(f"{BASE_URL}/api/companies/{CO}/reports/profit-loss",
                  params={"start_date": "2026-01-01", "end_date": "2026-12-31"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert any(k in d for k in ("revenue", "income", "total_revenue", "net_income",
                                     "gross_profit", "cogs", "expense_categories"))

    def test_balance_sheet(self, s):
        r = s.get(f"{BASE_URL}/api/companies/{CO}/reports/balance-sheet",
                  params={"as_of_date": "2026-12-31"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert "assets" in d or "total_assets" in d


# ---------- Flow 6 & 7: Receivables / Payables ----------
class TestFlow67ARAP:
    def test_receivables(self, s):
        r = s.get(f"{BASE_URL}/api/companies/{CO}/receivables")
        assert r.status_code == 200, r.text
        d = r.json()
        # should have customer list and/or aging
        assert isinstance(d, (list, dict))

    def test_payables(self, s):
        r = s.get(f"{BASE_URL}/api/companies/{CO}/payables")
        assert r.status_code == 200, r.text


# ---------- Flow 8 & 9: AI Assistant ----------
class TestFlow89AIAssistant:
    def test_ai_overdue_query(self, s):
        r = s.post(f"{BASE_URL}/api/ai/chat",
                   json={"company_id": CO, "message": "Which customers have overdue invoices?"},
                   timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        resp = (d.get("response") or d.get("message") or d.get("reply") or "")
        assert len(resp) > 20, f"empty AI response: {d}"

    def test_ai_inventory_query(self, s):
        r = s.post(f"{BASE_URL}/api/ai/chat",
                   json={"company_id": CO, "message": "What is my current inventory status?"},
                   timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        resp = (d.get("response") or d.get("message") or d.get("reply") or "")
        assert len(resp) > 20


# ---------- Flow 10: Multi-company isolation ----------
class TestFlow10CompanySwitch:
    def test_data_isolated(self, s):
        inv1 = s.get(f"{BASE_URL}/api/companies/{CO}/invoices").json()
        inv2 = s.get(f"{BASE_URL}/api/companies/{CO2}/invoices").json()
        # all invoices from CO have company_id=CO
        assert all(i["company_id"] == CO for i in inv1)
        assert all(i["company_id"] == CO2 for i in inv2)
        # customer lists should differ
        c1 = {c["customer_id"] for c in s.get(f"{BASE_URL}/api/companies/{CO}/customers").json()}
        c2 = {c["customer_id"] for c in s.get(f"{BASE_URL}/api/companies/{CO2}/customers").json()}
        assert c1.isdisjoint(c2) or c1 != c2

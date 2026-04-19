"""Priority 1 Edit Workflow tests - PUT endpoints for expenses, customers, vendors, products."""
import os, pytest, requests
from datetime import datetime

with open('/app/frontend/.env') as f:
    for line in f:
        if line.startswith('REACT_APP_BACKEND_URL'):
            BASE_URL = line.split('=', 1)[1].strip().rstrip('/')

TOKEN = "test_session_ukrrqssgkvg"
COMPANY = "ckfrozen"
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def client():
    s = requests.Session(); s.headers.update(HEADERS); return s


def _get_id(obj, *keys):
    for k in keys:
        if k in obj and obj[k]: return obj[k]
    return None


def test_expense_create_edit_persist(client):
    payload = {"expense_date": "2026-01-15", "category": "Utilities", "amount": 100.5,
               "memo": "TEST_edit_expense", "payment_method": "Cash"}
    r = client.post(f"{BASE_URL}/api/companies/{COMPANY}/expenses", json=payload)
    assert r.status_code in (200, 201), r.text
    eid = _get_id(r.json(), "expense_id", "id")
    assert eid, r.json()

    upd = {**payload, "amount": 250.75, "memo": "TEST_edit_expense_UPDATED"}
    r2 = client.put(f"{BASE_URL}/api/companies/{COMPANY}/expenses/{eid}", json=upd)
    assert r2.status_code == 200, r2.text

    r3 = client.get(f"{BASE_URL}/api/companies/{COMPANY}/expenses")
    lst = r3.json() if isinstance(r3.json(), list) else r3.json().get("expenses", [])
    found = next((e for e in lst if _get_id(e, "expense_id", "id") == eid), None)
    assert found, "expense not found after update"
    assert float(found["amount"]) == 250.75, f"amount not persisted: {found}"


def test_customer_create_edit_persist(client):
    payload = {"name": "TEST_EditCust", "phone": "+10000000001", "email": "edit1@test.com"}
    r = client.post(f"{BASE_URL}/api/companies/{COMPANY}/customers", json=payload)
    assert r.status_code in (200, 201), r.text
    cid = _get_id(r.json(), "customer_id", "id")
    assert cid, r.json()

    r2 = client.put(f"{BASE_URL}/api/companies/{COMPANY}/customers/{cid}",
                    json={"name": "TEST_EditCust", "phone": "+19999999999", "email": "edit1@test.com"})
    assert r2.status_code == 200, r2.text

    r3 = client.get(f"{BASE_URL}/api/companies/{COMPANY}/customers/{cid}")
    assert r3.status_code == 200, r3.text
    assert r3.json().get("phone") == "+19999999999", r3.json()


def test_vendor_create_edit_persist(client):
    payload = {"name": "TEST_EditVendor", "email": "v1@test.com", "phone": "+1000"}
    r = client.post(f"{BASE_URL}/api/companies/{COMPANY}/vendors", json=payload)
    assert r.status_code in (200, 201), r.text
    vid = _get_id(r.json(), "vendor_id", "id")
    assert vid, r.json()

    r2 = client.put(f"{BASE_URL}/api/companies/{COMPANY}/vendors/{vid}",
                    json={"name": "TEST_EditVendor", "email": "v1_upd@test.com", "phone": "+1000"})
    assert r2.status_code == 200, r2.text

    r3 = client.get(f"{BASE_URL}/api/companies/{COMPANY}/vendors/{vid}")
    assert r3.status_code == 200
    assert r3.json().get("email") == "v1_upd@test.com", r3.json()


def test_product_create_edit_persist(client):
    import time
    payload = {"name": "TEST_EditProduct", "sku": f"TEST-SKU-{int(time.time()*1000)}",
               "selling_price": 50.0, "cost_price": 30.0, "unit": "pcs", "stock_qty": 10}
    r = client.post(f"{BASE_URL}/api/companies/{COMPANY}/products", json=payload)
    assert r.status_code in (200, 201), r.text
    pid = _get_id(r.json(), "product_id", "id")
    assert pid, r.json()

    r2 = client.put(f"{BASE_URL}/api/companies/{COMPANY}/products/{pid}",
                    json={**payload, "selling_price": 99.99})
    assert r2.status_code == 200, r2.text

    r3 = client.get(f"{BASE_URL}/api/companies/{COMPANY}/products/{pid}")
    assert r3.status_code == 200
    assert float(r3.json().get("selling_price")) == 99.99


@pytest.mark.parametrize("path", [
    "/api/companies/ckfrozen/expenses",
    "/api/companies/ckfrozen/customer-payments",
    "/api/companies/ckfrozen/vendor-payments",
    "/api/companies/ckfrozen/invoices",
    "/api/companies/ckfrozen/bills",
])
def test_list_endpoints_reachable(client, path):
    r = client.get(f"{BASE_URL}{path}")
    assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:200]}"

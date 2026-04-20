"""Priority 2 - Inventory Cases Structure tests.
Validates units_per_case, cases_on_hand, available_cases on products and
that stock receipts update BOTH inventory.stock_on_hand AND products.cases_on_hand.
"""
import time, pytest, requests

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


def _pid(obj):
    return obj.get("product_id") or obj.get("id")


# --- Product Create with Cases fields ---
def test_product_create_with_cases(client):
    payload = {
        "name": "TEST_P2_CasesProduct",
        "sku": f"TEST-P2-{int(time.time()*1000)}",
        "description": "Test description for P2",
        "category": "Frozen",
        "selling_price": 100.0, "cost_price": 60.0, "unit": "kg",
        "units_per_case": 12, "cases_on_hand": 10, "available_cases": 10,
    }
    r = client.post(f"{BASE_URL}/api/companies/{COMPANY}/products", json=payload)
    assert r.status_code in (200, 201), r.text
    body = r.json()
    assert body.get("units_per_case") == 12, body
    assert body.get("cases_on_hand") == 10, body
    assert body.get("available_cases") == 10, body
    assert body.get("description") == "Test description for P2", body
    pid = _pid(body); assert pid

    # GET verify persistence
    g = client.get(f"{BASE_URL}/api/companies/{COMPANY}/products/{pid}")
    assert g.status_code == 200
    gg = g.json()
    assert gg.get("units_per_case") == 12
    assert gg.get("cases_on_hand") == 10
    assert gg.get("description") == "Test description for P2"


# --- Product Update units_per_case ---
def test_product_update_units_per_case(client):
    payload = {
        "name": "TEST_P2_UpdUnits",
        "sku": f"TEST-P2U-{int(time.time()*1000)}",
        "selling_price": 50.0, "cost_price": 30.0, "unit": "pcs",
        "units_per_case": 12, "cases_on_hand": 5, "available_cases": 5,
    }
    r = client.post(f"{BASE_URL}/api/companies/{COMPANY}/products", json=payload)
    assert r.status_code in (200, 201), r.text
    pid = _pid(r.json()); assert pid

    upd = {**payload, "units_per_case": 24}
    r2 = client.put(f"{BASE_URL}/api/companies/{COMPANY}/products/{pid}", json=upd)
    assert r2.status_code == 200, r2.text

    g = client.get(f"{BASE_URL}/api/companies/{COMPANY}/products/{pid}")
    assert g.status_code == 200
    assert g.json().get("units_per_case") == 24, g.json()


# --- Backward compatibility: case_quantity fallback + default ---
def test_product_backward_compat_case_quantity(client):
    # case_quantity provided, units_per_case missing -> units_per_case should fall back
    payload = {
        "name": "TEST_P2_BackCompat",
        "sku": f"TEST-P2B-{int(time.time()*1000)}",
        "selling_price": 10.0, "cost_price": 5.0, "unit": "pcs",
        "case_quantity": 6,
    }
    r = client.post(f"{BASE_URL}/api/companies/{COMPANY}/products", json=payload)
    assert r.status_code in (200, 201), r.text
    body = r.json()
    assert body.get("units_per_case") == 6, f"fallback from case_quantity failed: {body}"

    # No units_per_case and no case_quantity -> default 1
    p2 = {
        "name": "TEST_P2_Default",
        "sku": f"TEST-P2D-{int(time.time()*1000)}",
        "selling_price": 1.0, "cost_price": 0.5, "unit": "pcs",
    }
    r2 = client.post(f"{BASE_URL}/api/companies/{COMPANY}/products", json=p2)
    assert r2.status_code in (200, 201), r2.text
    assert r2.json().get("units_per_case") == 1, r2.json()


# --- Products list returns new fields ---
def test_products_list_includes_cases_fields(client):
    r = client.get(f"{BASE_URL}/api/companies/{COMPANY}/products")
    assert r.status_code == 200
    lst = r.json()
    assert isinstance(lst, list) and len(lst) > 0
    # At least one product should have units_per_case key
    any_with = [p for p in lst if "units_per_case" in p]
    assert len(any_with) > 0, "no product exposes units_per_case in list response"


# --- Stock Receipt increments BOTH inventory and product cases ---
def test_stock_receipt_updates_inventory_and_product_cases(client):
    # Find an inventory item linked to a product
    inv = client.get(f"{BASE_URL}/api/companies/{COMPANY}/inventory")
    assert inv.status_code == 200, inv.text
    items = inv.json() if isinstance(inv.json(), list) else inv.json().get("inventory", [])
    target = next((i for i in items if i.get("item_id") and i.get("product_id")), None)
    if not target:
        pytest.skip("No inventory item linked to a product available for receipt test")

    item_id = target["item_id"]; product_id = target["product_id"]

    # Snapshot before
    inv_before = next((i for i in items if i["item_id"] == item_id), {})
    prod_before = client.get(f"{BASE_URL}/api/companies/{COMPANY}/products/{product_id}").json()
    stock_before = float(inv_before.get("stock_on_hand", 0) or 0)
    cases_before = float(prod_before.get("cases_on_hand", 0) or 0)

    payload = {
        "receive_date": "2026-01-20",
        "reference": "TEST_P2_RCPT",
        "vendor_id": "",
        "items": [{"item_id": item_id, "quantity": 3, "unit_cost": 10}],
    }
    r = client.post(f"{BASE_URL}/api/companies/{COMPANY}/stock-receipts", json=payload)
    assert r.status_code in (200, 201), r.text

    # Refetch
    inv2 = client.get(f"{BASE_URL}/api/companies/{COMPANY}/inventory").json()
    items2 = inv2 if isinstance(inv2, list) else inv2.get("inventory", [])
    inv_after = next((i for i in items2 if i["item_id"] == item_id), {})
    prod_after = client.get(f"{BASE_URL}/api/companies/{COMPANY}/products/{product_id}").json()

    stock_after = float(inv_after.get("stock_on_hand", 0) or 0)
    cases_after = float(prod_after.get("cases_on_hand", 0) or 0)

    assert stock_after - stock_before == pytest.approx(3), f"inventory stock_on_hand not incremented: {stock_before}->{stock_after}"
    assert cases_after - cases_before == pytest.approx(3), f"product cases_on_hand not incremented: {cases_before}->{cases_after}"

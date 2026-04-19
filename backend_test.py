#!/usr/bin/env python3
"""
Hishab Nikash Pro Backend API Testing
Tests all critical backend endpoints according to test_result.md scenarios A-E
"""

import requests
import json
import uuid
from datetime import datetime, timezone
import sys

# Configuration
BASE_URL = "https://business-ledger-113.preview.emergentagent.com/api"
SESSION_TOKEN = "test_session_ukrrqssgkvg"
TEST_COMPANY = "ckfrozen"
OTHER_COMPANY = "haor"

HEADERS = {
    "Authorization": f"Bearer {SESSION_TOKEN}",
    "Content-Type": "application/json"
}

class TestResults:
    def __init__(self):
        self.passed = []
        self.failed = []
        self.warnings = []
    
    def add_pass(self, test_name, details=""):
        self.passed.append(f"✅ {test_name}" + (f" - {details}" if details else ""))
        print(f"✅ PASS: {test_name}")
    
    def add_fail(self, test_name, error):
        self.failed.append(f"❌ {test_name} - {error}")
        print(f"❌ FAIL: {test_name} - {error}")
    
    def add_warning(self, test_name, warning):
        self.warnings.append(f"⚠️ {test_name} - {warning}")
        print(f"⚠️ WARNING: {test_name} - {warning}")

def make_request(method, endpoint, data=None, params=None):
    """Make HTTP request with proper error handling"""
    url = f"{BASE_URL}{endpoint}"
    try:
        if method.upper() == "GET":
            response = requests.get(url, headers=HEADERS, params=params, timeout=30)
        elif method.upper() == "POST":
            response = requests.post(url, headers=HEADERS, json=data, timeout=30)
        elif method.upper() == "PUT":
            response = requests.put(url, headers=HEADERS, json=data, timeout=30)
        elif method.upper() == "DELETE":
            response = requests.delete(url, headers=HEADERS, timeout=30)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        return response
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {e}")
        return None

def test_scenario_a_customer_invoice_payment(results):
    """Scenario A: Customer Invoice + Payment flow"""
    print("\n=== SCENARIO A: Customer Invoice + Payment ===")
    
    # Get existing customers first
    response = make_request("GET", f"/companies/{TEST_COMPANY}/customers")
    if not response or response.status_code != 200:
        results.add_fail("A1: Get customers", f"Status: {response.status_code if response else 'No response'}")
        return
    
    customers = response.json()
    if not customers:
        results.add_fail("A1: Get customers", "No customers found")
        return
    
    customer = customers[0]
    customer_id = customer.get("customer_id")
    initial_balance = customer.get("open_balance", 0)
    
    # A1: Create invoice
    invoice_data = {
        "customer_id": customer_id,
        "customer_name": customer.get("name", "Test Customer"),
        "invoice_date": "2026-01-15",
        "due_date": "2026-02-15",
        "sales_rep": "Test Rep",
        "warehouse": "Main Warehouse",
        "items": [{
            "product": "Test Hilsha Fish",
            "description": "Premium frozen hilsha",
            "quantity": 10,
            "unit": "kg",
            "rate": 18.50,
            "discount": 0,
            "tax": 14.80,
            "amount": 185.00
        }],
        "notes": "Test invoice for payment flow",
        "terms": "Net 30",
        "subtotal": 185.00,
        "tax_total": 14.80,
        "discount_total": 0,
        "total": 199.80
    }
    
    response = make_request("POST", f"/companies/{TEST_COMPANY}/invoices", invoice_data)
    if not response or response.status_code != 201:
        results.add_fail("A1: Create invoice", f"Status: {response.status_code if response else 'No response'}")
        return
    
    invoice = response.json()
    invoice_id = invoice.get("invoice_id")
    invoice_total = invoice.get("total", 0)
    results.add_pass("A1: Create invoice", f"Invoice {invoice.get('invoice_number')} created, total: ${invoice_total}")
    
    # A2: Get baseline customer payments count
    response = make_request("GET", f"/companies/{TEST_COMPANY}/customer-payments")
    if not response or response.status_code != 200:
        results.add_fail("A2: Get customer payments baseline", f"Status: {response.status_code if response else 'No response'}")
        return
    
    baseline_payments = response.json()
    baseline_count = baseline_payments.get("count", 0)
    results.add_pass("A2: Get customer payments baseline", f"Current count: {baseline_count}")
    
    # A3: Apply bulk payment via receive-payment
    payment_amount = 100.00  # Partial payment
    payment_data = {
        "customer_id": customer_id,
        "payment_date": "2026-01-16",
        "payment_method": "Bank Transfer",
        "reference": "TEST-PAY-001",
        "deposit_to": "1000",
        "applications": [{
            "invoice_id": invoice_id,
            "amount": payment_amount
        }]
    }
    
    response = make_request("POST", f"/companies/{TEST_COMPANY}/receive-payment", payment_data)
    if not response or response.status_code != 200:
        results.add_fail("A3: Apply bulk payment", f"Status: {response.status_code if response else 'No response'}")
        return
    
    payment_result = response.json()
    if payment_result.get("status") != "success":
        results.add_fail("A3: Apply bulk payment", f"Payment failed: {payment_result}")
        return
    
    results.add_pass("A3: Apply bulk payment", f"Applied ${payment_result.get('total_applied')} to {payment_result.get('invoices_updated')} invoices")
    
    # A4: Verify invoice updated
    response = make_request("GET", f"/companies/{TEST_COMPANY}/invoices/{invoice_id}")
    if not response or response.status_code != 200:
        results.add_fail("A4: Verify invoice updated", f"Status: {response.status_code if response else 'No response'}")
        return
    
    updated_invoice = response.json()
    amount_paid = updated_invoice.get("amount_paid", 0)
    balance_due = updated_invoice.get("balance_due", 0)
    payments = updated_invoice.get("payments", [])
    
    if abs(amount_paid - payment_amount) > 0.01:
        results.add_fail("A4: Verify invoice updated", f"Amount paid mismatch: expected {payment_amount}, got {amount_paid}")
    elif abs(balance_due - (invoice_total - payment_amount)) > 0.01:
        results.add_fail("A4: Verify invoice updated", f"Balance due mismatch: expected {invoice_total - payment_amount}, got {balance_due}")
    elif len(payments) == 0:
        results.add_fail("A4: Verify invoice updated", "No payment entries found")
    else:
        results.add_pass("A4: Verify invoice updated", f"Amount paid: ${amount_paid}, Balance: ${balance_due}, Payments: {len(payments)}")
    
    # A5: Verify customer balance updated
    response = make_request("GET", f"/companies/{TEST_COMPANY}/customers/{customer_id}")
    if not response or response.status_code != 200:
        results.add_fail("A5: Verify customer balance", f"Status: {response.status_code if response else 'No response'}")
        return
    
    updated_customer = response.json()
    new_balance = updated_customer.get("open_balance", 0)
    expected_balance = initial_balance + invoice_total - payment_amount
    
    if abs(new_balance - expected_balance) > 0.01:
        results.add_warning("A5: Verify customer balance", f"Balance mismatch: expected {expected_balance}, got {new_balance}")
    else:
        results.add_pass("A5: Verify customer balance", f"Customer balance updated correctly: ${new_balance}")
    
    # A6: Verify customer payments list updated
    response = make_request("GET", f"/companies/{TEST_COMPANY}/customer-payments")
    if not response or response.status_code != 200:
        results.add_fail("A6: Verify payments list", f"Status: {response.status_code if response else 'No response'}")
        return
    
    updated_payments = response.json()
    new_count = updated_payments.get("count", 0)
    
    if new_count != baseline_count + 1:
        results.add_fail("A6: Verify payments list", f"Count mismatch: expected {baseline_count + 1}, got {new_count}")
    else:
        results.add_pass("A6: Verify payments list", f"Payment count increased to {new_count}")
    
    # A7: Test single-invoice payment endpoint
    single_payment_data = {
        "amount": 50.00,
        "payment_date": "2026-01-17",
        "payment_method": "Check",
        "reference": "TEST-SINGLE-001"
    }
    
    response = make_request("POST", f"/companies/{TEST_COMPANY}/invoices/{invoice_id}/payments", single_payment_data)
    if not response or response.status_code != 200:
        results.add_fail("A7: Single invoice payment", f"Status: {response.status_code if response else 'No response'}")
    else:
        results.add_pass("A7: Single invoice payment", "Single payment endpoint working")

def test_scenario_b_vendor_bill_payment(results):
    """Scenario B: Vendor Bill + Payment flow"""
    print("\n=== SCENARIO B: Vendor Bill + Payment ===")
    
    # Get existing vendors
    response = make_request("GET", f"/companies/{TEST_COMPANY}/vendors")
    if not response or response.status_code != 200:
        results.add_fail("B1: Get vendors", f"Status: {response.status_code if response else 'No response'}")
        return
    
    vendors = response.json()
    if not vendors:
        results.add_fail("B1: Get vendors", "No vendors found")
        return
    
    vendor = vendors[0]
    vendor_id = vendor.get("vendor_id")
    initial_payable = vendor.get("payable_balance", 0)
    
    # B1: Create bill
    bill_data = {
        "vendor_id": vendor_id,
        "vendor_name": vendor.get("name", "Test Vendor"),
        "bill_date": "2026-01-15",
        "due_date": "2026-02-15",
        "reference_number": f"BILL-{uuid.uuid4().hex[:8].upper()}",
        "items": [{
            "description": "Shipping & Freight",
            "quantity": 1,
            "rate": 250.00,
            "amount": 250.00
        }],
        "subtotal": 250.00,
        "tax_total": 20.00,
        "total": 270.00,
        "notes": "Test bill for payment flow"
    }
    
    response = make_request("POST", f"/companies/{TEST_COMPANY}/bills", bill_data)
    if not response or response.status_code != 201:
        results.add_fail("B1: Create bill", f"Status: {response.status_code if response else 'No response'}")
        return
    
    bill = response.json()
    bill_id = bill.get("bill_id")
    bill_total = bill.get("total", 0)
    results.add_pass("B1: Create bill", f"Bill {bill.get('reference_number')} created, total: ${bill_total}")
    
    # B2: Get baseline vendor payments count
    response = make_request("GET", f"/companies/{TEST_COMPANY}/vendor-payments")
    if not response or response.status_code != 200:
        results.add_fail("B2: Get vendor payments baseline", f"Status: {response.status_code if response else 'No response'}")
        return
    
    baseline_payments = response.json()
    baseline_count = baseline_payments.get("count", 0)
    results.add_pass("B2: Get vendor payments baseline", f"Current count: {baseline_count}")
    
    # B3: Apply payment via pay-vendor
    payment_amount = 150.00  # Partial payment
    payment_data = {
        "vendor_id": vendor_id,
        "payment_date": "2026-01-16",
        "payment_method": "Bank Transfer",
        "reference": "TEST-VENDOR-PAY-001",
        "paid_from": "1000",
        "applications": [{
            "bill_id": bill_id,
            "amount": payment_amount
        }]
    }
    
    response = make_request("POST", f"/companies/{TEST_COMPANY}/pay-vendor", payment_data)
    if not response or response.status_code != 200:
        results.add_fail("B3: Apply vendor payment", f"Status: {response.status_code if response else 'No response'}")
        return
    
    payment_result = response.json()
    if payment_result.get("status") != "success":
        results.add_fail("B3: Apply vendor payment", f"Payment failed: {payment_result}")
        return
    
    results.add_pass("B3: Apply vendor payment", f"Applied ${payment_result.get('total_applied')} to {payment_result.get('bills_updated')} bills")
    
    # B4: Verify bill updated
    response = make_request("GET", f"/companies/{TEST_COMPANY}/bills/{bill_id}")
    if not response or response.status_code != 200:
        results.add_fail("B4: Verify bill updated", f"Status: {response.status_code if response else 'No response'}")
        return
    
    updated_bill = response.json()
    amount_paid = updated_bill.get("amount_paid", 0)
    balance_due = updated_bill.get("balance_due", 0)
    payments = updated_bill.get("payments", [])
    
    if abs(amount_paid - payment_amount) > 0.01:
        results.add_fail("B4: Verify bill updated", f"Amount paid mismatch: expected {payment_amount}, got {amount_paid}")
    elif abs(balance_due - (bill_total - payment_amount)) > 0.01:
        results.add_fail("B4: Verify bill updated", f"Balance due mismatch: expected {bill_total - payment_amount}, got {balance_due}")
    elif len(payments) == 0:
        results.add_fail("B4: Verify bill updated", "No payment entries found")
    else:
        results.add_pass("B4: Verify bill updated", f"Amount paid: ${amount_paid}, Balance: ${balance_due}, Payments: {len(payments)}")
    
    # B5: Verify vendor payable balance updated
    response = make_request("GET", f"/companies/{TEST_COMPANY}/vendors/{vendor_id}")
    if not response or response.status_code != 200:
        results.add_fail("B5: Verify vendor balance", f"Status: {response.status_code if response else 'No response'}")
        return
    
    updated_vendor = response.json()
    new_payable = updated_vendor.get("payable_balance", 0)
    expected_payable = initial_payable + bill_total - payment_amount
    
    if abs(new_payable - expected_payable) > 0.01:
        results.add_warning("B5: Verify vendor balance", f"Payable balance mismatch: expected {expected_payable}, got {new_payable}")
    else:
        results.add_pass("B5: Verify vendor balance", f"Vendor payable balance updated correctly: ${new_payable}")
    
    # B6: Verify vendor payments list updated
    response = make_request("GET", f"/companies/{TEST_COMPANY}/vendor-payments")
    if not response or response.status_code != 200:
        results.add_fail("B6: Verify vendor payments list", f"Status: {response.status_code if response else 'No response'}")
        return
    
    updated_payments = response.json()
    new_count = updated_payments.get("count", 0)
    
    if new_count != baseline_count + 1:
        results.add_fail("B6: Verify vendor payments list", f"Count mismatch: expected {baseline_count + 1}, got {new_count}")
    else:
        results.add_pass("B6: Verify vendor payments list", f"Payment count increased to {new_count}")
    
    # B7: Test single-bill payment endpoint
    single_payment_data = {
        "amount": 50.00,
        "payment_date": "2026-01-17",
        "payment_method": "Check",
        "reference": "TEST-SINGLE-BILL-001"
    }
    
    response = make_request("POST", f"/companies/{TEST_COMPANY}/bills/{bill_id}/pay", single_payment_data)
    if not response or response.status_code != 200:
        results.add_fail("B7: Single bill payment", f"Status: {response.status_code if response else 'No response'}")
    else:
        results.add_pass("B7: Single bill payment", "Single bill payment endpoint working")

def test_scenario_c_multi_company_scoping(results):
    """Scenario C: Multi-company scoping"""
    print("\n=== SCENARIO C: Multi-company scoping ===")
    
    # Test customer payments scoping
    response1 = make_request("GET", f"/companies/{TEST_COMPANY}/customer-payments")
    response2 = make_request("GET", f"/companies/{OTHER_COMPANY}/customer-payments")
    
    if not response1 or response1.status_code != 200:
        results.add_fail("C1: Customer payments scoping", f"Failed to get {TEST_COMPANY} payments")
    elif not response2 or response2.status_code != 200:
        results.add_fail("C1: Customer payments scoping", f"Failed to get {OTHER_COMPANY} payments")
    else:
        payments1 = response1.json().get("payments", [])
        payments2 = response2.json().get("payments", [])
        
        # Check for data leakage
        leaked = False
        for p1 in payments1:
            for p2 in payments2:
                if p1.get("payment_id") == p2.get("payment_id"):
                    leaked = True
                    break
        
        if leaked:
            results.add_fail("C1: Customer payments scoping", "Data leakage detected between companies")
        else:
            results.add_pass("C1: Customer payments scoping", f"{TEST_COMPANY}: {len(payments1)} payments, {OTHER_COMPANY}: {len(payments2)} payments")
    
    # Test vendor payments scoping
    response1 = make_request("GET", f"/companies/{TEST_COMPANY}/vendor-payments")
    response2 = make_request("GET", f"/companies/{OTHER_COMPANY}/vendor-payments")
    
    if not response1 or response1.status_code != 200:
        results.add_fail("C2: Vendor payments scoping", f"Failed to get {TEST_COMPANY} vendor payments")
    elif not response2 or response2.status_code != 200:
        results.add_fail("C2: Vendor payments scoping", f"Failed to get {OTHER_COMPANY} vendor payments")
    else:
        payments1 = response1.json().get("payments", [])
        payments2 = response2.json().get("payments", [])
        
        # Check for data leakage
        leaked = False
        for p1 in payments1:
            for p2 in payments2:
                if p1.get("payment_id") == p2.get("payment_id"):
                    leaked = True
                    break
        
        if leaked:
            results.add_fail("C2: Vendor payments scoping", "Data leakage detected between companies")
        else:
            results.add_pass("C2: Vendor payments scoping", f"{TEST_COMPANY}: {len(payments1)} payments, {OTHER_COMPANY}: {len(payments2)} payments")

def test_scenario_d_reports_dashboard(results):
    """Scenario D: Sanity reports and dashboard"""
    print("\n=== SCENARIO D: Reports and Dashboard ===")
    
    # Test dashboard
    response = make_request("GET", f"/companies/{TEST_COMPANY}/dashboard")
    if not response or response.status_code != 200:
        results.add_fail("D1: Dashboard", f"Status: {response.status_code if response else 'No response'}")
    else:
        dashboard = response.json()
        if isinstance(dashboard, dict) and len(dashboard) > 0:
            results.add_pass("D1: Dashboard", f"Dashboard returned {len(dashboard)} metrics")
        else:
            results.add_fail("D1: Dashboard", "Dashboard returned empty or invalid data")
    
    # Test receivables
    response = make_request("GET", f"/companies/{TEST_COMPANY}/receivables")
    if not response or response.status_code != 200:
        results.add_fail("D2: Receivables", f"Status: {response.status_code if response else 'No response'}")
    else:
        receivables = response.json()
        if isinstance(receivables, dict):
            results.add_pass("D2: Receivables", "Receivables report working")
        else:
            results.add_fail("D2: Receivables", "Receivables returned invalid data")
    
    # Test payables
    response = make_request("GET", f"/companies/{TEST_COMPANY}/payables")
    if not response or response.status_code != 200:
        results.add_fail("D3: Payables", f"Status: {response.status_code if response else 'No response'}")
    else:
        payables = response.json()
        if isinstance(payables, dict):
            results.add_pass("D3: Payables", "Payables report working")
        else:
            results.add_fail("D3: Payables", "Payables returned invalid data")
    
    # Test profit-loss report
    params = {"start_date": "2026-01-01", "end_date": "2026-12-31"}
    response = make_request("GET", f"/companies/{TEST_COMPANY}/reports/profit-loss", params=params)
    if not response or response.status_code != 200:
        results.add_fail("D4: Profit-Loss", f"Status: {response.status_code if response else 'No response'}")
    else:
        pl_report = response.json()
        if isinstance(pl_report, dict):
            results.add_pass("D4: Profit-Loss", "P&L report working")
        else:
            results.add_fail("D4: Profit-Loss", "P&L returned invalid data")
    
    # Test balance sheet
    params = {"as_of_date": "2026-12-31"}
    response = make_request("GET", f"/companies/{TEST_COMPANY}/reports/balance-sheet", params=params)
    if not response or response.status_code != 200:
        results.add_fail("D5: Balance Sheet", f"Status: {response.status_code if response else 'No response'}")
    else:
        bs_report = response.json()
        if isinstance(bs_report, dict):
            results.add_pass("D5: Balance Sheet", "Balance sheet working")
        else:
            results.add_fail("D5: Balance Sheet", "Balance sheet returned invalid data")

def test_scenario_e_filters(results):
    """Scenario E: Filters on new endpoints"""
    print("\n=== SCENARIO E: Endpoint Filters ===")
    
    # Get a customer to test filtering
    response = make_request("GET", f"/companies/{TEST_COMPANY}/customers")
    if not response or response.status_code != 200:
        results.add_fail("E1: Get customers for filter test", f"Status: {response.status_code if response else 'No response'}")
        return
    
    customers = response.json()
    if not customers:
        results.add_fail("E1: Get customers for filter test", "No customers found")
        return
    
    customer_id = customers[0].get("customer_id")
    
    # Test customer payments filter
    response = make_request("GET", f"/companies/{TEST_COMPANY}/customer-payments", params={"customer_id": customer_id})
    if not response or response.status_code != 200:
        results.add_fail("E1: Customer payments filter", f"Status: {response.status_code if response else 'No response'}")
    else:
        filtered_payments = response.json().get("payments", [])
        # Verify all payments are for the specified customer
        all_match = all(p.get("customer_id") == customer_id for p in filtered_payments)
        if all_match:
            results.add_pass("E1: Customer payments filter", f"Filter working, {len(filtered_payments)} payments for customer")
        else:
            results.add_fail("E1: Customer payments filter", "Filter not working correctly")
    
    # Get a vendor to test filtering
    response = make_request("GET", f"/companies/{TEST_COMPANY}/vendors")
    if not response or response.status_code != 200:
        results.add_fail("E2: Get vendors for filter test", f"Status: {response.status_code if response else 'No response'}")
        return
    
    vendors = response.json()
    if not vendors:
        results.add_fail("E2: Get vendors for filter test", "No vendors found")
        return
    
    vendor_id = vendors[0].get("vendor_id")
    
    # Test vendor payments filter
    response = make_request("GET", f"/companies/{TEST_COMPANY}/vendor-payments", params={"vendor_id": vendor_id})
    if not response or response.status_code != 200:
        results.add_fail("E2: Vendor payments filter", f"Status: {response.status_code if response else 'No response'}")
    else:
        filtered_payments = response.json().get("payments", [])
        # Verify all payments are for the specified vendor
        all_match = all(p.get("vendor_id") == vendor_id for p in filtered_payments)
        if all_match:
            results.add_pass("E2: Vendor payments filter", f"Filter working, {len(filtered_payments)} payments for vendor")
        else:
            results.add_fail("E2: Vendor payments filter", "Filter not working correctly")

def main():
    """Run all backend tests"""
    print("🚀 Starting Hishab Nikash Pro Backend API Tests")
    print(f"Base URL: {BASE_URL}")
    print(f"Test Company: {TEST_COMPANY}")
    print(f"Session Token: {SESSION_TOKEN[:20]}...")
    
    results = TestResults()
    
    # Test API connectivity first
    response = make_request("GET", "/")
    if not response or response.status_code != 200:
        print(f"❌ CRITICAL: Cannot connect to API at {BASE_URL}")
        sys.exit(1)
    
    print("✅ API connectivity confirmed")
    
    # Run all test scenarios
    test_scenario_a_customer_invoice_payment(results)
    test_scenario_b_vendor_bill_payment(results)
    test_scenario_c_multi_company_scoping(results)
    test_scenario_d_reports_dashboard(results)
    test_scenario_e_filters(results)
    
    # Print summary
    print("\n" + "="*60)
    print("🏁 TEST SUMMARY")
    print("="*60)
    
    print(f"\n✅ PASSED ({len(results.passed)}):")
    for test in results.passed:
        print(f"  {test}")
    
    if results.warnings:
        print(f"\n⚠️ WARNINGS ({len(results.warnings)}):")
        for warning in results.warnings:
            print(f"  {warning}")
    
    if results.failed:
        print(f"\n❌ FAILED ({len(results.failed)}):")
        for failure in results.failed:
            print(f"  {failure}")
    
    print(f"\nOverall: {len(results.passed)} passed, {len(results.warnings)} warnings, {len(results.failed)} failed")
    
    if results.failed:
        print("\n🔥 CRITICAL ISSUES FOUND - Backend needs attention")
        return 1
    elif results.warnings:
        print("\n⚠️ Minor issues found but core functionality working")
        return 0
    else:
        print("\n🎉 All tests passed!")
        return 0

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
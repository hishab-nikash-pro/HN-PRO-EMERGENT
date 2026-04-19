#!/usr/bin/env python3
"""
Hishab Nikash Pro Backend API Testing - Iteration 2
Tests AI Assistant, Roles middleware, and regression scenarios
"""

import requests
import json
import uuid
from datetime import datetime, timezone
import sys
import pymongo
import os

# Configuration
BASE_URL = "https://business-ledger-113.preview.emergentagent.com/api"
SESSION_TOKEN = "test_session_ukrrqssgkvg"
TEST_COMPANY = "ckfrozen"
TEST_USER_ID = "user_test_ai30qogd8wq"

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

def get_mongo_client():
    """Get MongoDB client for direct database operations"""
    try:
        # Try to get MONGO_URL from backend .env
        mongo_url = "mongodb://localhost:27017/test_database"  # Default fallback
        client = pymongo.MongoClient(mongo_url)
        # Test connection
        client.admin.command('ping')
        return client
    except Exception as e:
        print(f"MongoDB connection failed: {e}")
        return None

def test_ai_assistant_live_context(results):
    """Test AI Assistant with live business context"""
    print("\n=== AI ASSISTANT LIVE CONTEXT TESTS ===")
    
    session_id = f"test_session_{uuid.uuid4().hex[:8]}"
    
    # Test 1: Overdue customers query
    print("\n--- Test 1: Overdue customers query ---")
    chat_data = {
        "message": "Who are my overdue customers right now?",
        "session_id": session_id,
        "company_id": TEST_COMPANY
    }
    
    response = make_request("POST", "/ai/chat", chat_data)
    if not response or response.status_code != 200:
        results.add_fail("AI-1: Overdue customers query", f"Status: {response.status_code if response else 'No response'}")
    else:
        try:
            ai_response = response.json()
            response_text = ai_response.get("response", "")
            
            if not response_text or len(response_text.strip()) == 0:
                results.add_fail("AI-1: Overdue customers query", "Empty response from AI")
            elif "overdue" in response_text.lower() or "receivable" in response_text.lower() or "customer" in response_text.lower():
                results.add_pass("AI-1: Overdue customers query", f"AI referenced AR/overdue info: {response_text[:100]}...")
            else:
                results.add_warning("AI-1: Overdue customers query", f"Response may not reference overdue info: {response_text[:100]}...")
        except Exception as e:
            results.add_fail("AI-1: Overdue customers query", f"Failed to parse response: {e}")
    
    # Test 2: Low stock query
    print("\n--- Test 2: Low stock query ---")
    chat_data = {
        "message": "Which items are low on stock?",
        "session_id": session_id,
        "company_id": TEST_COMPANY
    }
    
    response = make_request("POST", "/ai/chat", chat_data)
    if not response or response.status_code != 200:
        results.add_fail("AI-2: Low stock query", f"Status: {response.status_code if response else 'No response'}")
    else:
        try:
            ai_response = response.json()
            response_text = ai_response.get("response", "")
            
            if not response_text or len(response_text.strip()) == 0:
                results.add_fail("AI-2: Low stock query", "Empty response from AI")
            elif "stock" in response_text.lower() or "inventory" in response_text.lower() or "product" in response_text.lower():
                results.add_pass("AI-2: Low stock query", f"AI referenced product/stock info: {response_text[:100]}...")
            else:
                results.add_warning("AI-2: Low stock query", f"Response may not reference stock info: {response_text[:100]}...")
        except Exception as e:
            results.add_fail("AI-2: Low stock query", f"Failed to parse response: {e}")
    
    # Test 3: Monthly performance summary
    print("\n--- Test 3: Monthly performance summary ---")
    chat_data = {
        "message": "Summarize this month's performance.",
        "session_id": session_id,
        "company_id": TEST_COMPANY
    }
    
    response = make_request("POST", "/ai/chat", chat_data)
    if not response or response.status_code != 200:
        results.add_fail("AI-3: Monthly performance", f"Status: {response.status_code if response else 'No response'}")
    else:
        try:
            ai_response = response.json()
            response_text = ai_response.get("response", "")
            
            if not response_text or len(response_text.strip()) == 0:
                results.add_fail("AI-3: Monthly performance", "Empty response from AI")
            elif any(char.isdigit() for char in response_text) and ("sales" in response_text.lower() or "revenue" in response_text.lower() or "expense" in response_text.lower() or "performance" in response_text.lower()):
                results.add_pass("AI-3: Monthly performance", f"AI included numbers and performance metrics: {response_text[:100]}...")
            else:
                results.add_warning("AI-3: Monthly performance", f"Response may not include numeric performance data: {response_text[:100]}...")
        except Exception as e:
            results.add_fail("AI-3: Monthly performance", f"Failed to parse response: {e}")
    
    # Test 4: Session persistence
    print("\n--- Test 4: Session persistence ---")
    chat_data = {
        "message": "Show me the top 3 from that list",
        "session_id": session_id,
        "company_id": TEST_COMPANY
    }
    
    response = make_request("POST", "/ai/chat", chat_data)
    if not response or response.status_code != 200:
        results.add_fail("AI-4: Session persistence", f"Status: {response.status_code if response else 'No response'}")
    else:
        try:
            ai_response = response.json()
            response_text = ai_response.get("response", "")
            
            if not response_text or len(response_text.strip()) == 0:
                results.add_fail("AI-4: Session persistence", "Empty response from AI")
            elif "which list" in response_text.lower() or "what list" in response_text.lower():
                results.add_fail("AI-4: Session persistence", "AI lost context - asking which list")
            else:
                results.add_pass("AI-4: Session persistence", f"AI maintained context: {response_text[:100]}...")
        except Exception as e:
            results.add_fail("AI-4: Session persistence", f"Failed to parse response: {e}")

def test_roles_middleware(results):
    """Test roles enforcement middleware"""
    print("\n=== ROLES MIDDLEWARE TESTS ===")
    
    # Test 1: Default role without team_member record
    print("\n--- Test 1: Default role (Owner) ---")
    response = make_request("GET", "/auth/me-with-role")
    if not response or response.status_code != 200:
        results.add_fail("ROLE-1: Default role", f"Status: {response.status_code if response else 'No response'}")
    else:
        try:
            role_data = response.json()
            user = role_data.get("user", {})
            role = role_data.get("role", "")
            company_id = role_data.get("company_id", "")
            
            if role == "Owner":
                results.add_pass("ROLE-1: Default role", f"Default role is Owner, company_id: {company_id}")
            else:
                results.add_fail("ROLE-1: Default role", f"Expected Owner, got: {role}")
        except Exception as e:
            results.add_fail("ROLE-1: Default role", f"Failed to parse response: {e}")
    
    # Test 2: Role with specific company
    print("\n--- Test 2: Role with company_id ---")
    response = make_request("GET", "/auth/me-with-role", params={"company_id": TEST_COMPANY})
    if not response or response.status_code != 200:
        results.add_fail("ROLE-2: Role with company", f"Status: {response.status_code if response else 'No response'}")
    else:
        try:
            role_data = response.json()
            role = role_data.get("role", "")
            company_id = role_data.get("company_id", "")
            
            if role == "Owner" and company_id == TEST_COMPANY:
                results.add_pass("ROLE-2: Role with company", f"Role: {role}, Company: {company_id}")
            else:
                results.add_fail("ROLE-2: Role with company", f"Expected Owner/{TEST_COMPANY}, got: {role}/{company_id}")
        except Exception as e:
            results.add_fail("ROLE-2: Role with company", f"Failed to parse response: {e}")
    
    # Test 3: Regression - Scenarios A & B should still pass
    print("\n--- Test 3: Regression test (Owner permissions) ---")
    
    # Quick customer creation test
    customer_data = {
        "name": "Test Regression Customer",
        "email": "regression@test.com",
        "phone": "555-0123",
        "address": "123 Test St"
    }
    
    response = make_request("POST", f"/companies/{TEST_COMPANY}/customers", customer_data)
    if not response or response.status_code != 201:
        results.add_fail("ROLE-3a: Owner customer creation", f"Status: {response.status_code if response else 'No response'}")
    else:
        results.add_pass("ROLE-3a: Owner customer creation", "Owner can create customers")
    
    # Quick receive payment test
    payment_data = {
        "customer_id": "cust_test_regression",
        "payment_date": "2026-01-20",
        "payment_method": "Cash",
        "reference": "REGRESSION-TEST",
        "deposit_to": "1000",
        "applications": []
    }
    
    response = make_request("POST", f"/companies/{TEST_COMPANY}/receive-payment", payment_data)
    # This might fail due to invalid customer_id, but should not be 403
    if response and response.status_code == 403:
        results.add_fail("ROLE-3b: Owner receive payment", "Owner blocked from receive-payment (403)")
    else:
        results.add_pass("ROLE-3b: Owner receive payment", "Owner not blocked from receive-payment")
    
    # Test 4: Negative testing - Viewer role simulation
    print("\n--- Test 4: Viewer role simulation ---")
    
    # Insert test team member with Viewer role
    mongo_client = get_mongo_client()
    if not mongo_client:
        results.add_warning("ROLE-4: Viewer simulation", "Cannot connect to MongoDB for role testing")
        return
    
    try:
        db = mongo_client.test_database
        team_members = db.team_members
        
        # Insert viewer role
        viewer_doc = {
            "member_id": "mem_test_viewer",
            "user_id": TEST_USER_ID,
            "name": "Test Owner",
            "email": "test.owner@hishabnikash.dev",
            "role": "Viewer",
            "companies": [TEST_COMPANY],
            "status": "Active",
            "created_at": datetime.now().isoformat()
        }
        
        team_members.insert_one(viewer_doc)
        print("✓ Inserted Viewer role for testing")
        
        # Test 4a: POST customers should return 403
        response = make_request("POST", f"/companies/{TEST_COMPANY}/customers", customer_data)
        if response and response.status_code == 403:
            results.add_pass("ROLE-4a: Viewer blocked from POST customers", "403 returned as expected")
        else:
            results.add_fail("ROLE-4a: Viewer blocked from POST customers", f"Expected 403, got: {response.status_code if response else 'No response'}")
        
        # Test 4b: POST receive-payment should return 403
        response = make_request("POST", f"/companies/{TEST_COMPANY}/receive-payment", payment_data)
        if response and response.status_code == 403:
            results.add_pass("ROLE-4b: Viewer blocked from receive-payment", "403 returned as expected")
        else:
            results.add_fail("ROLE-4b: Viewer blocked from receive-payment", f"Expected 403, got: {response.status_code if response else 'No response'}")
        
        # Test 4c: GET customers should still work (200)
        response = make_request("GET", f"/companies/{TEST_COMPANY}/customers")
        if response and response.status_code == 200:
            results.add_pass("ROLE-4c: Viewer can GET customers", "200 returned as expected")
        else:
            results.add_fail("ROLE-4c: Viewer can GET customers", f"Expected 200, got: {response.status_code if response else 'No response'}")
        
        # Cleanup: Remove the test team member
        team_members.delete_one({"member_id": "mem_test_viewer"})
        print("✓ Cleaned up Viewer role")
        
        # Verify role returns to Owner
        response = make_request("GET", "/auth/me-with-role", params={"company_id": TEST_COMPANY})
        if response and response.status_code == 200:
            role_data = response.json()
            role = role_data.get("role", "")
            if role == "Owner":
                results.add_pass("ROLE-4d: Cleanup verification", "Role returned to Owner after cleanup")
            else:
                results.add_warning("ROLE-4d: Cleanup verification", f"Role is {role}, expected Owner")
        
    except Exception as e:
        results.add_fail("ROLE-4: Viewer simulation", f"MongoDB operation failed: {e}")
    finally:
        if mongo_client:
            mongo_client.close()

def test_regression_smoke(results):
    """Test regression smoke tests"""
    print("\n=== REGRESSION SMOKE TESTS ===")
    
    # Test 1: Customer payments endpoint
    response = make_request("GET", f"/companies/{TEST_COMPANY}/customer-payments")
    if not response or response.status_code != 200:
        results.add_fail("REG-1: Customer payments", f"Status: {response.status_code if response else 'No response'}")
    else:
        data = response.json()
        if isinstance(data, dict) and "payments" in data:
            results.add_pass("REG-1: Customer payments", f"Returned {data.get('count', 0)} payments")
        else:
            results.add_fail("REG-1: Customer payments", "Invalid response structure")
    
    # Test 2: Vendor payments endpoint
    response = make_request("GET", f"/companies/{TEST_COMPANY}/vendor-payments")
    if not response or response.status_code != 200:
        results.add_fail("REG-2: Vendor payments", f"Status: {response.status_code if response else 'No response'}")
    else:
        data = response.json()
        if isinstance(data, dict) and "payments" in data:
            results.add_pass("REG-2: Vendor payments", f"Returned {data.get('count', 0)} payments")
        else:
            results.add_fail("REG-2: Vendor payments", "Invalid response structure")
    
    # Test 3: Pay vendor endpoint (with minimal valid data)
    # First get a vendor
    response = make_request("GET", f"/companies/{TEST_COMPANY}/vendors")
    if not response or response.status_code != 200:
        results.add_warning("REG-3: Pay vendor setup", "Cannot get vendors for pay-vendor test")
    else:
        vendors = response.json()
        if vendors:
            vendor_id = vendors[0].get("vendor_id")
            pay_vendor_data = {
                "vendor_id": vendor_id,
                "payment_date": "2026-01-20",
                "payment_method": "Bank Transfer",
                "reference": "REG-TEST-001",
                "paid_from": "1000",
                "applications": []  # Empty applications
            }
            
            response = make_request("POST", f"/companies/{TEST_COMPANY}/pay-vendor", pay_vendor_data)
            if response and response.status_code == 200:
                results.add_pass("REG-3: Pay vendor", "Endpoint accessible and processing")
            elif response and response.status_code == 400:
                results.add_pass("REG-3: Pay vendor", "Endpoint accessible (400 expected for empty applications)")
            else:
                results.add_fail("REG-3: Pay vendor", f"Status: {response.status_code if response else 'No response'}")
        else:
            results.add_warning("REG-3: Pay vendor", "No vendors available for testing")
    
    # Test 4: Reports endpoints
    reports = [
        ("profit-loss", {"start_date": "2026-01-01", "end_date": "2026-01-31"}),
        ("balance-sheet", {"as_of_date": "2026-01-31"}),
        ("cash-flow", {"start_date": "2026-01-01", "end_date": "2026-01-31"})
    ]
    
    for report_name, params in reports:
        response = make_request("GET", f"/companies/{TEST_COMPANY}/reports/{report_name}", params=params)
        if not response or response.status_code != 200:
            results.add_fail(f"REG-4: {report_name} report", f"Status: {response.status_code if response else 'No response'}")
        else:
            data = response.json()
            if isinstance(data, dict):
                results.add_pass(f"REG-4: {report_name} report", "Report endpoint working")
            else:
                results.add_fail(f"REG-4: {report_name} report", "Invalid response structure")

def main():
    """Run all iteration 2 backend tests"""
    print("🚀 Starting Hishab Nikash Pro Backend API Tests - Iteration 2")
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
    
    # Run iteration 2 specific tests
    test_ai_assistant_live_context(results)
    test_roles_middleware(results)
    test_regression_smoke(results)
    
    # Print summary
    print("\n" + "="*60)
    print("🏁 ITERATION 2 TEST SUMMARY")
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
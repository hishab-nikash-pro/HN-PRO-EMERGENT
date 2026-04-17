import requests
import sys
from datetime import datetime
import json

class HishabNikashAPITester:
    def __init__(self, base_url="https://nikash-ops.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.session_token = "test_session_1776150388162"
        self.user_id = "test-user-1776150388162"
        self.company_id = "ckfrozen"
        self.headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.session_token}'
        }
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def run_test(self, name, method, endpoint, expected_status, data=None, description=""):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        self.tests_run += 1
        
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {method} {url}")
        if description:
            print(f"   Description: {description}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=self.headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=self.headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=self.headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=self.headers, timeout=10)

            success = response.status_code == expected_status
            
            result = {
                "test_name": name,
                "method": method,
                "endpoint": endpoint,
                "expected_status": expected_status,
                "actual_status": response.status_code,
                "success": success,
                "response_data": None,
                "error": None
            }

            if success:
                self.tests_passed += 1
                print(f"✅ PASSED - Status: {response.status_code}")
                try:
                    result["response_data"] = response.json()
                    if method == 'GET' and 'products' in endpoint:
                        data_len = len(result["response_data"]) if isinstance(result["response_data"], list) else 1
                        print(f"   Response: {data_len} items returned")
                    elif 'low-stock-alert' in endpoint:
                        alert_data = result["response_data"]
                        print(f"   Alert Status: {alert_data.get('status', 'unknown')}")
                        if 'items_count' in alert_data:
                            print(f"   Items Count: {alert_data['items_count']}")
                except:
                    result["response_data"] = response.text
            else:
                print(f"❌ FAILED - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    result["error"] = error_data
                    print(f"   Error: {error_data}")
                except:
                    result["error"] = response.text
                    print(f"   Error: {response.text}")

            self.test_results.append(result)
            return success, result["response_data"]

        except Exception as e:
            print(f"❌ FAILED - Exception: {str(e)}")
            result = {
                "test_name": name,
                "method": method,
                "endpoint": endpoint,
                "expected_status": expected_status,
                "actual_status": "ERROR",
                "success": False,
                "response_data": None,
                "error": str(e)
            }
            self.test_results.append(result)
            return False, {}

    def test_auth(self):
        """Test authentication"""
        print("\n" + "="*60)
        print("🔐 TESTING AUTHENTICATION")
        print("="*60)
        
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200,
            description="Verify test session token works"
        )
        return success

    def test_products_crud(self):
        """Test Products CRUD operations"""
        print("\n" + "="*60)
        print("📦 TESTING PRODUCTS CRUD")
        print("="*60)
        
        # Test GET products - should return 15 seeded products
        success, products = self.run_test(
            "Get Products List",
            "GET",
            f"companies/{self.company_id}/products",
            200,
            description="Should return 15 seeded products for CK Frozen"
        )
        
        if not success:
            return False
            
        print(f"   Found {len(products)} products")
        if len(products) < 15:
            print(f"   ⚠️  WARNING: Expected 15 products, found {len(products)}")
        
        # Test POST - Create new product
        new_product_data = {
            "name": "Test Fish Product",
            "description": "Test product for API testing",
            "category": "Frozen Fish",
            "unit": "kg",
            "cost_price": 5.99,
            "selling_price": 8.99,
            "case_price": 179.80,
            "case_quantity": 20,
            "weight_info": "20KG CASE",
            "sku": "TEST-001"
        }
        
        success, created_product = self.run_test(
            "Create New Product",
            "POST",
            f"companies/{self.company_id}/products",
            201,
            data=new_product_data,
            description="Create a test product"
        )
        
        if not success:
            return False
            
        product_id = created_product.get('product_id')
        print(f"   Created product ID: {product_id}")
        
        # Test PUT - Update product
        update_data = {
            "name": "Updated Test Fish Product",
            "description": "Updated test product",
            "category": "Frozen Fish",
            "unit": "kg",
            "cost_price": 6.99,
            "selling_price": 9.99,
            "case_price": 199.80,
            "case_quantity": 20,
            "weight_info": "20KG CASE UPDATED",
            "sku": "TEST-001-UPD"
        }
        
        success, updated_product = self.run_test(
            "Update Product",
            "PUT",
            f"companies/{self.company_id}/products/{product_id}",
            200,
            data=update_data,
            description="Update the test product"
        )
        
        if not success:
            return False
            
        # Test GET single product
        success, single_product = self.run_test(
            "Get Single Product",
            "GET",
            f"companies/{self.company_id}/products/{product_id}",
            200,
            description="Get the updated product by ID"
        )
        
        if not success:
            return False
            
        # Test DELETE product
        success, _ = self.run_test(
            "Delete Product",
            "DELETE",
            f"companies/{self.company_id}/products/{product_id}",
            200,
            description="Delete the test product"
        )
        
        return success

    def test_low_stock_alert(self):
        """Test low stock email alert"""
        print("\n" + "="*60)
        print("📧 TESTING LOW STOCK ALERT")
        print("="*60)
        
        success, alert_response = self.run_test(
            "Send Low Stock Alert",
            "POST",
            f"companies/{self.company_id}/low-stock-alert",
            200,
            description="Send low stock email alert via Resend"
        )
        
        if success and alert_response:
            status = alert_response.get('status', 'unknown')
            if status == 'sent':
                print(f"   ✅ Email sent successfully to {alert_response.get('sent_to')}")
                print(f"   📊 Alert for {alert_response.get('items_count')} low stock items")
            elif status == 'no_alerts':
                print(f"   ℹ️  No low stock items found - all inventory levels adequate")
            else:
                print(f"   ⚠️  Alert status: {status}")
        
        return success

    def test_ai_assistant(self):
        """Test AI Assistant endpoints"""
        print("\n" + "="*60)
        print("🤖 TESTING AI ASSISTANT")
        print("="*60)
        
        # Test AI chat
        chat_data = {
            "message": "What is my total sales this month?",
            "company_id": self.company_id
        }
        
        success, chat_response = self.run_test(
            "AI Chat",
            "POST",
            "ai/chat",
            200,
            data=chat_data,
            description="Send message to AI assistant with GPT-5.2"
        )
        
        if success and chat_response:
            session_id = chat_response.get('session_id')
            print(f"   📝 Session ID: {session_id}")
            print(f"   🤖 Response length: {len(chat_response.get('response', ''))}")
        
        # Test get AI sessions
        success2, sessions = self.run_test(
            "Get AI Sessions",
            "GET",
            "ai/sessions",
            200,
            description="Get chat history sessions"
        )
        
        if success2 and sessions:
            print(f"   📚 Found {len(sessions)} chat sessions")
        
        return success and success2

    def test_settings(self):
        """Test Settings endpoints"""
        print("\n" + "="*60)
        print("⚙️ TESTING SETTINGS")
        print("="*60)
        
        # Test GET settings
        success, settings = self.run_test(
            "Get Settings",
            "GET",
            f"settings/{self.company_id}",
            200,
            description="Get company settings"
        )
        
        if success and settings:
            print(f"   🏢 Company: {settings.get('company_id')}")
            print(f"   💰 Currency: {settings.get('currency', 'USD')}")
            print(f"   📄 Invoice prefix: {settings.get('invoice_prefix', 'INV')}")
        
        # Test PUT settings - update tax rate
        update_data = {
            "tax_rate": 8.5,
            "invoice_prefix": "INV-TEST"
        }
        
        success2, updated_settings = self.run_test(
            "Update Settings",
            "PUT",
            f"settings/{self.company_id}",
            200,
            data=update_data,
            description="Update company settings"
        )
        
        if success2 and updated_settings:
            print(f"   ✅ Updated tax rate: {updated_settings.get('tax_rate')}")
            print(f"   ✅ Updated prefix: {updated_settings.get('invoice_prefix')}")
        
        return success and success2

    def test_team_management(self):
        """Test Team Management endpoints"""
        print("\n" + "="*60)
        print("👥 TESTING TEAM MANAGEMENT")
        print("="*60)
        
        # Test GET team members
        success, members = self.run_test(
            "Get Team Members",
            "GET",
            "team-members",
            200,
            description="Get team members list"
        )
        
        if success and members:
            print(f"   👥 Found {len(members)} team members")
            for member in members[:3]:  # Show first 3
                print(f"     - {member.get('name', 'N/A')}: {member.get('role', 'N/A')}")
        
        # Test GET pending registrations
        success2, pending = self.run_test(
            "Get Pending Registrations",
            "GET",
            "pending-registrations",
            200,
            description="Get pending registration requests"
        )
        
        if success2 and pending:
            print(f"   ⏳ Found {len(pending)} pending registrations")
        
        return success and success2

    def test_scheduled_alerts(self):
        """Test Scheduled Alert endpoints"""
        print("\n" + "="*60)
        print("⏰ TESTING SCHEDULED ALERTS")
        print("="*60)
        
        # Test daily low stock check
        success, check_response = self.run_test(
            "Daily Low Stock Check",
            "POST",
            "scheduled/daily-low-stock-check",
            200,
            description="Run daily low stock check for all companies"
        )
        
        if success and check_response:
            results = check_response.get('results', [])
            print(f"   🏢 Checked {len(results)} companies")
            for result in results:
                company = result.get('company', 'unknown')
                status = result.get('status', 'unknown')
                low_stock = result.get('low_stock', 0)
                print(f"     - {company}: {low_stock} low stock items, status: {status}")
        
        return success

    def test_balance_sheet_report(self):
        """Test Balance Sheet report endpoint"""
        print("\n" + "="*60)
        print("📊 TESTING BALANCE SHEET REPORT")
        print("="*60)
        
        # Test GET balance sheet
        success, balance_sheet = self.run_test(
            "Get Balance Sheet",
            "GET",
            f"companies/{self.company_id}/reports/balance-sheet",
            200,
            description="Get balance sheet with assets, liabilities, and equity"
        )
        
        if success and balance_sheet:
            assets = balance_sheet.get('assets', {})
            liabilities = balance_sheet.get('liabilities', {})
            equity = balance_sheet.get('equity', {})
            
            print(f"   💰 Total Assets: ${assets.get('total_assets', 0):,.2f}")
            print(f"   📋 Total Liabilities: ${liabilities.get('total_liabilities', 0):,.2f}")
            print(f"   🏦 Total Equity: ${equity.get('total_equity', 0):,.2f}")
            print(f"   📅 As of Date: {balance_sheet.get('as_of_date', 'N/A')}")
            
            # Check if balance sheet balances
            total_assets = assets.get('total_assets', 0)
            total_liab_equity = balance_sheet.get('total_liabilities_and_equity', 0)
            if abs(total_assets - total_liab_equity) < 0.01:
                print(f"   ✅ Balance sheet balances correctly")
            else:
                print(f"   ⚠️  Balance sheet doesn't balance: Assets {total_assets} != Liab+Equity {total_liab_equity}")
        
        # Test with specific date
        success2, balance_sheet_dated = self.run_test(
            "Get Balance Sheet with Date",
            "GET",
            f"companies/{self.company_id}/reports/balance-sheet?as_of_date=2024-12-31",
            200,
            description="Get balance sheet as of specific date"
        )
        
        return success and success2

    def test_cash_flow_report(self):
        """Test Cash Flow report endpoint"""
        print("\n" + "="*60)
        print("💸 TESTING CASH FLOW REPORT")
        print("="*60)
        
        # Test GET cash flow
        success, cash_flow = self.run_test(
            "Get Cash Flow",
            "GET",
            f"companies/{self.company_id}/reports/cash-flow",
            200,
            description="Get cash flow with operating, investing, and financing activities"
        )
        
        if success and cash_flow:
            operating = cash_flow.get('operating_activities', {})
            investing = cash_flow.get('investing_activities', {})
            financing = cash_flow.get('financing_activities', {})
            
            print(f"   💰 Collections: ${operating.get('collections_from_customers', 0):,.2f}")
            print(f"   💸 Payments: ${operating.get('payments_to_vendors', 0):,.2f}")
            print(f"   📈 Net Operating: ${operating.get('net_operating_cash_flow', 0):,.2f}")
            print(f"   🏦 Beginning Cash: ${cash_flow.get('beginning_cash', 0):,.2f}")
            print(f"   🏦 Ending Cash: ${cash_flow.get('ending_cash', 0):,.2f}")
            
            monthly_data = cash_flow.get('monthly_data', [])
            print(f"   📊 Monthly data points: {len(monthly_data)}")
        
        # Test with date range
        success2, cash_flow_range = self.run_test(
            "Get Cash Flow with Date Range",
            "GET",
            f"companies/{self.company_id}/reports/cash-flow?start_date=2024-01-01&end_date=2024-12-31",
            200,
            description="Get cash flow for specific date range"
        )
        
        return success and success2

    def test_customer_statement(self):
        """Test Customer Statement endpoint"""
        print("\n" + "="*60)
        print("👤 TESTING CUSTOMER STATEMENT")
        print("="*60)
        
        # First get customers to find a valid customer ID
        success, customers = self.run_test(
            "Get Customers for Statement",
            "GET",
            f"companies/{self.company_id}/customers",
            200,
            description="Get customers list to find valid customer ID"
        )
        
        if not success or not customers:
            print("   ❌ No customers found for statement testing")
            return False
        
        # Use first customer
        customer_id = customers[0].get('customer_id')
        customer_name = customers[0].get('name', 'Unknown')
        print(f"   👤 Testing statement for: {customer_name} ({customer_id})")
        
        # Test GET customer statement
        success, statement = self.run_test(
            "Get Customer Statement",
            "GET",
            f"companies/{self.company_id}/customers/{customer_id}/statement",
            200,
            description="Get customer statement with transactions and balance"
        )
        
        if success and statement:
            customer = statement.get('customer', {})
            transactions = statement.get('transactions', [])
            
            print(f"   👤 Customer: {customer.get('name', 'N/A')}")
            print(f"   💰 Total Invoiced: ${statement.get('total_invoiced', 0):,.2f}")
            print(f"   💸 Total Paid: ${statement.get('total_paid', 0):,.2f}")
            print(f"   📋 Balance Due: ${statement.get('balance_due', 0):,.2f}")
            print(f"   📊 Transactions: {len(transactions)}")
            print(f"   📅 Statement Date: {statement.get('statement_date', 'N/A')}")
        
        return success

    def test_inventory_for_alerts(self):
        """Test inventory to check for low stock items"""
        print("\n" + "="*60)
        print("📦 TESTING INVENTORY FOR LOW STOCK")
        print("="*60)
        
        success, inventory = self.run_test(
            "Get Inventory List",
            "GET",
            f"companies/{self.company_id}/inventory",
            200,
            description="Get inventory to check for low stock items"
        )
        
        if success and inventory:
            low_stock_items = [item for item in inventory if item.get('stock_on_hand', 0) <= item.get('reorder_point', 10)]
            print(f"   📊 Total inventory items: {len(inventory)}")
            print(f"   ⚠️  Low stock items: {len(low_stock_items)}")
            
            if low_stock_items:
                print("   Low stock items:")
                for item in low_stock_items[:5]:  # Show first 5
                    print(f"     - {item.get('sku', 'N/A')}: {item.get('product_name', 'N/A')} ({item.get('stock_on_hand', 0)} <= {item.get('reorder_point', 10)})")
        
        return success

    def run_all_tests(self):
        """Run all tests"""
        print("🚀 Starting Hishab Nikash Pro Phase 3 API Tests")
        print(f"📍 Base URL: {self.base_url}")
        print(f"🏢 Company: {self.company_id}")
        print(f"👤 User: {self.user_id}")
        print(f"🔑 Session: {self.session_token[:20]}...")
        
        # Test authentication first
        if not self.test_auth():
            print("\n❌ Authentication failed - stopping tests")
            return False
        
        # Test inventory to understand low stock situation
        self.test_inventory_for_alerts()
        
        # Test products CRUD (existing functionality)
        if not self.test_products_crud():
            print("\n❌ Products CRUD tests failed")
            return False
        
        # Test low stock alert (existing functionality)
        if not self.test_low_stock_alert():
            print("\n❌ Low stock alert test failed")
            return False
        
        # Phase 3 New Features
        print("\n" + "="*60)
        print("🆕 TESTING PHASE 3 NEW FEATURES")
        print("="*60)
        
        # Test AI Assistant
        if not self.test_ai_assistant():
            print("\n❌ AI Assistant tests failed")
            return False
        
        # Test Settings
        if not self.test_settings():
            print("\n❌ Settings tests failed")
            return False
        
        # Test Team Management
        if not self.test_team_management():
            print("\n❌ Team Management tests failed")
            return False
        
        # Test Scheduled Alerts
        if not self.test_scheduled_alerts():
            print("\n❌ Scheduled Alerts tests failed")
            return False
        
        # Test Balance Sheet Report (NEW)
        if not self.test_balance_sheet_report():
            print("\n❌ Balance Sheet Report tests failed")
            return False
        
        # Test Cash Flow Report (NEW)
        if not self.test_cash_flow_report():
            print("\n❌ Cash Flow Report tests failed")
            return False
        
        # Test Customer Statement (NEW)
        if not self.test_customer_statement():
            print("\n❌ Customer Statement tests failed")
            return False
        
        return True

    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("📊 TEST SUMMARY")
        print("="*60)
        print(f"Tests run: {self.tests_run}")
        print(f"Tests passed: {self.tests_passed}")
        print(f"Tests failed: {self.tests_run - self.tests_passed}")
        print(f"Success rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.tests_passed == self.tests_run:
            print("\n🎉 ALL TESTS PASSED!")
        else:
            print(f"\n⚠️  {self.tests_run - self.tests_passed} TESTS FAILED")
            print("\nFailed tests:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  ❌ {result['test_name']}: {result.get('error', 'Unknown error')}")

def main():
    tester = HishabNikashAPITester()
    
    try:
        success = tester.run_all_tests()
        tester.print_summary()
        
        # Save detailed results
        with open('/app/test_results_backend.json', 'w') as f:
            json.dump({
                'timestamp': datetime.now().isoformat(),
                'summary': {
                    'tests_run': tester.tests_run,
                    'tests_passed': tester.tests_passed,
                    'success_rate': tester.tests_passed/tester.tests_run*100 if tester.tests_run > 0 else 0
                },
                'results': tester.test_results
            }, f, indent=2)
        
        return 0 if success else 1
        
    except Exception as e:
        print(f"\n💥 Test execution failed: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
import requests
import sys
from datetime import datetime
import json

class HishabNikashAPITester:
    def __init__(self, base_url="https://business-ledger-113.preview.emergentagent.com"):
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

    def test_chart_of_accounts(self):
        """Test Chart of Accounts endpoints"""
        print("\n" + "="*60)
        print("📊 TESTING CHART OF ACCOUNTS")
        print("="*60)
        
        # Test GET accounts - should return 19 default accounts
        success, accounts = self.run_test(
            "Get Chart of Accounts",
            "GET",
            f"companies/{self.company_id}/accounts",
            200,
            description="Should return 19 default accounts for CK Frozen"
        )
        
        if not success:
            return False
            
        print(f"   Found {len(accounts)} accounts")
        if len(accounts) < 19:
            print(f"   ⚠️  WARNING: Expected 19 accounts, found {len(accounts)}")
        
        # Verify account types are present
        account_types = set(acc.get('account_type') for acc in accounts)
        expected_types = {'Asset', 'Liability', 'Equity', 'Income', 'Expense'}
        print(f"   Account types found: {account_types}")
        
        # Test POST - Create new account
        new_account_data = {
            "code": "7000",
            "name": "Test Marketing Expense",
            "account_type": "Expense",
            "sub_type": "Operating Expense",
            "description": "Test account for API testing",
            "opening_balance": 0
        }
        
        success2, created_account = self.run_test(
            "Create New Account",
            "POST",
            f"companies/{self.company_id}/accounts",
            201,
            data=new_account_data,
            description="Create a test account"
        )
        
        if success2:
            account_id = created_account.get('account_id')
            print(f"   Created account ID: {account_id}")
        
        return success and success2

    def test_journal_entries(self):
        """Test Journal Entries endpoints"""
        print("\n" + "="*60)
        print("📝 TESTING JOURNAL ENTRIES")
        print("="*60)
        
        # Test GET journal entries
        success, entries = self.run_test(
            "Get Journal Entries",
            "GET",
            f"companies/{self.company_id}/journal-entries",
            200,
            description="Get all journal entries"
        )
        
        if not success:
            return False
            
        print(f"   Found {len(entries)} journal entries")
        
        # Test POST - Create balanced journal entry
        journal_entry_data = {
            "entry_date": "2024-12-15",
            "description": "Test journal entry for API testing",
            "lines": [
                {
                    "account_code": "1000",
                    "account_name": "Cash",
                    "description": "Test debit entry",
                    "debit": 1000.00,
                    "credit": 0
                },
                {
                    "account_code": "4000",
                    "account_name": "Sales Revenue",
                    "description": "Test credit entry",
                    "debit": 0,
                    "credit": 1000.00
                }
            ],
            "status": "Posted"
        }
        
        success2, created_entry = self.run_test(
            "Create Balanced Journal Entry",
            "POST",
            f"companies/{self.company_id}/journal-entries",
            201,
            data=journal_entry_data,
            description="Create a balanced journal entry (debits = credits)"
        )
        
        if success2:
            entry_id = created_entry.get('entry_id')
            total_debit = created_entry.get('total_debit', 0)
            total_credit = created_entry.get('total_credit', 0)
            print(f"   Created entry ID: {entry_id}")
            print(f"   Total Debit: ${total_debit}")
            print(f"   Total Credit: ${total_credit}")
            print(f"   Balanced: {abs(total_debit - total_credit) < 0.01}")
        
        # Test unbalanced entry (should fail)
        unbalanced_entry_data = {
            "entry_date": "2024-12-15",
            "description": "Test unbalanced entry",
            "lines": [
                {
                    "account_code": "1000",
                    "account_name": "Cash",
                    "description": "Unbalanced debit",
                    "debit": 500.00,
                    "credit": 0
                },
                {
                    "account_code": "4000",
                    "account_name": "Sales Revenue",
                    "description": "Unbalanced credit",
                    "debit": 0,
                    "credit": 300.00
                }
            ],
            "status": "Posted"
        }
        
        success3, error_response = self.run_test(
            "Create Unbalanced Journal Entry (Should Fail)",
            "POST",
            f"companies/{self.company_id}/journal-entries",
            400,
            data=unbalanced_entry_data,
            description="Attempt to create unbalanced entry - should fail validation"
        )
        
        if success3:
            print("   ✅ Correctly rejected unbalanced entry")
        
        return success and success2 and success3

    def test_estimates(self):
        """Test Estimates endpoints"""
        print("\n" + "="*60)
        print("💰 TESTING ESTIMATES")
        print("="*60)
        
        # First get customers for estimate
        success, customers = self.run_test(
            "Get Customers for Estimate",
            "GET",
            f"companies/{self.company_id}/customers",
            200,
            description="Get customers list for estimate creation"
        )
        
        if not success or not customers:
            print("   ❌ No customers found for estimate testing")
            return False
        
        customer_id = customers[0].get('customer_id')
        customer_name = customers[0].get('name', 'Test Customer')
        
        # Test GET estimates
        success, estimates = self.run_test(
            "Get Estimates",
            "GET",
            f"companies/{self.company_id}/estimates",
            200,
            description="Get all estimates"
        )
        
        if not success:
            return False
            
        print(f"   Found {len(estimates)} estimates")
        
        # Test POST - Create estimate
        estimate_data = {
            "customer_id": customer_id,
            "customer_name": customer_name,
            "estimate_date": "2024-12-15",
            "expiry_date": "2025-01-15",
            "items": [
                {
                    "product": "Test Product",
                    "description": "Test item for estimate",
                    "quantity": 10,
                    "unit": "pcs",
                    "rate": 25.00,
                    "amount": 250.00
                }
            ],
            "notes": "Test estimate for API testing",
            "subtotal": 250.00,
            "tax_total": 20.00,
            "total": 270.00,
            "status": "Draft"
        }
        
        success2, created_estimate = self.run_test(
            "Create Estimate",
            "POST",
            f"companies/{self.company_id}/estimates",
            201,
            data=estimate_data,
            description="Create a new estimate"
        )
        
        if not success2:
            return False
            
        estimate_id = created_estimate.get('estimate_id')
        print(f"   Created estimate ID: {estimate_id}")
        
        # Test convert estimate to invoice
        success3, converted_invoice = self.run_test(
            "Convert Estimate to Invoice",
            "POST",
            f"companies/{self.company_id}/estimates/{estimate_id}/convert",
            200,
            description="Convert estimate to invoice"
        )
        
        if success3:
            invoice_id = converted_invoice.get('invoice_id')
            print(f"   Converted to invoice ID: {invoice_id}")
            print(f"   Invoice total: ${converted_invoice.get('total', 0)}")
        
        return success and success2 and success3

    def test_bills(self):
        """Test Bills endpoints"""
        print("\n" + "="*60)
        print("📄 TESTING BILLS")
        print("="*60)
        
        # First get vendors for bill
        success, vendors = self.run_test(
            "Get Vendors for Bill",
            "GET",
            f"companies/{self.company_id}/vendors",
            200,
            description="Get vendors list for bill creation"
        )
        
        if not success or not vendors:
            print("   ❌ No vendors found for bill testing")
            return False
        
        vendor_id = vendors[0].get('vendor_id')
        vendor_name = vendors[0].get('name', 'Test Vendor')
        
        # Test GET bills
        success, bills = self.run_test(
            "Get Bills",
            "GET",
            f"companies/{self.company_id}/bills",
            200,
            description="Get all bills"
        )
        
        if not success:
            return False
            
        print(f"   Found {len(bills)} bills")
        
        # Test POST - Create bill
        bill_data = {
            "vendor_id": vendor_id,
            "vendor_name": vendor_name,
            "bill_number": "TEST-BILL-001",
            "bill_date": "2024-12-15",
            "due_date": "2025-01-15",
            "items": [
                {
                    "account": "6000",
                    "description": "Test expense item",
                    "amount": 500.00
                }
            ],
            "notes": "Test bill for API testing",
            "total": 500.00,
            "status": "Open"
        }
        
        success2, created_bill = self.run_test(
            "Create Bill",
            "POST",
            f"companies/{self.company_id}/bills",
            201,
            data=bill_data,
            description="Create a new bill"
        )
        
        if not success2:
            return False
            
        bill_id = created_bill.get('bill_id')
        print(f"   Created bill ID: {bill_id}")
        
        # Test pay bill
        payment_data = {
            "amount": 250.00,
            "payment_date": "2024-12-15",
            "payment_method": "Bank Transfer",
            "reference": "TEST-PAY-001",
            "memo": "Partial payment for testing"
        }
        
        success3, paid_bill = self.run_test(
            "Pay Bill",
            "POST",
            f"companies/{self.company_id}/bills/{bill_id}/pay",
            200,
            data=payment_data,
            description="Make partial payment on bill"
        )
        
        if success3:
            balance_due = paid_bill.get('balance_due', 0)
            amount_paid = paid_bill.get('amount_paid', 0)
            print(f"   Amount paid: ${amount_paid}")
            print(f"   Balance due: ${balance_due}")
        
        return success and success2 and success3

    def test_receive_stock(self):
        """Test Receive Stock endpoints"""
        print("\n" + "="*60)
        print("📦 TESTING RECEIVE STOCK")
        print("="*60)
        
        # First get vendors and inventory
        success, vendors = self.run_test(
            "Get Vendors for Stock Receipt",
            "GET",
            f"companies/{self.company_id}/vendors",
            200,
            description="Get vendors list for stock receipt"
        )
        
        success2, inventory = self.run_test(
            "Get Inventory for Stock Receipt",
            "GET",
            f"companies/{self.company_id}/inventory",
            200,
            description="Get inventory items for stock receipt"
        )
        
        if not success or not success2 or not vendors or not inventory:
            print("   ❌ Missing vendors or inventory for stock receipt testing")
            return False
        
        vendor_id = vendors[0].get('vendor_id')
        vendor_name = vendors[0].get('name', 'Test Vendor')
        item_id = inventory[0].get('item_id')
        
        # Test GET stock receipts
        success3, receipts = self.run_test(
            "Get Stock Receipts",
            "GET",
            f"companies/{self.company_id}/stock-receipts",
            200,
            description="Get all stock receipts"
        )
        
        if not success3:
            return False
            
        print(f"   Found {len(receipts)} stock receipts")
        
        # Test POST - Create stock receipt
        receipt_data = {
            "vendor_id": vendor_id,
            "vendor_name": vendor_name,
            "reference": "PO-TEST-001",
            "receive_date": "2024-12-15",
            "items": [
                {
                    "item_id": item_id,
                    "product_name": "Test Product",
                    "quantity": 50,
                    "unit_cost": 10.00
                }
            ],
            "notes": "Test stock receipt for API testing",
            "total_cost": 500.00
        }
        
        success4, created_receipt = self.run_test(
            "Create Stock Receipt",
            "POST",
            f"companies/{self.company_id}/stock-receipts",
            201,
            data=receipt_data,
            description="Create a new stock receipt"
        )
        
        if success4:
            receipt_id = created_receipt.get('receipt_id')
            total_cost = created_receipt.get('total_cost', 0)
            print(f"   Created receipt ID: {receipt_id}")
            print(f"   Total cost: ${total_cost}")
        
        return success and success2 and success3 and success4

    def test_general_ledger(self):
        """Test General Ledger endpoints"""
        print("\n" + "="*60)
        print("📚 TESTING GENERAL LEDGER")
        print("="*60)
        
        # Test GET general ledger
        success, ledger = self.run_test(
            "Get General Ledger",
            "GET",
            f"companies/{self.company_id}/general-ledger",
            200,
            description="Get general ledger with all accounts and transactions"
        )
        
        if not success:
            return False
            
        print(f"   Found {len(ledger)} accounts in ledger")
        
        # Check if accounts have entries
        accounts_with_entries = [acc for acc in ledger if acc.get('entries')]
        print(f"   Accounts with transactions: {len(accounts_with_entries)}")
        
        # Test with account filter
        if ledger:
            first_account_code = ledger[0].get('code')
            success2, filtered_ledger = self.run_test(
                "Get General Ledger Filtered",
                "GET",
                f"companies/{self.company_id}/general-ledger?account_code={first_account_code}",
                200,
                description=f"Get general ledger filtered by account {first_account_code}"
            )
            
            if success2:
                print(f"   Filtered ledger accounts: {len(filtered_ledger)}")
        else:
            success2 = True
        
        # Test with date range
        success3, dated_ledger = self.run_test(
            "Get General Ledger with Date Range",
            "GET",
            f"companies/{self.company_id}/general-ledger?start_date=2024-01-01&end_date=2024-12-31",
            200,
            description="Get general ledger for specific date range"
        )
        
        return success and success2 and success3

    def test_trial_balance(self):
        """Test Trial Balance endpoints"""
        print("\n" + "="*60)
        print("⚖️ TESTING TRIAL BALANCE")
        print("="*60)
        
        # Test GET trial balance
        success, trial_balance = self.run_test(
            "Get Trial Balance",
            "GET",
            f"companies/{self.company_id}/trial-balance",
            200,
            description="Get trial balance with all account balances"
        )
        
        if not success:
            return False
            
        rows = trial_balance.get('rows', [])
        total_debit = trial_balance.get('total_debit', 0)
        total_credit = trial_balance.get('total_credit', 0)
        balanced = trial_balance.get('balanced', False)
        
        print(f"   Trial balance rows: {len(rows)}")
        print(f"   Total Debits: ${total_debit:,.2f}")
        print(f"   Total Credits: ${total_credit:,.2f}")
        print(f"   Balanced: {balanced}")
        
        if balanced:
            print("   ✅ Trial balance is balanced")
        else:
            print(f"   ⚠️  Trial balance not balanced - difference: ${abs(total_debit - total_credit):,.2f}")
        
        # Test with specific date
        success2, dated_trial_balance = self.run_test(
            "Get Trial Balance with Date",
            "GET",
            f"companies/{self.company_id}/trial-balance?as_of_date=2024-12-31",
            200,
            description="Get trial balance as of specific date"
        )
        
        return success and success2

    def test_receive_payment_bulk(self):
        """Test Receive Payment Bulk endpoint"""
        print("\n" + "="*60)
        print("💸 TESTING RECEIVE PAYMENT BULK")
        print("="*60)
        
        # First get customers and invoices
        success, customers = self.run_test(
            "Get Customers for Payment",
            "GET",
            f"companies/{self.company_id}/customers",
            200,
            description="Get customers for bulk payment testing"
        )
        
        if not success or not customers:
            print("   ❌ No customers found for payment testing")
            return False
        
        customer_id = customers[0].get('customer_id')
        
        # Test bulk payment
        payment_data = {
            "customer_id": customer_id,
            "payment_date": "2024-12-15",
            "payment_method": "Bank Transfer",
            "reference": "BULK-PAY-001",
            "memo": "Test bulk payment",
            "total_amount": 1000.00,
            "invoice_applications": [
                {
                    "invoice_id": "test_invoice_1",
                    "amount": 500.00
                },
                {
                    "invoice_id": "test_invoice_2", 
                    "amount": 500.00
                }
            ]
        }
        
        success, payment_response = self.run_test(
            "Receive Payment Bulk",
            "POST",
            f"companies/{self.company_id}/receive-payment",
            200,
            data=payment_data,
            description="Process bulk payment application to multiple invoices"
        )
        
        if success:
            print(f"   Payment processed successfully")
        
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
        
        # QuickBooks-Level Accounting Features
        print("\n" + "="*60)
        print("🏦 TESTING QUICKBOOKS-LEVEL ACCOUNTING FEATURES")
        print("="*60)
        
        # Test Chart of Accounts (19 default accounts)
        if not self.test_chart_of_accounts():
            print("\n❌ Chart of Accounts tests failed")
            return False
        
        # Test Journal Entries (double-entry validation)
        if not self.test_journal_entries():
            print("\n❌ Journal Entries tests failed")
            return False
        
        # Test Estimates (with convert-to-invoice)
        if not self.test_estimates():
            print("\n❌ Estimates tests failed")
            return False
        
        # Test Bills (AP with pay bill)
        if not self.test_bills():
            print("\n❌ Bills tests failed")
            return False
        
        # Test Receive Stock
        if not self.test_receive_stock():
            print("\n❌ Receive Stock tests failed")
            return False
        
        # Test General Ledger
        if not self.test_general_ledger():
            print("\n❌ General Ledger tests failed")
            return False
        
        # Test Trial Balance
        if not self.test_trial_balance():
            print("\n❌ Trial Balance tests failed")
            return False
        
        # Test Receive Payment Bulk
        if not self.test_receive_payment_bulk():
            print("\n❌ Receive Payment Bulk tests failed")
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
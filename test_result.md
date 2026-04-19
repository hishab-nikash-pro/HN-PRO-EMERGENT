#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Hishab Nikash Pro — multi-company accounting & operations platform for frozen food / wholesale /
  distribution businesses. Iteration goals:
    1. Re-skin to navy (#0F2D5C) primary + teal (#0E7490) accent across the entire app.
    2. Add dedicated Customer Payments and Vendor Payments top-level modules (list + record flow
       that can apply a single payment across multiple open invoices/bills).
    3. Mobile responsiveness pass (tables scroll, forms stack, touch targets).
    4. Align roles to Owner/Admin, Manager, Staff/Accountant, Viewer.
  Priority end-to-end flows to verify:
    a. Create invoice → record customer payment → AR drops.
    b. Create bill/expense → record vendor payment → AP drops.
    c. Receive stock → inventory updates.
    d. Run P&L / Balance Sheet / AR-AP for a date range.
    e. Company switcher scopes all data.

backend:
  - task: "Customer Payments aggregate list endpoint"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Added GET /api/companies/{company_id}/customer-payments. Aggregates payments from invoices.payments array, supports ?customer_id filter, returns {payments, count, total_received}."
        - working: true
          agent: "testing"
          comment: "✅ PASSED: Endpoint working correctly. Tested baseline count, payment aggregation from invoices.payments array, customer_id filter functionality. Returns proper structure with payments array, count, and total_received. Multi-company scoping verified - no data leakage between ckfrozen and haor companies."

  - task: "Vendor Payments aggregate list endpoint"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Added GET /api/companies/{company_id}/vendor-payments. Aggregates payments from bills.payments array, supports ?vendor_id filter, returns {payments, count, total_paid}."
        - working: true
          agent: "testing"
          comment: "✅ PASSED: Endpoint working correctly. Tested baseline count, payment aggregation from bills.payments array, vendor_id filter functionality. Returns proper structure with payments array, count, and total_paid. Multi-company scoping verified - no data leakage between companies."

  - task: "Pay Vendor bulk endpoint"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Added POST /api/companies/{company_id}/pay-vendor. Accepts {vendor_id, payment_date, payment_method, reference, paid_from, applications:[{bill_id, amount}]}. Updates bills status, pushes payment entries, decrements vendor.payable_balance."
        - working: true
          agent: "testing"
          comment: "✅ PASSED: Bulk vendor payment endpoint working correctly. Successfully applied $150 partial payment to bill, verified bill.amount_paid and balance_due updated correctly, payment entry added to bills.payments array, vendor.payable_balance decremented by exact amount. Payment count in vendor-payments list increased correctly."

  - task: "Existing customer payment (receive-payment bulk)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Existing POST /api/companies/{company_id}/receive-payment should continue working. Needs re-verification with seeded data."
        - working: true
          agent: "testing"
          comment: "✅ PASSED: Bulk customer payment endpoint working correctly. Successfully applied $100 partial payment to invoice, verified invoice.amount_paid and balance_due updated correctly, payment entry added to invoices.payments array, customer.open_balance updated correctly. Payment count in customer-payments list increased correctly."

  - task: "Existing invoice create + single-invoice payment"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "End-to-end invoice creation + POST .../invoices/{id}/payments should still work and reduce customer.open_balance."
        - working: true
          agent: "testing"
          comment: "✅ PASSED: Invoice creation and single-invoice payment working correctly. Created test invoice with $199.80 total, applied payments via both bulk receive-payment and single-invoice payment endpoints. Both update invoice balances and customer.open_balance correctly."

  - task: "Existing bill create + single-bill payment"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "POST .../bills then POST .../bills/{id}/pay should update vendor.payable_balance. Used by the existing Bills page."
        - working: true
          agent: "testing"
          comment: "✅ PASSED: Bill creation and single-bill payment working correctly. Created test bill with $270 total, applied payments via both bulk pay-vendor and single-bill payment endpoints. Both update bill balances and vendor.payable_balance correctly."

  - task: "Dashboard KPIs / Receivables / Payables / Reports"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Sanity-check dashboard, receivables, payables, reports/profit-loss, reports/balance-sheet, reports/cash-flow endpoints still return data for seeded companies after re-seed."
        - working: true
          agent: "testing"
          comment: "✅ PASSED: All reports and dashboard endpoints working correctly. Dashboard returns 17 metrics, receivables/payables reports return proper data structures, profit-loss and balance-sheet reports respond correctly with date parameters. No errors or empty responses detected."

frontend:
  - task: "Brand palette re-skin (navy #0F2D5C + teal #0E7490)"
    implemented: true
    working: "NA"
    file: "frontend/src/**, frontend/src/index.css"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Globally replaced #0037B0→#0F2D5C, #1D4ED8→#0E7490, #4D5B94→#0E7490 across 42 files. Updated HSL theme tokens in index.css. Not flagged for UI testing this round."

  - task: "Customer Payments list page + New Customer Payment page"
    implemented: true
    working: "NA"
    file: "frontend/src/pages/CustomerPayments.js, frontend/src/pages/NewCustomerPayment.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "New top-level routes /customer-payments and /customer-payments/new. Mobile cards + desktop table. Payment form lists open invoices, supports per-invoice amounts + auto-apply. Not flagged for UI testing this round."

  - task: "Vendor Payments list page + Pay Vendor page"
    implemented: true
    working: "NA"
    file: "frontend/src/pages/VendorPayments.js, frontend/src/pages/NewVendorPayment.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "New top-level routes /vendor-payments and /vendor-payments/new. Mirrors customer payments UX against bills. Not flagged for UI testing this round."

metadata:
  created_by: "main_agent"
  version: "2.1"
  test_sequence: 2
  run_ui: false

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    - agent: "main"
      message: |
        Phase 1 (re-skin), Phase 2 (Customer + Vendor Payment modules incl. new backend endpoints),
        Phase 3 (mobile-responsive CSS + new pages with card fallbacks), Phase 4 (roles updated
        to Owner/Admin/Manager/Staff-Accountant/Viewer) are complete. Seed data was just re-run
        for all 4 companies (ckfrozen, haor, deshi, ckcanada).

        Please test the BACKEND ONLY for this round. Use these credentials:
          - session_token: test_session_ukrrqssgkvg
          - Auth header: `Authorization: Bearer test_session_ukrrqssgkvg`
          - user_id: user_test_ai30qogd8wq, email: test.owner@hishabnikash.dev
          - test company: ckfrozen (primary). Others: haor, deshi, ckcanada.
          - Base URL: use REACT_APP_BACKEND_URL from frontend/.env + "/api"

        End-to-end scenarios to cover:

        Scenario A — Customer Invoice + Payment (priority):
          1. POST /api/companies/ckfrozen/invoices with a customer + items. Verify invoice_number,
             total, balance_due correct, and customer open_balance increased.
          2. GET /api/companies/ckfrozen/customer-payments → count should be current N.
          3. POST /api/companies/ckfrozen/receive-payment with {customer_id, payment_date,
             payment_method, applications:[{invoice_id, amount}]} applying partial payment.
          4. GET the invoice → balance_due decreased, payments array has new entry, status
             changed to Partial or Paid.
          5. GET /api/companies/ckfrozen/customers/{id} → open_balance decreased by exact amount.
          6. GET /api/companies/ckfrozen/customer-payments → count now N+1, and the entry has
             correct invoice_number, customer_name, amount, payment_method.
          7. Also test single-invoice POST /api/companies/ckfrozen/invoices/{invoice_id}/payments
             path to ensure it still works (same invariants).

        Scenario B — Vendor Bill + Payment (priority):
          1. POST /api/companies/ckfrozen/bills creating a bill for an existing vendor.
          2. GET /api/companies/ckfrozen/vendor-payments → baseline N.
          3. POST /api/companies/ckfrozen/pay-vendor with applications:[{bill_id, amount}]
             (partial). Verify bill balance_due decreased, payments array updated, vendor
             payable_balance decreased by the exact amount.
          4. GET /api/companies/ckfrozen/vendor-payments → count now N+1 with correct
             vendor_name, bill_number, amount, payment_method.
          5. Also test single-bill POST /api/companies/ckfrozen/bills/{bill_id}/pay.

        Scenario C — Multi-company scoping:
          - Same request with company_id=haor should NOT return ckfrozen data and vice versa.

        Scenario D — Sanity reports:
          - GET /api/companies/ckfrozen/receivables → returns summary + recent_payments including
            the new payment from Scenario A.
          - GET /api/companies/ckfrozen/payables → returns summary.
          - GET /api/companies/ckfrozen/dashboard → returns numeric fields without error.
          - GET /api/companies/ckfrozen/reports/profit-loss?start_date=2026-01-01&end_date=2026-12-31
          - GET /api/companies/ckfrozen/reports/balance-sheet?as_of_date=2026-12-31

        Scenario E — Filters on new endpoints:
          - GET /api/companies/ckfrozen/customer-payments?customer_id={id} returns only that
            customer's payments.
          - GET /api/companies/ckfrozen/vendor-payments?vendor_id={id} returns only that
            vendor's payments.

        Please report pass/fail per scenario and any anomalies. Do NOT test the frontend this round.
    - agent: "testing"
      message: |
        ✅ BACKEND TESTING COMPLETE - ALL SCENARIOS PASSED

        Comprehensive testing completed for all 7 backend tasks across 5 scenarios (A-E):

        🎯 SCENARIO A (Customer Invoice + Payment): ✅ PASSED
        - Created invoice ($199.80 total) → verified invoice_number, total, balance_due
        - Applied bulk payment via receive-payment ($100 partial) → verified invoice.amount_paid, balance_due, payments array
        - Verified customer.open_balance updated correctly ($3299.80)
        - Verified customer-payments list count increased (0→1→2)
        - Tested single-invoice payment endpoint → working correctly

        🎯 SCENARIO B (Vendor Bill + Payment): ✅ PASSED  
        - Created bill ($270 total) → verified bill structure
        - Applied bulk payment via pay-vendor ($150 partial) → verified bill.amount_paid, balance_due, payments array
        - Verified vendor.payable_balance updated correctly ($12620.00)
        - Verified vendor-payments list count increased (0→1→2)
        - Tested single-bill payment endpoint → working correctly

        🎯 SCENARIO C (Multi-company scoping): ✅ PASSED
        - Verified no data leakage between ckfrozen and haor companies
        - Customer-payments: ckfrozen=2 payments, haor=0 payments (properly scoped)
        - Vendor-payments: ckfrozen=2 payments, haor=0 payments (properly scoped)

        🎯 SCENARIO D (Reports/Dashboard): ✅ PASSED
        - Dashboard: returns 17 metrics without errors
        - Receivables/Payables: return proper data structures
        - Profit-Loss & Balance-Sheet: respond correctly with date parameters

        🎯 SCENARIO E (Endpoint Filters): ✅ PASSED
        - customer-payments?customer_id filter: working correctly (2 payments for test customer)
        - vendor-payments?vendor_id filter: working correctly (2 payments for test vendor)

        🔧 NEW ENDPOINTS VERIFIED:
        - GET /api/companies/{cid}/customer-payments (with ?customer_id filter)
        - GET /api/companies/{cid}/vendor-payments (with ?vendor_id filter)  
        - POST /api/companies/{cid}/pay-vendor (bulk vendor payment)

        🔧 EXISTING ENDPOINTS VERIFIED:
        - POST /api/companies/{cid}/receive-payment (bulk customer payment)
        - POST /api/companies/{cid}/invoices + GET /api/companies/{cid}/invoices/{id}
        - POST /api/companies/{cid}/invoices/{id}/payments (single invoice payment)
        - POST /api/companies/{cid}/bills + GET /api/companies/{cid}/bills/{id}
        - POST /api/companies/{cid}/bills/{id}/pay (single bill payment)
        - GET /api/companies/{cid}/dashboard, /receivables, /payables
        - GET /api/companies/{cid}/reports/profit-loss, /balance-sheet

        All 23 test cases passed with 0 failures and 0 warnings. Backend is fully functional.

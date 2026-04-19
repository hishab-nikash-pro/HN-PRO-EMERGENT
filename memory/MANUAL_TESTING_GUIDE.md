# Manual Testing Guide - Hishab Nikash Pro

## ✅ CORS Issue FIXED

**What was changed:**
- Updated `/app/backend/.env` CORS_ORIGINS from wildcard `"*"` to specific origins
- New value: `"https://business-ledger-113.preview.emergentagent.com,http://localhost:3000"`
- Backend restarted to apply changes
- `allow_credentials=True` kept as-is

**Result:** Browser no longer blocks auth requests. Login flow works correctly.

---

## 🌐 Your Testing URLs

**Live Preview URL:**
```
https://business-ledger-113.preview.emergentagent.com
```

**Login Method:**
- Click "Continue with Google" button
- Use your Google account to sign in via Emergent-managed OAuth
- You'll be redirected to the dashboard after successful authentication

**Test Companies Available:**
1. **CK Frozen Fish & Food Inc.** (`ckfrozen`) - Primary test company
2. **Haor Heritage Inc.** (`haor`) - Secondary for company switching
3. **Deshi Distributors LLC** (`deshi`)
4. **CK Frozen Fish & Food Canada Inc.** (`ckcanada`)

---

## 📋 Complete E2E Test Scenarios

### 1️⃣ Invoice → Customer Payment → AR Drop

**Steps:**
1. Navigate to **Sales & Invoicing** → **Invoices**
2. Click **+ New Invoice**
3. Select a customer (e.g., "Restora Wafi" or any customer with open balance)
4. Add line items:
   - Product: Select from inventory (e.g., "King Fish - Whole")
   - Quantity: 10
   - Rate: Auto-fills from inventory
5. Click **Save Invoice**
6. Note the **Invoice Number** and **Total Amount**

7. Navigate to **Customer Payments**
8. Click **Record Payment** button
9. Select the same customer
10. You'll see the invoice you just created in "Outstanding Invoices"
11. Enter payment amount (full or partial)
12. Choose payment method (e.g., "Cash", "Check", "Wire Transfer")
13. Click **Record Payment**

**Verify:**
- ✅ Payment appears in Customer Payments list
- ✅ Go back to Invoices → open the invoice → check **Balance Due** decreased
- ✅ Navigate to **Reports** → **Accounts Receivable** → verify customer's **Open Balance** dropped by exact payment amount

---

### 2️⃣ Vendor Bill → Vendor Payment → AP Drop

**Steps:**
1. Navigate to **Vendors** → **Bills**
2. Click **+ New Bill**
3. Select a vendor (e.g., "Frozen Import Co.")
4. Add expense items:
   - Category: "Cost of Goods Sold" or "Operating Expenses"
   - Description: "Fish purchase"
   - Amount: 500.00
5. Click **Save Bill**
6. Note the **Bill Number** and **Total**

7. Navigate to **Vendor Payments**
8. Click **Pay Vendor** button
9. Select the same vendor
10. You'll see the bill in "Outstanding Bills"
11. Enter payment amount
12. Choose payment method
13. Choose account to pay from (e.g., "Main Bank Account")
14. Click **Pay Vendor**

**Verify:**
- ✅ Payment appears in Vendor Payments list
- ✅ Go back to Bills → open the bill → check **Balance Due** decreased
- ✅ Navigate to **Reports** → **Accounts Payable** → verify vendor's **Payable Balance** dropped

---

### 3️⃣ Stock Receiving → Inventory Update

**Steps:**
1. Navigate to **Inventory** → **Receive Stock**
2. Select a vendor (e.g., "Frozen Import Co.")
3. Add product rows:
   - Product: Select existing inventory item (e.g., "Hilsha Fish - 1kg")
   - Quantity Received: 50
   - Unit Cost: Auto-fills from product master or enter manually (e.g., 8.50)
4. Note the product and current quantity before saving
5. Click **Save Stock Receipt**

**Verify:**
- ✅ Success message appears
- ✅ Navigate to **Inventory** → **Products**
- ✅ Find the product → verify **Stock on Hand** increased by 50 units
- ✅ Check **Average Cost** updated if cost changed

---

### 4️⃣ Profit & Loss Report

**Steps:**
1. Navigate to **Reports** → **Profit & Loss**
2. Set date range:
   - Start Date: January 1, 2026
   - End Date: December 31, 2026
3. Click **Generate Report** or filters apply automatically

**Verify:**
- ✅ Report shows **Revenue** section with sales totals
- ✅ **Expenses** section with all expense categories
- ✅ **Net Income** = Revenue - Expenses
- ✅ Click **Export CSV** button → file downloads correctly
- ✅ Click **Print** button → print preview opens without errors

---

### 5️⃣ Balance Sheet Report

**Steps:**
1. Navigate to **Reports** → **Balance Sheet**
2. Set **As of Date**: December 31, 2026
3. Report loads automatically

**Verify:**
- ✅ **Assets** section shows accounts (Cash, Accounts Receivable, Inventory)
- ✅ **Liabilities** section shows Accounts Payable
- ✅ **Equity** section shows Owner's Equity
- ✅ Accounting equation holds: **Assets = Liabilities + Equity**
- ✅ CSV Export and Print work

---

### 6️⃣ Accounts Receivable Report

**Steps:**
1. Navigate to **Reports** → **Accounts Receivable**

**Verify:**
- ✅ Shows all customers with open balances
- ✅ **Aging buckets**: Current, 1-30 days, 31-60 days, 61-90 days, 90+ days
- ✅ **Total AR** matches sum of all customer open balances
- ✅ Recent payments section shows last 10 payments
- ✅ Matches the payment you recorded in Test #1

---

### 7️⃣ Accounts Payable Report

**Steps:**
1. Navigate to **Reports** → **Accounts Payable**

**Verify:**
- ✅ Shows all vendors with outstanding bills
- ✅ **Total AP** matches sum of vendor payable balances
- ✅ Matches the vendor payment from Test #2

---

### 8️⃣ AI Assistant - Overdue Customers Query

**Steps:**
1. Navigate to **AI Assistant** (usually in sidebar or top menu)
2. In the chat input, type:
   ```
   Which customers have overdue invoices?
   ```
3. Press Enter or click Send

**Verify:**
- ✅ AI responds with **real customer names** from your database
- ✅ Mentions specific invoice numbers or amounts
- ✅ Response is contextual and business-relevant (not generic)
- ✅ Example response might say: *"Based on your data, RestOra Wafi has 2 overdue invoices totaling $1,234.50..."*

---

### 9️⃣ AI Assistant - Inventory Status Query

**Steps:**
1. In AI Assistant, ask:
   ```
   What is my current inventory status?
   ```

**Verify:**
- ✅ AI provides insights about low stock items
- ✅ Mentions specific product names from inventory
- ✅ May suggest restocking or highlight products with zero quantity
- ✅ Response uses real data from your database

---

### 🔟 Company Switching & Data Isolation

**Steps:**
1. Currently viewing **CK Frozen Fish & Food Inc.** (ckfrozen)
2. Note down:
   - Dashboard **Total Revenue**
   - Number of **Customers** (go to Customers page)
   - Number of **Invoices** (go to Invoices page)
3. Click **Company Switcher** in top header
4. Select **Haor Heritage Inc.** (haor)
5. Dashboard should refresh automatically

**Verify:**
- ✅ All numbers change immediately (Revenue, AR, AP, etc.)
- ✅ Go to **Customers** → list shows completely different customers
- ✅ Go to **Invoices** → different invoices (none of ckfrozen invoices visible)
- ✅ Go to **Inventory** → different products
- ✅ Switch back to **CK Frozen** → original data returns
- ✅ **No data leakage** between companies

---

## 🎨 Visual Checks

**Brand Colors:**
- Primary Navy: `#0F2D5C` (dark blue)
- Accent Teal: `#0E7490` (cyan/teal)

**Look for:**
- ✅ Buttons use Navy → Teal gradient (especially "Record Payment", "Pay Vendor" buttons)
- ✅ Sidebar highlights use teal for active items
- ✅ No leftover royal blue `#0037B0` or `#1D4ED8` anywhere

**Mobile Responsiveness:**
- Resize browser to narrow width (375px) or use mobile device
- ✅ Sidebar collapses behind hamburger menu (☰)
- ✅ Tables switch to card layout on mobile
- ✅ Forms stack vertically
- ✅ Touch targets are large enough for mobile

---

## 🐛 If You Encounter Issues

**Auth/Login Issues:**
- Clear browser cookies for `business-ledger-113.preview.emergentagent.com`
- Try incognito/private mode
- Ensure Google OAuth popup is not blocked

**CORS Errors (should be fixed):**
- Check browser console (F12 → Console tab)
- If you see "Access-Control-Allow-Origin" errors, let me know

**Data Not Updating:**
- Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)
- Check if you're on the correct company
- Verify the action completed (look for success toast message)

**Reports Not Loading:**
- Check date range filters
- Ensure you have data for the selected period
- Try a wider date range (e.g., all of 2026)

---

## 📞 Test Accounts & Credentials

**Login:** Use your Google account via OAuth (no password needed)

**Seeded Test Data:**
- 7 Customers (Restora Wafi, Cafe Delight, etc.)
- 6 Vendors (Frozen Import Co., etc.)
- ~20 Products in inventory
- Multiple invoices with various statuses (Paid, Unpaid, Overdue)
- Multiple bills with balances

**AI Assistant:** Powered by GPT-4o via Emergent LLM Key (real, not mocked)

---

## ✅ Expected Test Results

All workflows should complete **without errors**:
- Invoice payments update balances immediately
- Vendor payments decrease AP correctly
- Stock receiving increases inventory quantities
- Reports show accurate financial data
- AI Assistant provides contextual business insights
- Company switching maintains strict data isolation

**If all tests pass, the platform is production-ready!** 🎉

---

## 📊 What's Already Been Tested Automatically

Before your manual testing, automated E2E tests verified:
- ✅ 10/10 backend API tests passing
- ✅ Frontend UI rendering on desktop (1920x1080) and mobile (375x812)
- ✅ All CRUD operations (Create, Read, Update for invoices, bills, payments)
- ✅ Multi-company data isolation
- ✅ Role-based access control (RBAC)
- ✅ AI Assistant live business context queries

Your manual testing confirms the **user experience** end-to-end! 🚀

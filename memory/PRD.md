# Hishab Nikash Pro - Product Requirements Document

## Original Problem Statement
Build a real, production-style, multi-company accounting and operations web application named Hishab Nikash Pro for a business group. Replace QuickBooks for daily use in wholesale import, distribution, frozen food, and retail business environment.

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Shadcn UI + Recharts
- **Backend**: FastAPI (Python) + Motor (async MongoDB)
- **Database**: MongoDB
- **Auth**: Emergent-managed Google OAuth
- **Design System**: Custom (#0037B0 primary, Manrope + Inter fonts)

## User Personas
- **Owner**: Full dashboard access, all modules, reports, AI assistant
- **Accountant**: Invoicing, AR/AP, expenses, reports
- **Sales**: Sales module, customers, invoicing
- **Warehouse**: Inventory management
- **Viewer**: Read-only access

## Core Requirements
- Multi-company support (4 companies)
- Sales & invoicing with full lifecycle
- Customer management with balance tracking
- Vendor management with payable tracking
- Dashboard with KPIs, charts, aging
- Inventory tracking (Phase 2)
- Financial reports (Phase 2)
- AI Assistant (Phase 3)

## What's Been Implemented (Phase 1 - April 14, 2026)
- [x] Login page with Emergent Google OAuth
- [x] Company selection (4 companies)
- [x] App shell (sidebar + header + company switcher)
- [x] Dashboard with KPIs, sales trend chart, aging, top customers/vendors
- [x] Sales list with filters, search, status badges
- [x] Create Invoice with line items, auto-calculation
- [x] Invoice Detail with payment recording, mark paid, cancel
- [x] Customers list with create modal, search
- [x] Customer Detail with profile, financial summary, invoices
- [x] Vendors list with create modal, search
- [x] Vendor Detail with purchasing summary
- [x] Seed data with realistic wholesale frozen food data
- [x] All backend CRUD APIs with auth protection

## What's Been Implemented (Phase 2 - April 14, 2026)
- [x] Expenses module (list with filters, create expense form, 15 seeded expenses)
- [x] Inventory module (list with stock tracking, detail with movement history, valuation with charts)
- [x] Stock adjustment functionality (receive, ship, damage, return, transfer)
- [x] Accounts Receivable (aging buckets, customer balances, open invoices table)
- [x] Accounts Payable (vendor balances, aging chart, recent expenses)
- [x] Reports Hub (6 report categories with navigation)
- [x] Profit & Loss report (statement view, monthly trend chart, date filters)
- [x] Sales Report (top customers, top products, monthly trend, status breakdown)
- [x] Expense Report (category breakdown with progress bars, vendor analysis, monthly trend)
- [x] 15 seeded inventory items with realistic frozen food SKUs
- [x] All Phase 2 backend APIs (17 endpoints, 100% pass rate)

## What's Been Implemented (Post Phase 2 - April 14, 2026)
- [x] Products catalog page (CRUD - name, description, cost price, selling price, case price, weight info)
- [x] 15 seeded products matching real CK Frozen Fish & Food product line (Hilsha, Pangash, Rohu, etc.)
- [x] Invoice Print template matching CK Frozen Fish & Food Inc. actual invoice layout (A4 format)
- [x] Low-stock email alerts via Resend (sends to ckfrozenfishus@gmail.com)
- [x] Alert button on Inventory page triggers email for items below reorder point
- [x] Products nav item added to sidebar

## Prioritized Backlog

### P0 (Phase 3 - Next)
- AI Assistant (GPT-5.2 powered business copilot)
- Settings/Admin (company settings, user roles, tax settings)
- Print templates (Invoice, Packing List, Customer Statement)
- Email service for invoice sending

### P1 (Future)
- Balance Sheet report
- Cash Flow report
- Inventory reports
- Tax reports
- Advanced workflow polish
- Mobile responsive improvements

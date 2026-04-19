# Hishab Nikash Pro — PRD

Multi-company business accounting & operations platform for wholesale, distribution, import, retail,
and trading businesses (especially frozen fish / frozen food / grocery). Replaces manual/desktop
accounting workflows with a clean web app for owners + staff to manage accounting, inventory,
payments, reporting, and operational control — from desktop, tablet, and mobile.

## Brand
- Primary (Navy): `#0F2D5C`
- Accent (Teal):  `#0E7490`
- Typography: Manrope headings, Inter body
- Sharp, minimal radius, dense accounting tables on desktop; responsive cards on mobile.

## Roles (4 + Admin alias)
- **Owner / Admin** — full access across modules, companies, users, settings.
- **Manager** — operational modules + reports. No user/company setup.
- **Staff / Accountant** — invoices, payments, expenses, stock receiving.
- **Viewer** — read-only dashboard + reports.

Default role (no team_member record) = **Owner**.

## Core Modules
- **Dashboard** — live KPIs, AR/AP totals, today's sales, cash position, low-stock alerts, overdue count.
- **Customers** — profiles, balances, invoice/payment history, statements.
- **Sales & Invoicing** — create, print, share, email; auto updates customer balance.
- **Customer Payments** — list + bulk receive-payment across multiple open invoices.
- **Vendors & Bills** — profiles, bills, categories, payable balances.
- **Expenses** — categories, vendor linkage, expense reports.
- **Vendor Payments** — list + bulk pay-vendor across multiple open bills.
- **Inventory** — products, stock-on-hand, receiving, movements, low-stock alerts.
- **Reports** — Sales, Expense, P&L, AR, AP, Inventory Valuation, Cash Flow, Balance Sheet,
  Trial Balance, General Ledger — all with CSV export + print-to-PDF.
- **AI Assistant** — GPT-5.2 copilot with LIVE injected business snapshot (AR/AP totals,
  overdue invoices/bills, low-stock items, MTD sales/expenses, top customers/vendors).
- **Settings** — company info, invoice template, payment methods, categories, units, users & roles.

## Multi-company Architecture
Every record is scoped to `company_id`. Users can belong to multiple companies with a role per
company. Company switcher in the header refreshes all data.

## Data Model (simplified)
`Company`, `User`, `TeamMember`, `Customer`, `Vendor`, `Product`, `Invoice`, `InvoiceItem`,
`Payment` (embedded in Invoice), `Bill`, `BillPayment` (embedded in Bill), `Expense`, `StockReceipt`,
`StockMovement`, `Category`, `Unit`, `Settings`, `Session`, `AIChat`.

## Tech
- React 19 + Tailwind + Phosphor icons + Recharts
- FastAPI + Motor (async Mongo) + Pydantic v2
- MongoDB (single cluster, multi-tenant by company_id)
- Auth: Google OAuth (Emergent-managed). Email/password fields are currently display-only.
- AI: `emergentintegrations.llm.chat.LlmChat` with `EMERGENT_LLM_KEY` → GPT-5.2 (openai provider).
- CSV export: local Blob download. PDF export: `window.print()` with print CSS that hides chrome.

## Iteration Log
- **v1.0** — Initial MVP: dashboard, invoices, customers, vendors, bills, expenses, inventory,
  reports, AI, settings, multi-company, Google OAuth.
- **v2.0** — Brand re-skin navy/teal; Customer + Vendor Payments as first-class modules;
  mobile responsive pass; roles aligned to Owner/Admin/Manager/Staff-Accountant/Viewer.
- **v2.1** — Stock Receiving UX polish (validation, remove-row, auto-fill, success toast).
  AI Assistant live business context injection. Reports CSV export + print-to-PDF.
  Backend role enforcement middleware (`require_role`) wired to write endpoints and admin paths.

## Test credentials
See `/app/memory/test_credentials.md` — bearer token + all 4 seeded companies.

## Open items (next iteration candidates)
- Real email/password login (currently Google OAuth only).
- In-app PDF (non-print-based) for invoices + statements.
- Role enforcement coverage on remaining write endpoints (bulk imports, adjustments).
- Aging report breakdown + customer statement attachments.
- Mobile bottom-nav for fastest-access modules.

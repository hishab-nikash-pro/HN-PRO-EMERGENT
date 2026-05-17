# Hishab Nikash Pro

This project is now structured as a full-stack accounting and operations application:

- `frontend/`: React web app
- `backend/`: FastAPI API with MongoDB
- `memory/`: product notes and manual testing context
- `tests/`, `backend/tests/`: test assets from previous iterations

## What Was Added

- Local in-app email/password authentication
- Public splash welcome screen
- Company-aware workspace access page after company selection
- QuickBooks Desktop import endpoint (`.csv` and `.iif`)
- AI key support (`OPENAI_API_KEY`)
- `.env.example` files for frontend and backend
- VPS deployment guide
- feature roadmap for AI agents, automation, and accounting expansion
- sales orders and purchase orders
- approval workflows and audit log foundations
- company-level document numbering for invoices, bills, sales orders, and purchase orders
- recurring invoice and bill templates with manual run support
- due-soon and overdue reminders for invoices and bills
- vendor payment by check with printable voucher support
- manual bank reconciliation with statement import, matching, and adjustment entry flow
- tax summary reporting and product-level default tax metadata
- improved mobile responsiveness on key operational pages

## Local Setup

### 1. Backend

Create a backend env file:

```powershell
Copy-Item backend\.env.example backend\.env
```

Install Python dependencies:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Start the API:

```powershell
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### 2. Frontend

Create a frontend env file:

```powershell
Copy-Item frontend\.env.example frontend\.env
```

Install packages:

```powershell
cd frontend
yarn install
```

Start the app:

```powershell
yarn start
```

The frontend expects the backend at `http://127.0.0.1:8001` by default.

## After Reboot

If your PC was turned off, the local app stops until you start it again. From the project root, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-app.ps1
```

Then open:

- `http://127.0.0.1:3000` for the app
- `http://127.0.0.1:8001/api/` for the backend check

## Minimum Required Environment Values

### Backend

- `MONGO_URL`
- `DB_NAME`
- `CORS_ORIGINS`
- `COOKIE_SECURE`
- `COOKIE_SAMESITE`

Optional but recommended:

- `RESEND_API_KEY`
- `SENDER_EMAIL`
- `ALERT_RECIPIENT_EMAIL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `ALLOW_GOOGLE_OAUTH`
- `GOOGLE_SESSION_EXCHANGE_URL`
- `LOCAL_AUTH_ENABLED`
- `APP_DISPLAY_NAME`

### Frontend

- `REACT_APP_BACKEND_URL`
- `REACT_APP_APP_NAME`
- `REACT_APP_APP_SHORT_NAME`
- `REACT_APP_GOOGLE_AUTH_URL`

## Current Auth Flow

The app now supports:

- Local email/password auth inside the app
- Company-aware access requests after selecting a company
- Optional Google OAuth fallback if you keep it enabled

Recommended production setup:

1. Keep local auth enabled.
2. Disable Google OAuth after your business users are migrated.
3. Set `COOKIE_SECURE=true` and use HTTPS on your VPS.

## Rebranding

The main runtime branding knobs are now in:

- `frontend/.env`
- `backend/.env`
- `frontend/src/config/branding.js`

This phase also adds:

- `Sales Orders` and `Purchase Orders` modules
- order-to-invoice and PO-to-bill conversion flows
- approval actions and activity timelines
- an admin-facing audit log page
- a `Recurring & Reminders` workspace for scheduled invoices and bills
- a `Bank Reconciliation` workspace for manual bank statement matching
- `Tax Summary` reporting for filing review and internal control

If you add more ERP modules later, keep new records company-scoped and wire them into the audit log / approval patterns already added in this phase.

## Deployment

See [DEPLOYMENT_VPS.md](./DEPLOYMENT_VPS.md) for a production VPS setup using:

- Ubuntu
- Nginx
- systemd
- Uvicorn
- MongoDB
- React production build

## QuickBooks Desktop Import

From Settings -> CSV Import:

- `Import QuickBooks Desktop`
- Upload `.csv` or `.iif` files exported from QuickBooks Desktop
- The backend auto-detects and imports customers, vendors, products, invoices, and bills when possible

## Product Expansion

See [FEATURE_ROADMAP.md](./FEATURE_ROADMAP.md) for the next feature phases, including:

- accounting depth
- embedded AI agents
- workflow automation
- approvals
- audit and compliance
- customer and vendor portals

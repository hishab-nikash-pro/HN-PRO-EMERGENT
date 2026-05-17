# Feature Roadmap

## Highest-Value Next Features

### 1. Accounting Core

- bank accounts and bank reconciliation
- recurring invoices and recurring bills
- purchase orders and sales orders
- credit notes and vendor credits
- tax/VAT/sales-tax engine
- fiscal year close and retained earnings roll-forward
- fixed assets and depreciation
- multi-currency revaluation

### 2. AI Agents Inside The App

- CFO copilot for cash, margin, AR/AP, and stock analysis
- bookkeeping agent that flags uncategorized or suspicious entries
- collections agent that drafts customer follow-ups
- purchasing agent that suggests reorders from demand and stock trends
- executive daily briefing agent
- anomaly-detection agent for duplicates, negative stock, unusual expenses, and margin drops

## Multi-Agent Workflows

The app can evolve to support multiple specialized in-app agents:

- `Accounting Agent`
- `Inventory Agent`
- `Collections Agent`
- `Vendor Payables Agent`
- `Reporting Agent`
- `Operations Agent`

Each agent should have:

- company-scoped permissions
- action audit logs
- approval thresholds
- suggested actions before auto-execution

## Automation Opportunities

### Immediate Automations

- daily low-stock email
- overdue invoice reminders
- unpaid bill reminders
- monthly P&L email to owner
- auto-import and review queue for uploaded invoices/bills
- daily exception digest

### Advanced Automations

- recurring journal entries
- scheduled bank feed import and reconciliation review
- inventory reorder proposals
- approval routing for high-value expenses and payments
- month-end closing checklist automation
- customer statement auto-send on schedule

## Operational Features

- approval center
- activity feed by company
- audit log by record and user
- attachment center for invoices, bills, receipts, statements
- role-based notification center
- internal notes and mentions

## Customer/Vendor Portal Features

- customer portal for invoices, statements, and payments
- vendor portal for bills, remittance advice, and purchase orders
- self-service document upload

## Deployment and Platform Features

- S3-compatible file storage
- Redis for queues/caching
- background job worker
- webhooks for Stripe, email, and external integrations
- scheduled jobs dashboard
- health monitoring and admin status page

## Suggested Build Order

1. finish authentication, company ownership, and branding cleanup
2. deploy production-ready VPS environment
3. add audit log + approval center
4. add bank reconciliation + recurring transactions
5. add automation engine + scheduled jobs UI
6. add embedded AI agents with action permissions
7. add customer/vendor portals

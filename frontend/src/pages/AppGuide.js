import { useMemo, useState } from 'react';
import { BookOpen, ChartBar, CurrencyDollar, Gear, Package, Receipt, Truck, Users } from '@phosphor-icons/react';
import AppShell from '../components/layout/AppShell';

const ADMIN_STEPS = [
  { title: 'Dashboard Overview', icon: ChartBar, body: 'Review live KPI cards, cash position, receivables, payables, and inventory health before starting daily work.' },
  { title: 'Create Invoice', icon: Receipt, body: 'Open Sales, create a new invoice, select the customer, enter line items, review totals, then save, send, print, or preview.' },
  { title: 'Add Customer', icon: Users, body: 'Go to Customers, add the customer profile, save contact details, and keep the open balance clean for future statements.' },
  { title: 'Add Vendor', icon: Truck, body: 'Go to Vendors, add supplier information, and use it later for bills, purchasing, and landed-cost workflows.' },
  { title: 'Add Product', icon: Package, body: 'Open Products, create inventory items with category, price, tax settings, and stock details.' },
  { title: 'Record Expense', icon: CurrencyDollar, body: 'Use Expenses to record company spending with date, category, payment method, and memo for reporting.' },
  { title: 'Manage Inventory', icon: Package, body: 'Review inventory levels, warehouse balances, stock movement, and valuation from Inventory.' },
  { title: 'Use Reports', icon: ChartBar, body: 'Run sales, profit and loss, expense, receivables, payables, and tax reports from the Reports area.' },
  { title: 'Manage Users & Permissions', icon: Users, body: 'Use Settings to create team access, assign roles, and control feature permissions and user overrides.' },
  { title: 'Use Settings', icon: Gear, body: 'Configure company profile, invoice layout, notifications, import tools, and document preferences in Settings.' },
];

const USER_STEPS = [
  { title: 'View Dashboard', icon: ChartBar, body: 'Start from the dashboard to monitor the latest business status and navigate directly to daily work areas.' },
  { title: 'Create Invoice', icon: Receipt, body: 'Use Sales to create an invoice, add items, and review totals before posting or sending to the customer.' },
  { title: 'Add Customer', icon: Users, body: 'Create customer records before billing so the invoice, statement, and payment history stay connected.' },
  { title: 'Record Payment', icon: CurrencyDollar, body: 'Open a customer invoice or payment page and record incoming payments against the correct document.' },
  { title: 'Search Records', icon: BookOpen, body: 'Use the global search bar to find customers, invoices, products, and vendors without leaving the current page.' },
  { title: 'View Reports', icon: ChartBar, body: 'Use the reports section to review the data available for your role and business workflow.' },
];

export default function AppGuide() {
  const [mode, setMode] = useState('admin');
  const [search, setSearch] = useState('');
  const [openIndex, setOpenIndex] = useState(0);

  const steps = mode === 'admin' ? ADMIN_STEPS : USER_STEPS;
  const filteredSteps = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return steps;
    return steps.filter((step) => `${step.title} ${step.body}`.toLowerCase().includes(term));
  }, [search, steps]);

  const activeStep = filteredSteps[Math.min(openIndex, Math.max(filteredSteps.length - 1, 0))];

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>App Guide</h1>
          <p className="mt-1 text-sm" style={{ color: '#475467' }}>
            Built-in step-by-step guidance for admins and day-to-day users.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="inline-flex rounded-2xl bg-white p-1" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            {[
              ['admin', 'Admin Tutorial'],
              ['user', 'User Tutorial'],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => { setMode(value); setOpenIndex(0); }}
                className="rounded-xl px-4 py-2 text-sm font-semibold"
                style={{ background: mode === value ? '#0F2D5C' : 'transparent', color: mode === value ? '#FFFFFF' : '#475467' }}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            value={search}
            onChange={(event) => { setSearch(event.target.value); setOpenIndex(0); }}
            placeholder="Search tutorial..."
            className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 sm:max-w-md"
            style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
          <div className="space-y-3">
            {filteredSteps.map((step, index) => {
              const Icon = step.icon;
              const active = activeStep?.title === step.title;
              return (
                <button
                  key={step.title}
                  onClick={() => setOpenIndex(index)}
                  className="flex w-full items-center gap-3 rounded-[22px] px-4 py-4 text-left"
                  style={{ background: active ? '#FFFFFF' : '#F7F9FB', boxShadow: active ? '0 6px 18px rgba(15,45,92,0.08)' : 'none' }}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: '#DBEAFE' }}>
                    <Icon size={18} style={{ color: '#0F2D5C' }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#191C1E' }}>{step.title}</p>
                    <p className="mt-1 text-xs" style={{ color: '#667085' }}>Step {index + 1}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-[28px] bg-white p-6" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            {activeStep ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: '#DBEAFE' }}>
                    <activeStep.icon size={22} style={{ color: '#0F2D5C' }} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: '#0E7490' }}>{mode === 'admin' ? 'Admin Tutorial' : 'User Tutorial'}</p>
                    <h2 className="mt-1 text-xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>{activeStep.title}</h2>
                  </div>
                </div>
                <div className="mt-6 rounded-[24px] p-5" style={{ background: '#F7F9FB' }}>
                  <p className="text-sm leading-7" style={{ color: '#475467' }}>{activeStep.body}</p>
                </div>
                <div className="mt-6 flex items-center justify-between">
                  <button
                    onClick={() => setOpenIndex((current) => Math.max(current - 1, 0))}
                    disabled={openIndex === 0}
                    className="rounded-xl px-4 py-2.5 text-sm font-semibold"
                    style={{ background: '#F7F9FB', color: openIndex === 0 ? '#98A2B3' : '#0F2D5C' }}
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setOpenIndex((current) => Math.min(current + 1, filteredSteps.length - 1))}
                    disabled={openIndex >= filteredSteps.length - 1}
                    className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
                    style={{ background: openIndex >= filteredSteps.length - 1 ? '#98A2B3' : '#0F2D5C' }}
                  >
                    Next
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm" style={{ color: '#667085' }}>No tutorial steps match your search.</p>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

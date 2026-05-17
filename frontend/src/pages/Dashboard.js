import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Bank,
  Calculator,
  ChartBar,
  ClipboardText,
  CreditCard,
  CurrencyDollar,
  FileText,
  HandCoins,
  Notebook,
  Package,
  Receipt,
  Repeat,
  Scales,
  TrendUp,
  Truck,
  Users,
  Wallet,
} from '@phosphor-icons/react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import AppShell from '../components/layout/AppShell';
import { useCompany } from '../contexts/CompanyContext';
import { getDashboard } from '../lib/api';

function formatCurrency(value) {
  return `$${Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function KpiCard({ label, value, icon: Icon, color, route, subtitle, subvalue, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(route)}
      className="group rounded-[24px] p-5 text-left transition-all hover:-translate-y-0.5"
      style={{
        background: '#FFFFFF',
        boxShadow: '0 6px 18px rgba(15,45,92,0.06)',
      }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: '#667085' }}>
            {label}
          </p>
          <p
            className="mt-3 text-[1.9rem] font-bold leading-none tabular-nums"
            style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}
          >
            {formatCurrency(value)}
          </p>
        </div>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-2xl transition-transform group-hover:scale-105"
          style={{ background: `${color}14` }}
        >
          <Icon size={20} style={{ color }} />
        </div>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium" style={{ color: '#0F2D5C' }}>
            {subtitle}
          </p>
          <p className="text-xs tabular-nums" style={{ color: '#667085' }}>
            {subvalue}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: '#0F2D5C' }}>
          Open <ArrowRight size={12} />
        </span>
      </div>
    </button>
  );
}

export default function Dashboard() {
  const { selectedCompany, can } = useCompany();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const [dashboardPreference, setDashboardPreference] = useState(() => localStorage.getItem('hn_dashboard_preference') || 'map');

  useEffect(() => {
    if (!selectedCompany?.company_id) return;
    const load = async () => {
      setLoading(true);
      try {
        const response = await getDashboard(selectedCompany.company_id);
        setData(response.data || {});
      } catch (error) {
        console.error('Dashboard load error:', error);
        setData({});
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedCompany?.company_id]);

  useEffect(() => {
    const handlePreference = (event) => setDashboardPreference(event.detail === 'classic' ? 'classic' : 'map');
    window.addEventListener('hn-dashboard-preference', handlePreference);
    return () => window.removeEventListener('hn-dashboard-preference', handlePreference);
  }, []);

  const cards = useMemo(() => {
    const d = data || {};
    const items = [
      {
        label: 'Total Sales',
        value: d.total_sales_today ?? 0,
        subtitle: 'This Month',
        subvalue: formatCurrency(d.total_sales_month ?? 0),
        icon: CurrencyDollar,
        color: '#0F2D5C',
        route: '/sales?filter=today',
      },
      {
        label: 'Collections',
        value: d.collections_today ?? 0,
        subtitle: 'This Month',
        subvalue: formatCurrency(d.collections_month ?? 0),
        icon: Wallet,
        color: '#15803d',
        route: '/payments?filter=today',
      },
      {
        label: 'Receivables',
        value: d.outstanding_receivables ?? 0,
        subtitle: 'Open Balance',
        subvalue: 'Receivables aging',
        icon: Receipt,
        color: '#7F2500',
        route: '/reports/receivables-aging',
      },
      {
        label: 'Payables',
        value: d.total_payables ?? 0,
        subtitle: 'Vendor Bills',
        subvalue: 'Open vendor payables',
        icon: Truck,
        color: '#BA1A1A',
        route: '/vendors/bills',
      },
      {
        label: 'Inventory Value',
        value: d.inventory_value ?? 0,
        subtitle: 'Current Stock',
        subvalue: 'Warehouse inventory',
        icon: Package,
        color: '#0E7490',
        route: '/inventory',
      },
      {
        label: 'Bank/Cash',
        value: d.bank_cash_balance ?? 0,
        subtitle: 'Current Balance',
        subvalue: 'All linked cash accounts',
        icon: Bank,
        color: '#1D4ED8',
        route: '/bank',
      },
      {
        label: 'Monthly Expense',
        value: d.expense_today ?? 0,
        subtitle: 'This Month',
        subvalue: formatCurrency(d.monthly_expense ?? 0),
        icon: Receipt,
        color: '#B45309',
        route: '/expenses',
      },
    ];

    if (can.viewProfit) {
      items.push(
        {
          label: 'Gross Profit',
          value: d.gross_profit ?? 0,
          subtitle: 'This Month',
          subvalue: formatCurrency(d.gross_profit_month ?? 0),
          icon: TrendUp,
          color: '#16A34A',
          route: '/reports/profit',
        },
        {
          label: 'Net Profit',
          value: d.net_profit ?? 0,
          subtitle: 'This Month',
          subvalue: formatCurrency(d.net_profit_month ?? 0),
          icon: TrendUp,
          color: '#0E9F6E',
          route: '/reports/pnl',
        }
      );
    }

    return items;
  }, [can.viewProfit, data]);

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-64 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} />
        </div>
      </AppShell>
    );
  }

  const d = data || {};
  const viewParam = new URLSearchParams(location.search).get('view');
  const activeDashboardView = viewParam === 'classic' || viewParam === 'map' ? viewParam : dashboardPreference;
  if (viewParam === 'classic' || viewParam === 'map') {
    localStorage.setItem('hn_dashboard_preference', viewParam);
  }
  if (activeDashboardView !== 'classic') {
    return <MapViewDashboard data={d} selectedCompany={selectedCompany} navigate={navigate} />;
  }

  const agingTotal = Object.values(d.aging || {}).reduce((sum, value) => sum + (Number(value) || 0), 0) || 1;

  return (
    <AppShell>
      <div data-testid="dashboard-page" className="space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>
              Dashboard
            </h1>
            <p className="mt-1 text-sm" style={{ color: '#434655' }}>
              {selectedCompany?.name} business overview with live financial and inventory values.
            </p>
          </div>
          <div className="text-sm tabular-nums" style={{ color: '#434655' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {cards.map((card) => (
            <KpiCard key={card.label} {...card} onClick={navigate} />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-[24px] p-6 lg:col-span-2" style={{ background: '#FFFFFF', boxShadow: '0 6px 18px rgba(15,45,92,0.06)' }}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Sales Trend</h3>
                <p className="mt-1 text-xs" style={{ color: '#667085' }}>Monthly posted sales volume from live invoice data.</p>
              </div>
            </div>
            <div className="h-72" style={{ minHeight: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.sales_trend || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E6E8EA" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#434655' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#434655' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => `$${(Number(value || 0) / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{ background: '#FFFFFF', border: '1px solid #E6E8EA', borderRadius: '12px', fontSize: '12px' }}
                    formatter={(value) => [formatCurrency(value), 'Sales']}
                  />
                  <Bar dataKey="amount" fill="#0F2D5C" radius={[8, 8, 0, 0]} maxBarSize={42} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-[24px] p-6" style={{ background: '#FFFFFF', boxShadow: '0 6px 18px rgba(15,45,92,0.06)' }}>
            <div className="mb-4">
              <h3 className="text-sm font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Receivables Aging</h3>
              <p className="mt-1 text-xs" style={{ color: '#667085' }}>Current open balance by aging bucket.</p>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Current', key: 'current', color: '#16a34a' },
                { label: '1-30 Days', key: '1_30', color: '#0F2D5C' },
                { label: '31-60 Days', key: '31_60', color: '#0E7490' },
                { label: '61-90 Days', key: '61_90', color: '#7F2500' },
                { label: '90+ Days', key: 'over_90', color: '#BA1A1A' },
              ].map(({ label, key, color }) => {
                const value = Number(d.aging?.[key] || 0);
                return (
                  <div key={key}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-medium" style={{ color: '#434655' }}>{label}</span>
                      <span className="text-xs font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>
                        {formatCurrency(value)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full" style={{ background: '#F2F4F6' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${(value / agingTotal) * 100}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-[24px] p-6" style={{ background: '#FFFFFF', boxShadow: '0 6px 18px rgba(15,45,92,0.06)' }}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Top Customers</h3>
                <p className="mt-1 text-xs" style={{ color: '#667085' }}>Customers with the highest open balances.</p>
              </div>
              <button onClick={() => navigate('/customers')} className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: '#0F2D5C' }}>
                View All <ArrowRight size={12} />
              </button>
            </div>
            <div className="space-y-3">
              {(d.top_customers || []).slice(0, 6).map((customer, index) => (
                <div key={`${customer.customer_id || customer.name}-${index}`} className="flex items-center justify-between rounded-2xl px-1 py-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold text-white" style={{ background: '#0E7490' }}>
                      {customer.name?.charAt(0) || 'C'}
                    </div>
                    <span className="text-sm font-medium" style={{ color: '#191C1E' }}>{customer.name}</span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#7F2500' }}>
                    {formatCurrency(customer.balance || 0)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] p-6" style={{ background: '#FFFFFF', boxShadow: '0 6px 18px rgba(15,45,92,0.06)' }}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Recent Invoices</h3>
                <p className="mt-1 text-xs" style={{ color: '#667085' }}>Latest sales documents created in the selected company.</p>
              </div>
              <button onClick={() => navigate('/sales')} className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: '#0F2D5C' }}>
                View All <ArrowRight size={12} />
              </button>
            </div>
            <div className="space-y-2">
              {(d.recent_invoices || []).slice(0, 6).map((invoice, index) => (
                <button
                  key={invoice.invoice_id || index}
                  type="button"
                  onClick={() => navigate(`/sales/${invoice.invoice_id}`)}
                  className="flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left transition-colors hover:bg-[#F7F9FB]"
                >
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#191C1E' }}>{invoice.invoice_number}</p>
                    <p className="mt-1 text-xs" style={{ color: '#667085' }}>{invoice.customer_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>
                      {formatCurrency(invoice.total || 0)}
                    </p>
                    <span
                      className="mt-1 inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide"
                      style={{
                        background: invoice.status === 'Paid' ? '#DCFCE7' : invoice.status === 'Overdue' ? '#FEF2F2' : invoice.status === 'Draft' ? '#F2F4F6' : '#DBEAFE',
                        color: invoice.status === 'Paid' ? '#15803D' : invoice.status === 'Overdue' ? '#B91C1C' : invoice.status === 'Draft' ? '#475467' : '#1D4ED8',
                      }}
                    >
                      {invoice.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

const workflowSections = [
  {
    title: 'SUPPLIERS',
    className: 'suppliers',
    items: [
      { label: 'Enter Bills', route: '/bills', icon: Receipt },
      { label: 'Pay Bills', route: '/vendor-payments/new', icon: HandCoins },
      { label: 'Manage Sales Tax', route: '/reports/tax-summary', icon: Calculator },
    ],
  },
  {
    title: 'CUSTOMERS',
    className: 'customers',
    items: [
      { label: 'Create Estimates', route: '/estimates', icon: ClipboardText },
      { label: 'Create Invoices', route: '/sales/new', icon: Receipt },
      { label: 'Receive Payments', route: '/customer-payments/new', icon: CurrencyDollar },
      { label: 'Sales Receipts', route: '/sales/new', icon: FileText },
      { label: 'Statements', route: '/customers', icon: Notebook },
      { label: 'Returns & Credits', route: '/credit-memos', icon: Repeat },
    ],
  },
  {
    title: 'COMPANY',
    className: 'company',
    items: [
      { label: 'Chart of Accounts', route: '/chart-of-accounts', icon: Scales },
      { label: 'Manage Users', route: '/settings?tab=team', icon: Users },
      { label: 'Products & Services', route: '/products', icon: Package },
      { label: 'Order Checks', route: '/bank-transactions', icon: FileText },
    ],
  },
  {
    title: 'BANKING',
    className: 'banking',
    items: [
      { label: 'Record Deposits', route: '/bank-transactions', icon: Bank },
      { label: 'Reconcile', route: '/bank-reconciliation', icon: Scales },
      { label: 'Write Checks', route: '/bank-transactions', icon: FileText },
      { label: 'Reports', route: '/reports', icon: ChartBar },
      { label: 'Credit Card Charges', route: '/expenses/new', icon: CreditCard },
    ],
  },
];

function MapViewDashboard({ data, selectedCompany, navigate }) {
  const agingTotal = Object.values(data.aging || {}).reduce((sum, value) => sum + (Number(value) || 0), 0) || 1;
  const lowStock = (data.inventory_alerts || data.low_stock_items || []).slice(0, 5);
  const recentInvoices = (data.recent_invoices || []).slice(0, 5);
  const summaryItems = [
    { label: 'Total Sales Today', value: data.total_sales_today || 0, route: '/sales?filter=today', icon: CurrencyDollar },
    { label: 'Receivables', value: data.outstanding_receivables || 0, route: '/reports/receivables-aging', icon: Receipt },
    { label: 'Payables', value: data.total_payables || 0, route: '/vendors/bills', icon: Truck },
    { label: 'Inventory Value', value: data.inventory_value || 0, route: '/inventory', icon: Package },
    { label: 'Cash/Bank', value: data.bank_cash_balance || 0, route: '/bank', icon: Bank },
  ];

  return (
    <AppShell>
      <div data-testid="map-view-dashboard" className="space-y-5">
        <div className="rounded-[28px] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.24em]" style={{ color: '#0E7490' }}>Workflow Dashboard</p>
              <h1 className="mt-2 text-2xl font-bold" style={{ color: '#191C1E' }}>Map View</h1>
              <p className="mt-1 text-sm" style={{ color: '#475569' }}>{selectedCompany?.name} QuickBooks-style workflow map with live business widgets.</p>
            </div>
            <button onClick={() => { localStorage.setItem('hn_dashboard_preference', 'classic'); navigate('/dashboard?view=classic'); }} className="rounded-2xl px-4 py-2.5 text-sm font-bold" style={{ color: '#0F2D5C', boxShadow: '0 0 0 1px #C4C5D7' }}>
              Classic Dashboard
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {summaryItems.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => navigate(item.route)}
              className="flex items-center justify-between gap-3 rounded-[22px] bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <span>
                <span className="block text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: '#64748B' }}>{item.label}</span>
                <span className="mt-2 block text-xl font-extrabold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#0F172A' }}>{formatCurrency(item.value)}</span>
              </span>
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: '#E6F3F5', color: '#0E7490' }}>
                <item.icon size={20} weight="duotone" />
              </span>
            </button>
          ))}
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="map-workflow-grid">
            {workflowSections.map((section) => (
              <WorkflowSection key={section.title} section={section} navigate={navigate} />
            ))}
          </div>

          <aside className="space-y-4">
            <MapWidget title="Receivables Aging" subtitle="Live open balance by bucket">
              {[
                ['Current', 'current', '#16a34a'],
                ['1-30 Days', '1_30', '#0F2D5C'],
                ['31-60 Days', '31_60', '#0E7490'],
                ['61-90 Days', '61_90', '#7F2500'],
                ['90+ Days', 'over_90', '#BA1A1A'],
              ].map(([label, key, color]) => {
                const value = Number(data.aging?.[key] || 0);
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between text-xs"><span>{label}</span><strong>{formatCurrency(value)}</strong></div>
                    <div className="h-2 rounded-full" style={{ background: '#F2F4F6' }}>
                      <div className="h-2 rounded-full" style={{ width: `${(value / agingTotal) * 100}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </MapWidget>

            <MapWidget title="Recent Invoices" subtitle="Latest sales documents">
              {recentInvoices.length === 0 ? <EmptyWidgetLine text="No invoices yet." /> : recentInvoices.map((invoice) => (
                <button key={invoice.invoice_id} onClick={() => navigate(`/sales/${invoice.invoice_id}`)} className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left hover:bg-[#F7F9FB]">
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold" style={{ color: '#191C1E' }}>{invoice.invoice_number}</span>
                    <span className="block truncate text-[11px]" style={{ color: '#64748B' }}>{invoice.customer_name}</span>
                  </span>
                  <strong className="text-xs tabular-nums">{formatCurrency(invoice.total || 0)}</strong>
                </button>
              ))}
            </MapWidget>

            <MapWidget title="Payables Summary" subtitle="Vendor balance position">
              <div className="rounded-2xl p-3" style={{ background: '#FEF2F2', color: '#7F1D1D' }}>
                <p className="text-xs font-bold uppercase">Open Payables</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{formatCurrency(data.total_payables || 0)}</p>
              </div>
              {(data.top_vendors || []).slice(0, 4).map((vendor) => (
                <div key={vendor.name} className="flex justify-between text-xs">
                  <span className="truncate">{vendor.name}</span>
                  <strong>{formatCurrency(vendor.balance || 0)}</strong>
                </div>
              ))}
            </MapWidget>

            <MapWidget title="Inventory Alerts" subtitle="Low stock and reorder items">
              {lowStock.length === 0 ? <EmptyWidgetLine text="No low-stock alerts." /> : lowStock.map((item) => (
                <button key={`${item.sku}-${item.product_name}`} onClick={() => navigate('/inventory')} className="flex w-full justify-between rounded-xl px-2 py-2 text-left hover:bg-[#F7F9FB]">
                  <span className="truncate text-xs font-semibold">{item.product_name}</span>
                  <span className="text-xs" style={{ color: '#B91C1C' }}>{item.stock ?? item.stock_on_hand}</span>
                </button>
              ))}
            </MapWidget>
          </aside>
        </div>

        <style>{`
          .map-workflow-grid {
            display: grid;
            grid-template-columns: minmax(0, 1.2fr) minmax(260px, .8fr);
            grid-template-areas:
              "suppliers company"
              "customers banking";
            gap: 16px;
            align-content: start;
            align-items: start;
          }
          .workflow-section { align-self: start; }
          .workflow-section.suppliers { grid-area: suppliers; }
          .workflow-section.customers { grid-area: customers; }
          .workflow-section.company { grid-area: company; }
          .workflow-section.banking { grid-area: banking; }
          @media (max-width: 900px) {
            .map-workflow-grid {
              grid-template-columns: 1fr;
              grid-template-areas: "suppliers" "customers" "company" "banking";
            }
          }
        `}</style>
      </div>
    </AppShell>
  );
}

function WorkflowSection({ section, navigate }) {
  return (
    <section className={`workflow-section ${section.className} relative rounded-[28px] bg-white p-5 shadow-sm`}>
      <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#F7F9FB] px-5 py-1 text-[11px] font-bold tracking-[0.18em]" style={{ color: '#64748B' }}>
        {section.title}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {section.items.map((item, index) => (
          <button key={item.label} onClick={() => navigate(item.route)} className="workflow-node group relative flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-2xl border bg-[#F8FAFC] p-3 text-center transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-md" style={{ borderColor: '#E2E8F0' }}>
            {index < section.items.length - 1 && <span className="workflow-arrow hidden sm:block" />}
            <span className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: '#E6F3F5', color: '#0E7490', boxShadow: 'inset 0 0 0 1px #B7E1E8' }}>
              <item.icon size={24} weight="duotone" />
            </span>
            <span className="text-xs font-bold" style={{ color: '#0F172A' }}>{item.label}</span>
          </button>
        ))}
      </div>
      <style>{`
        .workflow-node .workflow-arrow {
          position: absolute;
          right: -14px;
          top: 50%;
          width: 22px;
          height: 1px;
          background: #CBD5E1;
          z-index: 1;
        }
        .workflow-node .workflow-arrow:after {
          content: '';
          position: absolute;
          right: -1px;
          top: -3px;
          border-left: 6px solid #CBD5E1;
          border-top: 4px solid transparent;
          border-bottom: 4px solid transparent;
        }
      `}</style>
    </section>
  );
}

function MapWidget({ title, subtitle, children }) {
  return (
    <div className="rounded-[24px] bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold" style={{ color: '#191C1E' }}>{title}</h3>
      <p className="mb-3 mt-1 text-xs" style={{ color: '#64748B' }}>{subtitle}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function EmptyWidgetLine({ text }) {
  return <div className="rounded-2xl p-3 text-center text-xs" style={{ background: '#F7F9FB', color: '#64748B' }}>{text}</div>;
}

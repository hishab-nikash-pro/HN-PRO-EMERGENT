import AppShell from '../components/layout/AppShell';
import { useNavigate } from 'react-router-dom';
import { ChartBar, CurrencyDollar, Receipt, Package, Users, Truck, Calculator } from '@phosphor-icons/react';

const reportCategories = [
  {
    title: 'Financial Reports',
    icon: CurrencyDollar,
    color: '#0037B0',
    reports: [
      { name: 'Profit & Loss', desc: 'Income, expenses, and net profit', path: '/reports/profit-loss' },
      { name: 'Balance Sheet', desc: 'Assets, liabilities, and equity', path: null },
      { name: 'Cash Flow', desc: 'Cash inflows and outflows', path: null },
    ]
  },
  {
    title: 'Sales Reports',
    icon: ChartBar,
    color: '#1D4ED8',
    reports: [
      { name: 'Sales Report', desc: 'Sales volume, trends, and top customers', path: '/reports/sales' },
      { name: 'Invoice Aging', desc: 'Outstanding invoice aging analysis', path: '/receivables' },
    ]
  },
  {
    title: 'Expense Reports',
    icon: Receipt,
    color: '#7F2500',
    reports: [
      { name: 'Expense Report', desc: 'Category breakdown and vendor analysis', path: '/reports/expenses' },
      { name: 'Vendor Spending', desc: 'Spending by vendor over time', path: '/payables' },
    ]
  },
  {
    title: 'Inventory Reports',
    icon: Package,
    color: '#4D5B94',
    reports: [
      { name: 'Inventory Valuation', desc: 'Total value by category and item', path: '/inventory/valuation' },
      { name: 'Stock Movement', desc: 'Inventory movement history', path: '/inventory' },
    ]
  },
  {
    title: 'Receivables Reports',
    icon: Users,
    color: '#16a34a',
    reports: [
      { name: 'AR Aging', desc: 'Customer receivables by age bucket', path: '/receivables' },
      { name: 'Collection Report', desc: 'Payment collection trends', path: '/receivables' },
    ]
  },
  {
    title: 'Payables Reports',
    icon: Truck,
    color: '#BA1A1A',
    reports: [
      { name: 'AP Aging', desc: 'Vendor payables by age bucket', path: '/payables' },
      { name: 'Payment Schedule', desc: 'Upcoming vendor payments', path: '/payables' },
    ]
  },
];

export default function ReportsHub() {
  const navigate = useNavigate();

  return (
    <AppShell>
      <div data-testid="reports-hub-page" className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Reports</h1>
          <p className="text-sm mt-1" style={{ color: '#434655' }}>Financial reporting and business analytics</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reportCategories.map(cat => {
            const Icon = cat.icon;
            return (
              <div key={cat.title} className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${cat.color}10` }}>
                    <Icon size={20} style={{ color: cat.color }} />
                  </div>
                  <h3 className="text-sm font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>{cat.title}</h3>
                </div>
                <div className="space-y-2">
                  {cat.reports.map(report => (
                    <button
                      key={report.name}
                      data-testid={`report-${report.name.toLowerCase().replace(/\s+/g, '-')}`}
                      onClick={() => report.path && navigate(report.path)}
                      disabled={!report.path}
                      className="w-full text-left p-3 rounded-lg transition-colors hover:bg-[#F7F9FB] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <p className="text-sm font-medium" style={{ color: '#191C1E' }}>{report.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#434655' }}>{report.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}

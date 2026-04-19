import { useEffect, useState } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { getInvoices } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import { useNavigate } from 'react-router-dom';
import { Plus, MagnifyingGlass, Funnel, Export, Printer } from '@phosphor-icons/react';
import DateFilterPreset from '../components/DateFilterPreset';

const STATUS_STYLES = {
  Draft: { bg: '#F2F4F6', color: '#434655' },
  Sent: { bg: '#dbeafe', color: '#0F2D5C' },
  'Partial Paid': { bg: '#fef3c7', color: '#92400e' },
  Paid: { bg: '#dcfce7', color: '#16a34a' },
  Overdue: { bg: '#fef2f2', color: '#BA1A1A' },
  Cancelled: { bg: '#F2F4F6', color: '#434655' },
};

export default function SalesList() {
  const { selectedCompany } = useCompany();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const navigate = useNavigate();

  useEffect(() => {
    if (!selectedCompany) return;
    const load = async () => {
      try {
        const res = await getInvoices(selectedCompany.company_id, statusFilter || undefined);
        setInvoices(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedCompany, statusFilter]);

  const filtered = invoices.filter(inv => {
    const matchesSearch = inv.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
      inv.customer_name?.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    
    const matchesDate = !dateRange.start || !dateRange.end || 
      (inv.invoice_date >= dateRange.start && inv.invoice_date <= dateRange.end);
    
    return matchesDate;
  });

  return (
    <AppShell>
      <div data-testid="sales-list-page" className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Sales</h1>
            <p className="text-sm mt-1" style={{ color: '#434655' }}>Manage invoices, quotes, and sales orders</p>
          </div>
          <button
            data-testid="create-invoice-btn"
            onClick={() => navigate('/sales/new')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}
          >
            <Plus size={16} weight="bold" /> Create Invoice
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#434655' }} />
            <input
              data-testid="sales-search"
              type="text"
              placeholder="Search invoices..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
              style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}
            />
          </div>
          <select
            data-testid="sales-status-filter"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setLoading(true); }}
            className="px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
            style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}
          >
            <option value="">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="Sent">Sent</option>
            <option value="Partial Paid">Partial Paid</option>
            <option value="Paid">Paid</option>
            <option value="Overdue">Overdue</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <button className="p-2 rounded-lg hover:bg-white transition-colors" style={{ color: '#434655' }}>
            <Export size={18} />
          </button>
          <button className="p-2 rounded-lg hover:bg-white transition-colors" style={{ color: '#434655' }}>
            <Printer size={18} />
          </button>
        </div>

        {/* Date Filter */}
        <DateFilterPreset 
          onDateChange={(start, end) => setDateRange({ start, end })}
          storageKey="invoices_date_filter"
          defaultPreset="this_month"
        />

        {/* Table */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#F7F9FB', borderBottom: '1px solid #C4C5D7' }}>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Invoice #</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Due Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Total</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-sm" style={{ color: '#434655' }}>No invoices found</td>
                  </tr>
                ) : filtered.map((inv, i) => {
                  const ss = STATUS_STYLES[inv.status] || STATUS_STYLES.Draft;
                  return (
                    <tr
                      key={inv.invoice_id}
                      data-testid={`invoice-row-${inv.invoice_id}`}
                      onClick={() => navigate(`/sales/${inv.invoice_id}`)}
                      className="cursor-pointer transition-colors hover:bg-[#F7F9FB]"
                      style={{ background: i % 2 === 0 ? '#FFFFFF' : '#FAFBFC', borderBottom: '1px solid #F2F4F6' }}
                    >
                      <td className="px-4 py-3 font-medium" style={{ color: '#0F2D5C' }}>{inv.invoice_number}</td>
                      <td className="px-4 py-3" style={{ color: '#191C1E' }}>{inv.customer_name}</td>
                      <td className="px-4 py-3" style={{ color: '#434655' }}>{inv.invoice_date}</td>
                      <td className="px-4 py-3" style={{ color: '#434655' }}>{inv.due_date}</td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: ss.bg, color: ss.color }}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>
                        ${(inv.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: inv.balance_due > 0 ? '#7F2500' : '#191C1E' }}>
                        ${(inv.balance_due || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}

import { useEffect, useState } from 'react';
import AppShell from '../components/layout/AppShell';
import { useCompany } from '../contexts/CompanyContext';
import { getTaxSummary } from '../lib/api';
import DateFilterPreset from '../components/DateFilterPreset';
import { ArrowLeft } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { downloadCSV } from '../lib/exportUtils';

export default function TaxSummary() {
  const { selectedCompany } = useCompany();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState({ start: '', end: '' });
  const navigate = useNavigate();

  useEffect(() => {
    if (!selectedCompany) return;
    setLoading(true);
    getTaxSummary(selectedCompany.company_id, range.start, range.end)
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }, [selectedCompany, range.start, range.end]);

  const exportTaxSummary = () => {
    downloadCSV('tax-summary.csv', (data?.monthly || []).map((row) => ({
      month: row.month || '',
      sales_tax: Number(row.sales_tax || 0).toFixed(2),
      purchase_tax: Number(row.purchase_tax || 0).toFixed(2),
      net_tax: Number(row.net_tax || 0).toFixed(2),
    })), ['month', 'sales_tax', 'purchase_tax', 'net_tax']);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/reports')} className="p-2 rounded-lg hover:bg-white transition-colors" style={{ color: '#434655' }}><ArrowLeft size={20} /></button>
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Tax Summary</h1>
              <p className="text-sm mt-1" style={{ color: '#475569' }}>Sales tax visibility from invoices and purchase tax captured on bills.</p>
            </div>
          </div>
          <button onClick={exportTaxSummary} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ color: '#0F2D5C', boxShadow: '0 0 0 1px #CBD5E1' }}>Export CSV</button>
        </div>

        <DateFilterPreset onDateChange={(start, end) => setRange({ start, end })} storageKey="tax_summary_date_filter" defaultPreset="this_month" />

        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} /></div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card label="Sales Tax" value={data?.sales_tax} color="#0E7490" />
              <Card label="Purchase Tax" value={data?.purchase_tax} color="#7C2D12" />
              <Card label="Net Tax Payable" value={data?.net_tax_payable} color="#0F2D5C" />
            </div>

            <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div className="px-5 py-4" style={{ borderBottom: '1px solid #E6E8EA' }}>
                <h2 className="text-sm font-semibold" style={{ color: '#191C1E' }}>Monthly Tax Trend</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: '#F7F9FB', borderBottom: '1px solid #E6E8EA' }}>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#475569' }}>Month</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#475569' }}>Sales Tax</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#475569' }}>Purchase Tax</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#475569' }}>Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.monthly || []).length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-10 text-center" style={{ color: '#64748B' }}>No tax activity for this period.</td></tr>
                    ) : (data.monthly || []).map((row) => (
                      <tr key={row.month} style={{ borderBottom: '1px solid #F2F4F6' }}>
                        <td className="px-4 py-3">{row.month}</td>
                        <td className="px-4 py-3 text-right">${Number(row.sales_tax || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">${Number(row.purchase_tax || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-semibold">${Number(row.net_tax || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Card({ label, value, color }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#64748B' }}>{label}</p>
      <p className="text-2xl font-bold mt-2" style={{ color, fontFamily: 'Manrope, sans-serif' }}>${Number(value || 0).toFixed(2)}</p>
    </div>
  );
}

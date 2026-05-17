import { useEffect, useMemo, useState } from 'react';
import AppShell from '../components/layout/AppShell';
import { useCompany } from '../contexts/CompanyContext';
import { getDeletedRecords } from '../lib/api';

const FILTERS = [
  ['all', 'All Records'],
  ['customers', 'Customers'],
  ['vendors', 'Vendors'],
  ['invoices', 'Invoices'],
  ['estimates', 'Estimates'],
  ['sales_orders', 'Sales Orders'],
  ['bills', 'Bills'],
  ['expenses', 'Expenses'],
  ['products', 'Products'],
  ['inventory', 'Inventory'],
];

export default function DeletedRecordsPage() {
  const { selectedCompany, can } = useCompany();
  const [recordType, setRecordType] = useState('all');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!selectedCompany?.company_id || !can.admin) return;
    const load = async () => {
      setLoading(true);
      try {
        const response = await getDeletedRecords(selectedCompany.company_id, recordType);
        setRecords(response.data || []);
      } catch (error) {
        console.error(error);
        setRecords([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [can.admin, recordType, selectedCompany?.company_id]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return records;
    return records.filter((record) =>
      [record.title, record.subtitle, record.record_type, record.record_id, record.deleted_by]
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [records, search]);

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Deleted Records</h1>
          <p className="mt-1 text-sm" style={{ color: '#475467' }}>
            Admin-only audit view for records hidden by soft delete.
          </p>
        </div>

        {!can.admin ? (
          <div className="rounded-2xl bg-white p-6 text-sm" style={{ color: '#B42318' }}>
            Only Owner or Admin can view deleted records.
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search deleted records..."
                className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 sm:max-w-md"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}
              />
              <select
                value={recordType}
                onChange={(event) => setRecordType(event.target.value)}
                className="rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}
              >
                {FILTERS.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto rounded-2xl bg-white" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              {loading ? (
                <div className="flex h-48 items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} />
                </div>
              ) : (
                <table className="min-w-full text-sm">
                  <thead>
                    <tr style={{ background: '#F7F9FB', borderBottom: '1px solid #C4C5D7' }}>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#475467' }}>Type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#475467' }}>Title</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#475467' }}>Details</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#475467' }}>Deleted By</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#475467' }}>Deleted At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-sm" style={{ color: '#667085' }}>
                          No deleted records found.
                        </td>
                      </tr>
                    ) : filtered.map((record) => (
                      <tr key={`${record.record_type}-${record.record_id}`} style={{ borderBottom: '1px solid #F2F4F6' }}>
                        <td className="px-4 py-3 capitalize" style={{ color: '#0F2D5C' }}>{record.record_type.replace('_', ' ')}</td>
                        <td className="px-4 py-3 font-semibold" style={{ color: '#191C1E' }}>{record.title || record.record_id}</td>
                        <td className="px-4 py-3" style={{ color: '#475467' }}>{record.subtitle || '—'}</td>
                        <td className="px-4 py-3" style={{ color: '#475467' }}>{record.deleted_by || '—'}</td>
                        <td className="px-4 py-3" style={{ color: '#475467' }}>{record.deleted_at ? new Date(record.deleted_at).toLocaleString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

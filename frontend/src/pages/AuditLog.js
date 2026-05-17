import { useEffect, useState } from 'react';
import { Export, MagnifyingGlass, ArrowLeft } from '@phosphor-icons/react';
import AppShell from '../components/layout/AppShell';
import { useCompany } from '../contexts/CompanyContext';
import { getAuditLogs } from '../lib/api';
import { downloadCSV } from '../lib/exportUtils';
import { useNavigate } from 'react-router-dom';

export default function AuditLog() {
  const { selectedCompany } = useCompany();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [recordType, setRecordType] = useState('');
  const [action, setAction] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      if (!selectedCompany) return;
      setLoading(true);
      try {
        const res = await getAuditLogs(selectedCompany.company_id, { search, record_type: recordType, action });
        setLogs(res.data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedCompany, search, recordType, action]);

  return (
    <AppShell>
      <div className="space-y-6" data-testid="audit-log-page">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')} className="p-2 rounded-lg hover:bg-white transition-colors" style={{ color: '#434655' }}><ArrowLeft size={20} /></button>
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Audit Log</h1>
              <p className="text-sm mt-1" style={{ color: '#475569' }}>Search company-wide activity across accounting and operations records.</p>
            </div>
          </div>
          <button onClick={() => downloadCSV('audit-log.csv', logs, ['created_at', 'record_type', 'record_id', 'action', 'summary', 'user_id'])} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ color: '#0F2D5C', boxShadow: '0 0 0 1px #CBD5E1' }}><Export size={16} /> Export CSV</button>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#64748B' }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search audit log..." className="w-full pl-9 pr-4 py-2 text-sm rounded-lg focus:outline-none focus:ring-1" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #CBD5E1' }} />
          </div>
          <select value={recordType} onChange={(e) => setRecordType(e.target.value)} className="px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #CBD5E1' }}>
            <option value="">All Records</option>
            <option value="invoice">Invoice</option>
            <option value="bill">Bill</option>
            <option value="expense">Expense</option>
            <option value="journal_entry">Journal Entry</option>
            <option value="sales_order">Sales Order</option>
            <option value="purchase_order">Purchase Order</option>
          </select>
          <select value={action} onChange={(e) => setAction(e.target.value)} className="px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #CBD5E1' }}>
            <option value="">All Actions</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="payment">Payment</option>
            <option value="submit">Submit</option>
            <option value="approve">Approve</option>
            <option value="reject">Reject</option>
            <option value="convert">Convert</option>
            <option value="receive">Receive</option>
            <option value="delete">Delete</option>
          </select>
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          {loading ? (
            <div className="flex items-center justify-center h-48"><div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} /></div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#475569' }}>When</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#475569' }}>Record Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#475569' }}>Record ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#475569' }}>Action</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#475569' }}>Summary</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#475569' }}>User</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-10" style={{ color: '#64748B' }}>No audit activity found.</td></tr>
                ) : logs.map((log, index) => (
                  <tr key={log.activity_id} style={{ borderBottom: '1px solid #F1F5F9', background: index % 2 === 0 ? '#FFFFFF' : '#FCFDFE' }}>
                    <td className="px-4 py-3" style={{ color: '#475569' }}>{log.created_at}</td>
                    <td className="px-4 py-3" style={{ color: '#191C1E' }}>{log.record_type}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: '#0F2D5C' }}>{log.record_id}</td>
                    <td className="px-4 py-3" style={{ color: '#191C1E' }}>{log.action}</td>
                    <td className="px-4 py-3" style={{ color: '#475569' }}>{log.summary}</td>
                    <td className="px-4 py-3" style={{ color: '#475569' }}>{log.user_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}

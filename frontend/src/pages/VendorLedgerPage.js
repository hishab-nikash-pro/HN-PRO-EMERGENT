import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpenText, MagnifyingGlass, Printer } from '@phosphor-icons/react';
import AppShell from '../components/layout/AppShell';
import { useCompany } from '../contexts/CompanyContext';
import { getVendorLedger, getVendors } from '../lib/api';

const asArray = (value) => (Array.isArray(value) ? value : []);

export default function VendorLedgerPage() {
  const { selectedCompany } = useCompany();
  const [searchParams] = useSearchParams();
  const [vendors, setVendors] = useState([]);
  const [selectedVendorId, setSelectedVendorId] = useState(searchParams.get('vendor_id') || '');
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vendorSearch, setVendorSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');

  const loadVendors = async () => {
    if (!selectedCompany) return;
    const res = await getVendors(selectedCompany.company_id);
    const rows = asArray(res.data);
    setVendors(rows);
    if (!selectedVendorId && rows[0]) setSelectedVendorId(rows[0].vendor_id);
  };

  const loadLedger = async () => {
    if (!selectedCompany || !selectedVendorId) {
      setLedger([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await getVendorLedger(selectedCompany.company_id, selectedVendorId);
      setLedger(asArray(res.data?.entries || res.data));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadVendors(); }, [selectedCompany]);
  useEffect(() => { loadLedger(); }, [selectedCompany, selectedVendorId]);

  const selectedVendor = useMemo(
    () => asArray(vendors).find((vendor) => vendor.vendor_id === selectedVendorId) || null,
    [vendors, selectedVendorId],
  );

  const filteredVendors = useMemo(() => {
    const needle = vendorSearch.trim().toLowerCase();
    return asArray(vendors).filter((vendor) => !needle || vendor.name?.toLowerCase().includes(needle) || vendor.company_name?.toLowerCase().includes(needle));
  }, [vendors, vendorSearch]);

  const ledgerWithBalance = useMemo(() => {
    let balance = 0;
    return asArray(ledger).map((entry) => {
      balance += Number(entry.debit || 0) - Number(entry.credit || 0);
      return { ...entry, running_balance: balance };
    });
  }, [ledger]);

  const filteredLedger = useMemo(
    () => ledgerWithBalance.filter((entry) => typeFilter === 'All' || (entry.entry_type || entry.type || 'Entry') === typeFilter),
    [ledgerWithBalance, typeFilter],
  );

  const entryTypes = useMemo(
    () => ['All', ...Array.from(new Set(ledgerWithBalance.map((entry) => entry.entry_type || entry.type || 'Entry')))],
    [ledgerWithBalance],
  );

  const debitTotal = ledgerWithBalance.reduce((sum, entry) => sum + Number(entry.debit || 0), 0);
  const creditTotal = ledgerWithBalance.reduce((sum, entry) => sum + Number(entry.credit || 0), 0);
  const balance = debitTotal - creditTotal;

  return (
    <AppShell>
      <div className="space-y-4" data-testid="vendor-ledger-page">
        <div className="rounded-lg bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: '#E6F3F5', color: '#0E7490' }}>
                <BookOpenText size={22} weight="bold" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: '#64748B' }}>Accounts Payable</p>
                <h1 className="text-xl font-bold leading-tight" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Vendor Ledger</h1>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 md:flex md:items-center">
              <SummaryTile label="Bills" value={`$${debitTotal.toFixed(2)}`} />
              <SummaryTile label="Payments" value={`$${creditTotal.toFixed(2)}`} />
              <SummaryTile label="Payable" value={`$${balance.toFixed(2)}`} strong />
              <button onClick={() => window.print()} title="Print ledger" className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ color: '#334155', border: '1px solid #CBD5E1' }}><Printer size={18} /></button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="rounded-lg bg-white shadow-sm">
            <div className="border-b px-4 py-3" style={{ borderColor: '#E6E8EA' }}>
              <div className="relative">
                <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#64748B' }} />
                <input value={vendorSearch} onChange={(event) => setVendorSearch(event.target.value)} placeholder="Find vendor" className="w-full rounded-lg py-2 pl-9 pr-3 text-sm outline-none" style={fieldSurface} />
              </div>
            </div>
            <div className="max-h-[calc(100vh-250px)] overflow-auto">
              {filteredVendors.map((vendor) => {
                const active = vendor.vendor_id === selectedVendorId;
                return (
                  <button key={vendor.vendor_id} onClick={() => setSelectedVendorId(vendor.vendor_id)} className="w-full border-b px-4 py-3 text-left" style={{ borderColor: '#EEF2F7', background: active ? '#EAF2FF' : '#FFFFFF' }}>
                    <p className="truncate text-sm font-bold" style={{ color: active ? '#0F2D5C' : '#191C1E' }}>{vendor.name}</p>
                    <div className="mt-1 flex items-center justify-between gap-3 text-xs" style={{ color: '#64748B' }}>
                      <span className="truncate">{vendor.company_name || vendor.phone || 'No company'}</span>
                      <span className="font-bold">${Number(vendor.payable_balance || 0).toFixed(2)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <main className="rounded-lg bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b px-4 py-3 md:flex-row md:items-center md:justify-between" style={{ borderColor: '#E6E8EA' }}>
              <div>
                <h2 className="text-sm font-bold" style={{ color: '#191C1E' }}>{selectedVendor?.name || 'Select Vendor'}</h2>
                <p className="text-xs" style={{ color: '#64748B' }}>{selectedVendor?.company_name || selectedVendor?.phone || 'Ledger activity'}</p>
              </div>
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="rounded-lg px-3 py-2 text-sm outline-none" style={fieldSurface}>
                {entryTypes.map((type) => <option key={type}>{type}</option>)}
              </select>
            </div>

            {loading ? (
              <LoadingState />
            ) : filteredLedger.length === 0 ? (
              <EmptyState text="No ledger transactions for this vendor yet." />
            ) : (
              <div className="max-h-[calc(100vh-300px)] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr style={{ background: '#F7F9FB', borderBottom: '1px solid #E6E8EA' }}>
                      <HeaderCell>Date</HeaderCell>
                      <HeaderCell>Type</HeaderCell>
                      <HeaderCell>Reference</HeaderCell>
                      <HeaderCell>Description</HeaderCell>
                      <HeaderCell align="right">Bill</HeaderCell>
                      <HeaderCell align="right">Payment</HeaderCell>
                      <HeaderCell align="right">Balance</HeaderCell>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLedger.map((entry, index) => (
                      <tr key={`${entry.entry_type || 'entry'}-${entry.entry_id || index}`} style={{ borderBottom: '1px solid #EEF2F7', background: index % 2 === 0 ? '#FFFFFF' : '#F9FBFE' }}>
                        <td className="px-4 py-2.5">{entry.date || entry.transaction_date || '-'}</td>
                        <td className="px-4 py-2.5"><TypeChip type={entry.entry_type || entry.type || 'Entry'} /></td>
                        <td className="px-4 py-2.5 font-semibold" style={{ color: '#0F2D5C' }}>{entry.reference || entry.document_number || '-'}</td>
                        <td className="px-4 py-2.5" style={{ color: '#475569' }}>{entry.description || '-'}</td>
                        <td className="px-4 py-2.5 text-right font-semibold">${Number(entry.debit || 0).toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-right font-semibold">${Number(entry.credit || 0).toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-right font-bold" style={{ color: Number(entry.running_balance || 0) > 0 ? '#BA1A1A' : '#166534' }}>${Number(entry.running_balance || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </main>
        </div>
      </div>
    </AppShell>
  );
}

function SummaryTile({ label, value, strong }) {
  return (
    <div className="rounded-lg px-4 py-2 text-right" style={{ background: strong ? '#123461' : '#F8FAFC', border: strong ? '1px solid #123461' : '1px solid #E2E8F0', minWidth: 120 }}>
      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: strong ? '#BFDBFE' : '#64748B' }}>{label}</p>
      <p className="text-sm font-bold" style={{ color: strong ? '#FFFFFF' : '#191C1E' }}>{value}</p>
    </div>
  );
}

function HeaderCell({ children, align = 'left' }) {
  return <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: '#64748B', textAlign: align }}>{children}</th>;
}

function TypeChip({ type }) {
  const isPayment = /payment|credit/i.test(type);
  return <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: isPayment ? '#ECFDF3' : '#EFF6FF', color: isPayment ? '#166534' : '#0F2D5C' }}>{type}</span>;
}

function LoadingState() {
  return <div className="flex h-48 items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} /></div>;
}

function EmptyState({ text }) {
  return <div className="px-5 py-10 text-center text-sm" style={{ color: '#64748B' }}>{text}</div>;
}

const fieldSurface = { background: '#FFFFFF', boxShadow: '0 0 0 1px #CBD5E1', color: '#0F172A' };

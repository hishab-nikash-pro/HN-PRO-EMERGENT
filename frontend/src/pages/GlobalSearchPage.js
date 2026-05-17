import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MagnifyingGlass } from '@phosphor-icons/react';
import AppShell from '../components/layout/AppShell';
import { useCompany } from '../contexts/CompanyContext';
import { getGlobalSearch } from '../lib/api';

const GROUPS = [
  ['customers', 'Customers'],
  ['invoices', 'Invoices'],
  ['products', 'Products'],
  ['vendors', 'Vendors'],
];

export default function GlobalSearchPage() {
  const { selectedCompany } = useCompany();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState({ customers: [], invoices: [], products: [], vendors: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setQuery(searchParams.get('q') || '');
  }, [searchParams]);

  useEffect(() => {
    if (!selectedCompany?.company_id) return;
    const term = (searchParams.get('q') || '').trim();
    if (!term) {
      setResults({ customers: [], invoices: [], products: [], vendors: [] });
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await getGlobalSearch(selectedCompany.company_id, term, 25);
        setResults(response.data || { customers: [], invoices: [], products: [], vendors: [] });
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchParams, selectedCompany]);

  const total = GROUPS.reduce((sum, [key]) => sum + (results[key]?.length || 0), 0);

  return (
    <AppShell>
      <div className="space-y-6" data-testid="global-search-page">
        <div className="rounded-[28px] border border-white/70 px-4 py-5 sm:px-6" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.82))', boxShadow: '0 16px 40px rgba(15,45,92,0.08)' }}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em]" style={{ color: '#0E7490' }}>Workspace Search</p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Global Search</h1>
          <p className="mt-1 text-sm" style={{ color: '#434655' }}>Search customers, invoices, products, and vendors from one place.</p>
          <form
            className="relative mt-5"
            onSubmit={(event) => {
              event.preventDefault();
              setSearchParams(query.trim() ? { q: query.trim() } : {});
            }}
          >
            <MagnifyingGlass size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#434655' }} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search customers, invoices, products, vendors..."
              className="w-full rounded-2xl border-none py-3 pl-11 pr-4 text-sm focus:outline-none focus:ring-1"
              style={{ background: '#FFFFFF', color: '#191C1E', boxShadow: '0 0 0 1px #D0D7E2' }}
            />
          </form>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="text-sm" style={{ color: '#434655' }}>
              {searchParams.get('q') ? `${total} result${total === 1 ? '' : 's'} for "${searchParams.get('q')}"` : 'Start typing to search the workspace.'}
            </div>
            {GROUPS.map(([key, label]) => (
              <div key={key} className="rounded-[26px] p-4 sm:p-5" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: '#191C1E' }}>{label}</h2>
                  <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: '#F2F4F6', color: '#0F2D5C' }}>
                    {results[key]?.length || 0}
                  </span>
                </div>
                <div className="mt-4 space-y-2">
                  {(results[key] || []).length === 0 ? (
                    <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: '#F8FAFC', color: '#667085' }}>No matching {label.toLowerCase()}.</div>
                  ) : (
                    results[key].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => navigate(item.route)}
                        className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition-colors hover:bg-[#F7F9FB]"
                        style={{ background: '#F8FAFC' }}
                      >
                        <div>
                          <p className="text-sm font-semibold" style={{ color: '#191C1E' }}>{item.title}</p>
                          <p className="text-xs" style={{ color: '#667085' }}>{item.subtitle || item.type}</p>
                        </div>
                        <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: '#0E7490' }}>{item.type}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

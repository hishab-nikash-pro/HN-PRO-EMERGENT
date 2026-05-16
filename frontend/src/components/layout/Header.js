import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Buildings,
  CaretDown,
  DeviceMobile,
  Gear,
  List,
  MagnifyingGlass,
  SignOut,
  Swap,
  User,
  LockKey,
} from '@phosphor-icons/react';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { useUi } from '../../contexts/UiContext';
import { getGlobalSearch } from '../../lib/api';

const SEARCH_GROUPS = [
  ['customers', 'Customers'],
  ['invoices', 'Invoices'],
  ['products', 'Products'],
  ['vendors', 'Vendors'],
];

export default function Header({ onMenuToggle }) {
  const { user, logout } = useAuth();
  const { selectedCompany, role, companyProfile } = useCompany();
  const { mobilePreview, toggleMobilePreview } = useUi();
  const navigate = useNavigate();
  const location = useLocation();
  const searchRef = useRef(null);
  const profileRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState({ customers: [], invoices: [], products: [], vendors: [] });
  const [searchLoading, setSearchLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    const handleOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSearchOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    if (!selectedCompany?.company_id || !searchQuery.trim()) {
      setSearchResults({ customers: [], invoices: [], products: [], vendors: [] });
      setSearchLoading(false);
      setHighlightIndex(-1);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const response = await getGlobalSearch(selectedCompany.company_id, searchQuery.trim(), 5);
        setSearchResults(response.data || { customers: [], invoices: [], products: [], vendors: [] });
        setSearchOpen(true);
      } catch (error) {
        console.error(error);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedCompany]);

  const flatResults = useMemo(
    () =>
      SEARCH_GROUPS.flatMap(([key, label]) =>
        (searchResults[key] || []).map((item) => ({ ...item, groupLabel: label }))
      ),
    [searchResults]
  );

  const companyLogo = companyProfile?.logo_url || '/ck-logo-transparent.png';
  const isDashboard = location.pathname === '/dashboard';
  const dashboardViewParam = new URLSearchParams(location.search).get('view');
  const savedDashboardView = localStorage.getItem('hn_dashboard_preference') || 'map';
  const dashboardView = dashboardViewParam === 'classic' || dashboardViewParam === 'map' ? dashboardViewParam : savedDashboardView;
  const isMapView = dashboardView === 'map';

  const runFullSearch = () => {
    const query = searchQuery.trim();
    if (!query) return;
    setSearchOpen(false);
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  const runLogout = async () => {
    await logout();
    navigate('/login');
  };

  const openProfileSettings = (tab = 'profile') => {
    setProfileOpen(false);
    navigate(`/settings?tab=${tab}`);
  };

  const switchDashboardView = (view) => {
    localStorage.setItem('hn_dashboard_preference', view);
    window.dispatchEvent(new CustomEvent('hn-dashboard-preference', { detail: view }));
    navigate(`/dashboard?view=${view}`);
  };

  const highlighted = highlightIndex >= 0 ? flatResults[highlightIndex] : null;

  return (
    <header data-testid="app-header" className="sticky top-0 z-40 px-3 pt-3 sm:px-4 md:px-5 lg:px-6">
      <div
        className="flex min-h-16 flex-wrap items-center gap-3 rounded-[24px] border px-3 py-2 sm:flex-nowrap sm:px-4"
        style={{ background: 'rgba(255,255,255,0.88)', borderColor: 'rgba(255,255,255,0.8)', boxShadow: '0 12px 30px rgba(15,45,92,0.08)', backdropFilter: 'blur(16px)' }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {onMenuToggle && (
            <button data-testid="mobile-menu-btn" onClick={onMenuToggle} className="block rounded-xl p-2 hover:bg-white lg:hidden" style={{ color: '#434655' }}>
              <List size={22} />
            </button>
          )}
          <div ref={searchRef} className="relative min-w-0 flex-1">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (highlighted) {
                  navigate(highlighted.route);
                  setSearchOpen(false);
                  return;
                }
                runFullSearch();
              }}
            >
              <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#434655' }} />
              <input
                data-testid="header-search"
                type="text"
                placeholder="Search customers, invoices, products, vendors..."
                value={searchQuery}
                onFocus={() => setSearchOpen(Boolean(searchQuery.trim()))}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setHighlightIndex(-1);
                  setSearchOpen(Boolean(event.target.value.trim()));
                }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown' && flatResults.length > 0) {
                    event.preventDefault();
                    setHighlightIndex((current) => (current + 1) % flatResults.length);
                    setSearchOpen(true);
                  }
                  if (event.key === 'ArrowUp' && flatResults.length > 0) {
                    event.preventDefault();
                    setHighlightIndex((current) => (current <= 0 ? flatResults.length - 1 : current - 1));
                    setSearchOpen(true);
                  }
                  if (event.key === 'Escape') {
                    setSearchOpen(false);
                    setHighlightIndex(-1);
                  }
                }}
                className="w-full min-w-0 rounded-xl border-none py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', color: '#191C1E', boxShadow: '0 0 0 1px #C4C5D7' }}
              />
            </form>
            {searchOpen && (
              <div className="absolute left-0 right-0 top-full mt-2 overflow-hidden rounded-[24px] border bg-white shadow-[0_20px_45px_rgba(15,45,92,0.12)]" style={{ borderColor: '#E6E8EA' }}>
                {searchLoading ? (
                  <div className="px-4 py-4 text-sm" style={{ color: '#667085' }}>Searching workspace...</div>
                ) : flatResults.length === 0 ? (
                  <div className="px-4 py-4 text-sm" style={{ color: '#667085' }}>No matching records yet.</div>
                ) : (
                  <div className="max-h-[70vh] overflow-y-auto">
                    {SEARCH_GROUPS.map(([key, label]) => (
                      (searchResults[key] || []).length > 0 && (
                        <div key={key}>
                          <div className="px-4 py-2 text-[11px] font-bold uppercase tracking-[0.24em]" style={{ background: '#F8FAFC', color: '#0E7490' }}>{label}</div>
                          {(searchResults[key] || []).map((item) => {
                            const flatIndex = flatResults.findIndex((entry) => entry.id === item.id && entry.type === item.type);
                            const active = flatIndex === highlightIndex;
                            return (
                              <button
                                key={`${item.type}-${item.id}`}
                                onMouseEnter={() => setHighlightIndex(flatIndex)}
                                onClick={() => {
                                  navigate(item.route);
                                  setSearchOpen(false);
                                }}
                                className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors"
                                style={{ background: active ? '#EFF6FF' : '#FFFFFF' }}
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold" style={{ color: '#191C1E' }}>{item.title}</p>
                                  <p className="truncate text-xs" style={{ color: '#667085' }}>{item.subtitle || item.type}</p>
                                </div>
                                <span className="ml-3 text-[11px] font-bold uppercase tracking-wide" style={{ color: '#0F2D5C' }}>{item.type}</span>
                              </button>
                            );
                          })}
                        </div>
                      )
                    ))}
                    <button
                      onClick={runFullSearch}
                      className="w-full border-t px-4 py-3 text-sm font-semibold text-left"
                      style={{ borderColor: '#E6E8EA', color: '#0F2D5C', background: '#F8FAFC' }}
                    >
                      View full results for "{searchQuery.trim()}"
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
          {isDashboard && (
            <div className="inline-flex rounded-xl p-1" style={{ background: '#F2F4F6' }}>
              <button
                type="button"
                onClick={() => switchDashboardView('map')}
                className="rounded-lg px-3 py-1.5 text-xs font-bold"
                style={{ background: isMapView ? '#FFFFFF' : 'transparent', color: isMapView ? '#0F2D5C' : '#475569' }}
              >
                Map View
              </button>
              <button
                type="button"
                onClick={() => switchDashboardView('classic')}
                className="rounded-lg px-3 py-1.5 text-xs font-bold"
                style={{ background: !isMapView ? '#FFFFFF' : 'transparent', color: !isMapView ? '#0F2D5C' : '#475569' }}
              >
                Classic Dashboard
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={toggleMobilePreview}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors hover:bg-white"
            style={{ color: '#191C1E', background: mobilePreview ? '#DBEAFE' : 'rgba(247,249,251,0.8)' }}
          >
            <DeviceMobile size={18} />
            <span className="hidden sm:inline">{mobilePreview ? 'Exit Mobile Preview' : 'Preview Mobile'}</span>
          </button>
          <button
            data-testid="current-company-label"
            onClick={() => navigate('/settings?tab=company')}
            className="hidden min-w-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors hover:bg-white sm:flex"
            style={{ color: '#191C1E', background: 'rgba(247,249,251,0.8)' }}
            title="Open company profile and settings"
          >
            {companyProfile?.logo_url || companyLogo ? (
              <img
                src={companyLogo}
                alt={companyProfile?.name || selectedCompany?.name || 'Company'}
                className="h-8 w-8 rounded-lg object-contain"
                onError={(event) => { event.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <Buildings size={18} style={{ color: '#0F2D5C' }} />
            )}
            <span className="max-w-[220px] truncate font-semibold">
              {companyProfile?.name || selectedCompany?.name || 'Company'}
            </span>
          </button>

          <div ref={profileRef} className="relative">
            <button
              data-testid="header-user-profile"
              onClick={() => setProfileOpen((current) => !current)}
              className="flex items-center gap-2 rounded-xl pl-2 pr-1 py-1.5 transition-colors hover:bg-white"
              style={{ borderLeft: '1px solid #E6E8EA' }}
            >
              {user?.picture ? (
                <img src={user.picture} alt="" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: '#0E7490' }}>
                  {user?.name?.charAt(0) || 'U'}
                </div>
              )}
              <div className="hidden text-left lg:flex flex-col leading-tight">
                <span className="max-w-[120px] truncate text-sm font-medium" style={{ color: '#0F172A' }}>
                  {user?.name || 'User'}
                </span>
                {role && (
                  <span data-testid="header-role-badge" className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#0E7490' }}>
                    {role}
                  </span>
                )}
              </div>
              <CaretDown size={14} style={{ color: '#667085' }} />
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-full mt-2 w-60 overflow-hidden rounded-[22px] border bg-white shadow-[0_20px_45px_rgba(15,45,92,0.12)]" style={{ borderColor: '#E6E8EA' }}>
                {[
                  ['My Profile', <User size={16} key="profile" />, () => openProfileSettings('profile')],
                  ['Settings', <Gear size={16} key="settings" />, () => openProfileSettings('company')],
                  ['Change Password', <LockKey size={16} key="password" />, () => openProfileSettings('profile')],
                  ['Switch Company', <Swap size={16} key="switch" />, () => { setProfileOpen(false); navigate('/select-company'); }],
                  ['Logout', <SignOut size={16} key="logout" />, runLogout],
                ].map(([label, icon, action], index) => (
                  <button
                    key={label}
                    onClick={action}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-[#F7F9FB]"
                    style={{ color: label === 'Logout' ? '#B42318' : '#191C1E', borderTop: index === 0 ? 'none' : '1px solid #F2F4F6' }}
                  >
                    {icon}
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { useNavigate } from 'react-router-dom';
import { MagnifyingGlass, Bell, ClockCounterClockwise, Question, CaretDown, Buildings, List } from '@phosphor-icons/react';
import { useState, useRef, useEffect } from 'react';

const COMPANIES = [
  { company_id: 'ckfrozen', name: 'CK Frozen Fish & Food Inc.', short_name: 'CK Frozen', type: 'Wholesale Import & Distribution' },
  { company_id: 'haor', name: 'Haor Heritage Inc.', short_name: 'Haor Heritage', type: 'Wholesale & Retail' },
  { company_id: 'deshi', name: 'Deshi Distributors LLC', short_name: 'Deshi Dist.', type: 'Distribution' },
  { company_id: 'ckcanada', name: 'CK Frozen Fish & Food Canada Inc.', short_name: 'CK Canada', type: 'Import & Distribution' },
];

export default function Header({ onMenuToggle }) {
  const { user } = useAuth();
  const { selectedCompany, selectCompany } = useCompany();
  const navigate = useNavigate();
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowCompanyDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleCompanySwitch = (company) => {
    selectCompany(company);
    setShowCompanyDropdown(false);
    navigate('/dashboard');
  };

  return (
    <header
      data-testid="app-header"
      className="sticky top-0 z-40 flex items-center justify-between h-16 px-6"
      style={{ background: '#F7F9FB', borderBottom: '1px solid #E6E8EA' }}
    >
      {/* Mobile menu + Search */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        {onMenuToggle && (
          <button data-testid="mobile-menu-btn" onClick={onMenuToggle} className="p-2 rounded-lg hover:bg-white block lg:hidden" style={{ color: '#434655' }}>
            <List size={22} />
          </button>
        )}
        <div className="relative flex-1 hidden sm:block">
          <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#434655' }} />
          <input
            data-testid="header-search"
            type="text"
            placeholder="Search invoices, customers, vendors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border-none focus:outline-none focus:ring-1"
            style={{ background: '#FFFFFF', color: '#191C1E', boxShadow: '0 0 0 1px #C4C5D7' }}
          />
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        {/* Company Switcher */}
        <div className="relative" ref={dropdownRef}>
          <button
            data-testid="company-switcher"
            onClick={() => setShowCompanyDropdown(!showCompanyDropdown)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white"
            style={{ color: '#191C1E' }}
          >
            <Buildings size={18} style={{ color: '#0F2D5C' }} />
            <span className="hidden md:inline max-w-[160px] truncate">
              {selectedCompany?.short_name || 'Select Company'}
            </span>
            <CaretDown size={14} style={{ color: '#434655' }} />
          </button>
          {showCompanyDropdown && (
            <div className="absolute right-0 top-full mt-2 w-72 rounded-xl shadow-lg border overflow-hidden" style={{ background: '#FFFFFF', borderColor: '#E6E8EA' }}>
              <div className="px-4 py-3" style={{ borderBottom: '1px solid #E6E8EA' }}>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Switch Company</p>
              </div>
              {COMPANIES.map((c) => (
                <button
                  key={c.company_id}
                  data-testid={`company-option-${c.company_id}`}
                  onClick={() => handleCompanySwitch(c)}
                  className="w-full text-left px-4 py-3 flex items-center gap-3 transition-colors hover:bg-[#F7F9FB]"
                  style={{
                    background: selectedCompany?.company_id === c.company_id ? '#F2F4F6' : 'transparent',
                    borderBottom: '1px solid #F2F4F6'
                  }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>
                    {c.short_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: '#191C1E' }}>{c.name}</p>
                    <p className="text-xs" style={{ color: '#434655' }}>{c.type}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Action icons */}
        <button data-testid="header-notifications" className="p-2 rounded-lg transition-colors hover:bg-white" style={{ color: '#434655' }}>
          <Bell size={20} />
        </button>
        <button data-testid="header-history" className="p-2 rounded-lg transition-colors hover:bg-white" style={{ color: '#434655' }}>
          <ClockCounterClockwise size={20} />
        </button>
        <button data-testid="header-help" className="p-2 rounded-lg transition-colors hover:bg-white" style={{ color: '#434655' }}>
          <Question size={20} />
        </button>

        {/* User avatar */}
        <div data-testid="header-user-profile" className="flex items-center gap-2 pl-2 ml-1" style={{ borderLeft: '1px solid #E6E8EA' }}>
          {user?.picture ? (
            <img src={user.picture} alt="" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: '#0E7490' }}>
              {user?.name?.charAt(0) || 'U'}
            </div>
          )}
          <span className="hidden lg:inline text-sm font-medium truncate max-w-[120px]" style={{ color: '#191C1E' }}>
            {user?.name || 'User'}
          </span>
        </div>
      </div>
    </header>
  );
}

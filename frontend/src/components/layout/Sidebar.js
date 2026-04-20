import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import {
  House, ShoppingCart, Users, Truck, Receipt, Package,
  CurrencyDollar, Wallet, ChartBar, Robot, Gear,
  Plus, Headset, SignOut, CaretLeft, CaretRight, Tag,
  Notebook, BookOpen, Scales, ArrowDown, UploadSimple
} from '@phosphor-icons/react';
import { useState } from 'react';

const navSections = [
  {
    title: 'MAIN',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: House },
      { path: '/sales', label: 'Sales', icon: ShoppingCart },
      { path: '/estimates', label: 'Estimates', icon: BookOpen, roles: ['Owner', 'Admin', 'Manager', 'Staff/Accountant'] },
      { path: '/customers', label: 'Customers', icon: Users },
      { path: '/customer-payments', label: 'Customer Payments', icon: CurrencyDollar, roles: ['Owner', 'Admin', 'Manager', 'Staff/Accountant'] },
      { path: '/vendors', label: 'Vendors', icon: Truck },
      { path: '/products', label: 'Products', icon: Tag },
      { path: '/expenses', label: 'Expenses', icon: Receipt, roles: ['Owner', 'Admin', 'Manager', 'Staff/Accountant'] },
      { path: '/bills', label: 'Bills', icon: Wallet, roles: ['Owner', 'Admin', 'Manager', 'Staff/Accountant'] },
      { path: '/vendor-payments', label: 'Vendor Payments', icon: Wallet, roles: ['Owner', 'Admin', 'Manager', 'Staff/Accountant'] },
      { path: '/inventory', label: 'Inventory', icon: Package },
      { path: '/receive-stock', label: 'Receive Stock', icon: ArrowDown, roles: ['Owner', 'Admin', 'Manager', 'Staff/Accountant'] },
    ]
  },
  {
    title: 'ACCOUNTING',
    items: [
      { path: '/receivables', label: 'Accts Receivable', icon: CurrencyDollar },
      { path: '/payables', label: 'Accts Payable', icon: Wallet },
      { path: '/chart-of-accounts', label: 'Chart of Accounts', icon: Notebook, roles: ['Owner', 'Admin', 'Manager', 'Staff/Accountant'] },
      { path: '/journal-entries', label: 'Journal Entries', icon: BookOpen, roles: ['Owner', 'Admin', 'Manager', 'Staff/Accountant'] },
      { path: '/general-ledger', label: 'General Ledger', icon: Scales },
      { path: '/trial-balance', label: 'Trial Balance', icon: ChartBar },
    ]
  },
  {
    title: 'TOOLS',
    items: [
      { path: '/reports', label: 'Reports', icon: ChartBar },
      { path: '/ai-assistant', label: 'AI Assistant', icon: Robot },
      { path: '/ai-import', label: 'AI Import Center', icon: UploadSimple, roles: ['Owner', 'Admin', 'Manager', 'Staff/Accountant'] },
      { path: '/settings', label: 'Settings', icon: Gear, roles: ['Owner', 'Admin'] },
    ]
  },
];

export default function Sidebar({ onClose }) {
  const { logout } = useAuth();
  const { clearCompany, role } = useCompany();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    clearCompany();
    await logout();
  };

  const handleNavClick = () => {
    if (onClose) onClose();
  };

  return (
    <aside
      data-testid="app-sidebar"
      className={`fixed inset-y-0 left-0 z-50 flex flex-col transition-all duration-200 ${collapsed ? 'w-[68px]' : 'w-64'}`}
      style={{ background: '#F2F4F6' }}
    >
      {/* Logo - fixed top */}
      <div className="flex-shrink-0 flex items-center justify-between h-14 px-4" style={{ borderBottom: '1px solid #E6E8EA' }}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>
              HN
            </div>
            <span className="font-semibold text-sm" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>
              Hishab Nikash
            </span>
          </div>
        )}
        {collapsed && (
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs mx-auto" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>
            HN
          </div>
        )}
        <button
          data-testid="sidebar-toggle"
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded hover:bg-[#E6E8EA] transition-colors"
          style={{ color: '#434655' }}
        >
          {collapsed ? <CaretRight size={14} /> : <CaretLeft size={14} />}
        </button>
      </div>

      {/* Scrollable Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2" style={{ scrollbarWidth: 'thin' }}>
        {navSections.map((section) => (
          <div key={section.title} className="mb-1">
            {!collapsed && (
              <div className="px-3 pt-3 pb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#434655', opacity: 0.5 }}>
                  {section.title}
                </span>
              </div>
            )}
            {collapsed && section.title !== 'MAIN' && (
              <div className="my-1 mx-3 h-px" style={{ background: '#E6E8EA' }} />
            )}
            <div className="flex flex-col gap-px">
              {section.items.filter((it) => !it.roles || it.roles.includes(role)).map(({ path, label, icon: Icon }) => {
                const isActive = location.pathname === path || location.pathname.startsWith(path + '/');
                return (
                  <NavLink
                    key={path}
                    to={path}
                    onClick={handleNavClick}
                    data-testid={`nav-${path.replace(/\//g, '').replace(/-/g, '')}`}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 ${collapsed ? 'justify-center' : ''}`}
                    style={{
                      background: isActive ? '#FFFFFF' : 'transparent',
                      color: isActive ? '#0F2D5C' : '#434655',
                      boxShadow: isActive ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                    }}
                    title={collapsed ? label : undefined}
                  >
                    <Icon size={18} weight={isActive ? 'fill' : 'regular'} className="flex-shrink-0" />
                    {!collapsed && <span className="truncate">{label}</span>}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom actions - fixed */}
      <div className="flex-shrink-0 px-2 pb-3 pt-2" style={{ borderTop: '1px solid #E6E8EA' }}>
        {role !== 'Viewer' && (
          <NavLink
            to="/sales/new"
            onClick={handleNavClick}
            data-testid="nav-new-transaction"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white transition-all ${collapsed ? 'justify-center' : ''}`}
            style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}
          >
            <Plus size={16} weight="bold" />
            {!collapsed && <span>New Transaction</span>}
          </NavLink>
        )}
        <button
          data-testid="nav-logout"
          onClick={handleLogout}
          className={`flex items-center gap-2.5 px-3 py-2 mt-1 rounded-lg text-[13px] w-full transition-colors hover:bg-[#E6E8EA] ${collapsed ? 'justify-center' : ''}`}
          style={{ color: '#BA1A1A' }}
        >
          <SignOut size={16} />
          {!collapsed && <span>Logout</span>}
        </button>
        {!collapsed && (
          <div className="mt-1 px-3 text-[9px] text-center" style={{ color: '#434655', opacity: 0.5 }}>
            Hishab Nikash Pro — Powered by iAlam
          </div>
        )}
      </div>
    </aside>
  );
}

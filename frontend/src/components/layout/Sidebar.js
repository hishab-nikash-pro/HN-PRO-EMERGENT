import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import {
  House, ShoppingCart, Users, Truck, Receipt, Package, Bank,
  CurrencyDollar, Wallet, ChartBar, Robot, Gear,
  Plus, Headset, SignOut, CaretLeft, CaretRight, Tag,
  Notebook, BookOpen, Scales, ArrowDown, UploadSimple, ClipboardText, MagnifyingGlass, ArrowsClockwise,
  ArrowsLeftRight, Trash, PlayCircle, Table
} from '@phosphor-icons/react';
import { useState } from 'react';

const navSections = [
  {
    title: 'MAIN',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: House },
      { path: '/transactions', label: 'Transactions', icon: Table },
    ]
  },
  {
    title: 'SALES',
    items: [
      { path: '/sales', label: 'Sales', icon: ShoppingCart },
      { path: '/customer-center', label: 'Customer Center', icon: Users },
      { path: '/credit-memos', label: 'Credit Memos', icon: Receipt, roles: ['OWNER', 'MANAGER', 'STAFF'] },
      { path: '/sales-orders', label: 'Sales Orders', icon: ClipboardText, roles: ['OWNER', 'MANAGER', 'STAFF'] },
      { path: '/estimates', label: 'Estimates', icon: BookOpen, roles: ['OWNER', 'MANAGER', 'STAFF'] },
      { path: '/customers', label: 'Customers', icon: Users },
      { path: '/customer-payments', label: 'Customer Payments', icon: CurrencyDollar, roles: ['OWNER', 'MANAGER', 'STAFF'] },
      { path: '/products', label: 'Products', icon: Tag },
    ]
  },
  {
    title: 'PURCHASES',
    items: [
      { path: '/vendor-center', label: 'Vendor Center', icon: Truck },
      { path: '/vendors', label: 'Vendors', icon: Truck },
      { path: '/expenses', label: 'Expenses', icon: Receipt, roles: ['OWNER', 'MANAGER', 'STAFF'] },
      { path: '/bills', label: 'Bills', icon: Wallet, roles: ['OWNER', 'MANAGER', 'STAFF'] },
      { path: '/purchase-orders', label: 'Purchase Orders', icon: ClipboardText, roles: ['OWNER', 'MANAGER', 'STAFF'] },
      { path: '/vendor-payments', label: 'Vendor Payments', icon: Wallet, roles: ['OWNER', 'MANAGER', 'STAFF'] },
      { path: '/receive-stock', label: 'Receive Stock', icon: ArrowDown, roles: ['OWNER', 'MANAGER', 'STAFF'] },
    ]
  },
  {
    title: 'ACCOUNTING',
    items: [
      { path: '/receivables', label: 'Accts Receivable', icon: CurrencyDollar },
      { path: '/payables', label: 'Accts Payable', icon: Wallet },
      { path: '/chart-of-accounts', label: 'Chart of Accounts', icon: Notebook, roles: ['OWNER', 'MANAGER', 'STAFF'] },
      { path: '/journal-entries', label: 'Journal Entries', icon: BookOpen, roles: ['OWNER', 'MANAGER', 'STAFF'] },
      { path: '/general-ledger', label: 'General Ledger', icon: Scales },
      { path: '/trial-balance', label: 'Trial Balance', icon: ChartBar },
      { path: '/customer-ledger', label: 'Customer Ledger', icon: BookOpen, roles: ['OWNER', 'MANAGER', 'STAFF'] },
      { path: '/vendor-ledger', label: 'Vendor Ledger', icon: Notebook, roles: ['OWNER', 'MANAGER', 'STAFF'] },
      { path: '/inventory', label: 'Inventory', icon: Package },
      { path: '/stock-transfers', label: 'Stock Transfers', icon: ArrowsLeftRight, roles: ['OWNER', 'MANAGER', 'STAFF'] },
    ]
  },
  {
    title: 'REPORTS',
    items: [
      { path: '/reports', label: 'Reports', icon: ChartBar },
      { path: '/bank-transactions', label: 'Bank Transactions', icon: Bank, roles: ['OWNER', 'MANAGER', 'STAFF'] },
      { path: '/bank-reconciliation', label: 'Bank Reconciliation', icon: Bank, roles: ['OWNER', 'MANAGER', 'STAFF'] },
      { path: '/audit-log', label: 'Audit Log', icon: MagnifyingGlass, roles: ['OWNER', 'MANAGER'] },
      { path: '/deleted-records', label: 'Deleted Records', icon: Trash, roles: ['OWNER'] },
      { path: '/recurring', label: 'Recurring', icon: ArrowsClockwise, roles: ['OWNER', 'MANAGER', 'STAFF'] },
      { path: '/app-guide', label: 'App Guide', icon: Headset, roles: ['OWNER', 'MANAGER', 'STAFF'] },
      { path: '/qa-agent', label: 'HNP QA Agent', icon: PlayCircle, roles: ['OWNER'] },
      { path: '/ai-assistant', label: 'AI Assistant', icon: Robot },
      { path: '/ai-import', label: 'AI Import Center', icon: UploadSimple, roles: ['OWNER', 'MANAGER', 'STAFF'] },
      { path: '/settings', label: 'Settings', icon: Gear, roles: ['OWNER'] },
    ]
  },
];

export default function Sidebar({ onClose, mobileMenuOpen }) {
  const { logout } = useAuth();
  const { role } = useCompany();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  const handleNavClick = () => {
    if (onClose) onClose();
  };

  return (
    <aside
      data-testid="app-sidebar"
      className={`fixed inset-y-0 left-0 z-50 flex flex-col transition-all duration-200 ${collapsed ? 'w-[68px]' : 'w-64'} ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      style={{ width: collapsed ? 68 : 'var(--hn-sidebar-width, 16rem)', background: '#F2F4F6', boxShadow: mobileMenuOpen ? '18px 0 40px rgba(15,45,92,0.18)' : 'none' }}
    >
      <div className="flex-shrink-0 flex items-center justify-between h-14 px-4" style={{ borderBottom: '1px solid #E6E8EA' }}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>
              HN
            </div>
            <span className="font-semibold text-sm" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>
              Hishab Nikash Pro
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
          className="hidden rounded p-1 transition-colors hover:bg-[#E6E8EA] lg:block"
          style={{ color: '#434655' }}
        >
          {collapsed ? <CaretRight size={14} /> : <CaretLeft size={14} />}
        </button>
        <button
          onClick={handleNavClick}
          className="rounded p-1 transition-colors hover:bg-[#E6E8EA] lg:hidden"
          style={{ color: '#434655' }}
        >
          <CaretLeft size={16} />
        </button>
      </div>

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
        {role !== 'VIEWER' && role !== '' && (
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
            Hishab Nikash Pro
          </div>
        )}
      </div>
    </aside>
  );
}

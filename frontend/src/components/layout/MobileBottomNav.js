import { NavLink, useNavigate } from 'react-router-dom';
import { Bank, DotsThree, Gear, House, Package, Receipt, SignOut, Truck, Users, ChartBar } from '@phosphor-icons/react';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const primaryItems = [
  { path: '/sales/new', label: 'Invoice', icon: Receipt },
  { path: '/customers', label: 'Customer', icon: Users },
  { path: '/dashboard', label: 'Dashboard', icon: House },
  { path: '/receive-stock', label: 'Receiving', icon: Truck },
  { path: '/products', label: 'Products', icon: Package },
];

export default function MobileBottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
  };

  const go = (path) => {
    setMoreOpen(false);
    navigate(path);
  };

  return (
    <>
      {moreOpen && (
        <div className="fixed inset-0 z-40 bg-black/20 lg:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute bottom-[82px] right-3 w-56 rounded-3xl bg-white p-2 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <button onClick={() => go('/reports')} className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold" style={{ color: '#0F172A' }}><ChartBar size={18} /> Reports</button>
            <button onClick={() => go('/settings')} className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold" style={{ color: '#0F172A' }}><Gear size={18} /> Settings</button>
            <button onClick={() => go('/bank-transactions')} className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold" style={{ color: '#0F172A' }}><Bank size={18} /> Bank</button>
            <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold" style={{ color: '#B91C1C' }}><SignOut size={18} /> Logout</button>
          </div>
        </div>
      )}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-14px_36px_rgba(15,45,92,0.12)] backdrop-blur lg:hidden" style={{ borderColor: '#E6E8EA' }}>
        <div className="mx-auto grid max-w-lg grid-cols-6 gap-1 py-2">
          {primaryItems.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              className="flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[10px] font-bold"
              style={({ isActive }) => ({
                background: isActive ? '#E6F3F5' : 'transparent',
                color: isActive ? '#0F2D5C' : '#475569',
              })}
            >
              <Icon size={20} />
              <span className="leading-none">{label}</span>
            </NavLink>
          ))}
          <button onClick={() => setMoreOpen((value) => !value)} className="flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[10px] font-bold" style={{ color: moreOpen ? '#0F2D5C' : '#475569', background: moreOpen ? '#E6F3F5' : 'transparent' }}>
            <DotsThree size={22} weight="bold" />
            <span className="leading-none">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}

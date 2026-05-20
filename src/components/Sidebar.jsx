import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Truck,
  BarChart3,
  Wrench,
  LogOut,
  Users,
  Receipt,
  Database,
} from 'lucide-react';
import Logo from './Logo';
import { useAuthStore } from '@/store/authStore';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/pos', icon: ShoppingCart, label: 'POS Billing' },
  { to: '/inventory', icon: Package, label: 'Inventory' },
  { to: '/purchases', icon: Truck, label: 'Purchases', adminOnly: true },
  { to: '/services', icon: Wrench, label: 'Services', adminOnly: true },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/customers', icon: Users, label: 'Customers' },
  { to: '/expenses', icon: Receipt, label: 'Expenses', adminOnly: true },
  { to: '/backup', icon: Database, label: 'Backup', adminOnly: true },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const { profile, signOut, isAdmin } = useAuthStore();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login/employee', { replace: true });
  };

  return (
    <aside className="w-64 min-h-screen bg-luxury-charcoal border-r border-luxury-border flex flex-col">
      <div className="p-6 border-b border-luxury-border">
        <Logo size="md" />
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label, adminOnly }) => {
          if (adminOnly && !isAdmin()) return null;
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  isActive
                    ? 'bg-gold-600/20 text-gold-400 border border-gold-600/30'
                    : 'text-gray-400 hover:text-gold-300 hover:bg-luxury-slate'
                }`
              }
            >
              <Icon size={20} />
              <span className="font-medium">{label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-luxury-border">
        <div className="px-4 py-2 mb-2">
          <p className="text-sm text-white font-medium truncate">{profile?.full_name}</p>
          <p className="text-xs text-gold-500 capitalize">{profile?.role}</p>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-4 py-3 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
        >
          <LogOut size={20} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}

import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Truck,
  BarChart3,
  CalendarClock,
  Wrench,
  LogOut,
  Users,
  Receipt,
  Database,
  ChevronsLeft,
  ChevronsRight,
  Settings,
  X,
  MessageCircle,
} from 'lucide-react';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from '@/lib/translations';

const navItems = [
  { to: '/', icon: LayoutDashboard, labelKey: 'dashboard' },
  { to: '/pos', icon: ShoppingCart, labelKey: 'posBilling' },
  { to: '/inventory', icon: Package, labelKey: 'inventory' },
  { to: '/purchases', icon: Truck, labelKey: 'purchases', adminOnly: true },
  { to: '/services', icon: Wrench, labelKey: 'services', adminOnly: true },
  { to: '/reports', icon: BarChart3, labelKey: 'reports' },
  { to: '/customers', icon: Users, labelKey: 'customers' },
  { to: '/bookings', icon: CalendarClock, labelKey: 'bookings' },
  { to: '/expenses', icon: Receipt, labelKey: 'expenses', adminOnly: true },
  { to: '/backup', icon: Database, labelKey: 'backup', adminOnly: true },
  { to: '/settings', icon: Settings, labelKey: 'settings' },
  { to: '/whatsapp', icon: MessageCircle, labelKey: 'whatsapp' },
];

export default function Sidebar({
  collapsed = false,
  onToggleCollapse,
  mobileOpen = false,
  onCloseMobile,
}) {
  const navigate = useNavigate();
  const { profile, signOut, isAdmin } = useAuthStore();
  const { t } = useTranslation();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login/employee', { replace: true });
  };

  const handleNavClick = () => {
    if (mobileOpen) onCloseMobile?.();
  };

  // Width: w-20 collapsed (desktop), w-64 expanded.
  const width = collapsed ? 'lg:w-20' : 'lg:w-64';

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          aria-hidden
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50 w-64 ${width}
          bg-luxury-charcoal border-r border-luxury-border
          flex flex-col transition-all duration-200
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
      >
        <div className="p-4 border-b border-luxury-border flex items-center justify-between gap-2">
          <div className="bg-white rounded-xl p-2 shadow-lg flex-1 flex justify-center">
            <Logo size={collapsed ? 'sm' : 'md'} />
          </div>
          <button
            type="button"
            aria-label="Close menu"
            onClick={onCloseMobile}
            className="lg:hidden p-2 text-luxury-muted hover:text-gold-300"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, labelKey, adminOnly }) => {
            if (adminOnly && !isAdmin()) return null;
            const label = t(labelKey);
            return (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                onClick={handleNavClick}
                title={collapsed ? label : undefined}
                aria-label={label}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${
                    isActive
                      ? 'bg-gold-600/20 text-gold-400 border border-gold-600/30'
                      : 'text-gray-400 hover:text-gold-300 hover:bg-luxury-slate border border-transparent'
                  } ${collapsed ? 'lg:justify-center' : ''}`
                }
              >
                <Icon size={20} className="shrink-0" />
                <span className={`font-medium ${collapsed ? 'lg:hidden' : ''}`}>{label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-3 border-t border-luxury-border">
          <div className={`px-3 py-2 mb-2 ${collapsed ? 'lg:hidden' : ''}`}>
            <p className="text-sm text-luxury-foreground font-medium truncate">{profile?.full_name}</p>
            <p className="text-xs text-gold-500 capitalize">{profile?.role}</p>
          </div>

          <ThemeToggle variant="sidebar" collapsed={collapsed} />

          <button
            type="button"
            onClick={handleSignOut}
            title={collapsed ? t('signOut') : undefined}
            aria-label={t('signOut')}
            className={`flex items-center gap-3 w-full px-3 py-3 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all ${
              collapsed ? 'lg:justify-center' : ''
            }`}
          >
            <LogOut size={20} className="shrink-0" />
            <span className={collapsed ? 'lg:hidden' : ''}>{t('signOut')}</span>
          </button>

          {/* Desktop collapse toggle */}
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden lg:flex items-center justify-center w-full mt-2 py-2 text-luxury-muted hover:text-gold-300 hover:bg-luxury-slate rounded-lg transition-all"
          >
            {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          </button>
        </div>
      </aside>
    </>
  );
}

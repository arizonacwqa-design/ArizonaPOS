import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import Logo from './Logo';
import { useAuthStore } from '@/store/authStore';
import { runAutoBackupIfDue, shouldRunAutoBackup } from '@/lib/backup';

const COLLAPSE_KEY = 'acw_sidebar_collapsed';

export default function Layout() {
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const location = useLocation();

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapse = () => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0'); } catch {}
      return next;
    });
  };

  // Close mobile drawer when route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Lock body scroll while mobile drawer is open.
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [mobileOpen]);

  useEffect(() => {
    if (isAdmin() && shouldRunAutoBackup()) {
      const ok = window.confirm(
        'Daily backup recommended. Export a backup of your database now?'
      );
      if (ok) runAutoBackupIfDue(true);
    }
  }, [isAdmin]);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 bg-luxury-black">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center justify-between gap-3 px-4 py-3 bg-luxury-charcoal border-b border-luxury-border sticky top-0 z-30">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
            className="p-2 -ml-2 text-gold-400 hover:bg-luxury-slate rounded-lg"
          >
            <Menu size={24} />
          </button>
          <div className="bg-white rounded-lg p-1.5">
            <Logo size="sm" />
          </div>
          <div className="w-10" aria-hidden />
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

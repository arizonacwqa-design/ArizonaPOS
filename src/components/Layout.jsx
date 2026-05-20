import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuthStore } from '@/store/authStore';
import { runAutoBackupIfDue, shouldRunAutoBackup } from '@/lib/backup';

export default function Layout() {
  const isAdmin = useAuthStore((s) => s.isAdmin);

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
      <Sidebar />
      <main className="flex-1 overflow-auto bg-luxury-black">
        <Outlet />
      </main>
    </div>
  );
}

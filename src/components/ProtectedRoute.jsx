import { Navigate, Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, profile, loading } = useAuthStore();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-luxury-black">
        <p className="text-gold-400 animate-pulse">Loading session...</p>
      </div>
    );
  }

  if (!user || !profile) {
    window.location.hash = '#/login/employee';
    return null;
  }

  if (adminOnly && profile.role !== 'admin') {
    return (
      <div className="p-8">
        <div className="card-luxury max-w-lg border-amber-600/30">
          <h2 className="text-gold-400 font-semibold text-lg">Employee access</h2>
          <p className="text-luxury-muted mt-2 text-sm">
            This section is for admins only. You can use POS Billing, Dashboard, Inventory (view),
            Reports, and Customer History.
          </p>
          <Link to="/" className="btn-gold inline-block mt-4 text-sm">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return children;
}

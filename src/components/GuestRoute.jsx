import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

export default function GuestRoute({ children }) {
  const { user, loading } = useAuthStore();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-luxury-black">
        <p className="text-gold-400 animate-pulse">Loading...</p>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return children;
}

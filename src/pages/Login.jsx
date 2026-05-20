import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Shield, User } from 'lucide-react';
import Logo from '@/components/Logo';
import { useAuthStore } from '@/store/authStore';
import { getAuthErrorMessage } from '@/lib/authErrors';
import { isSupabaseConfigured } from '@/lib/supabase';

const LOGIN_MODES = {
  admin: {
    title: 'Admin Login',
    description: 'Manage inventory, purchases, and reports.',
    expectedRole: 'admin',
    icon: Shield,
  },
  employee: {
    title: 'Employee Login',
    description: 'Process sales and view inventory.',
    expectedRole: 'employee',
    icon: User,
  },
};

export default function Login() {
  const { role: roleParam } = useParams();
  const mode = roleParam === 'admin' ? 'admin' : 'employee';
  const config = LOGIN_MODES[mode];
  const ModeIcon = config.icon;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const signIn = useAuthStore((s) => s.signIn);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email.trim(), password, config.expectedRole);
      navigate('/', { replace: true });
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-luxury-black relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-gold-900/10 via-transparent to-gold-600/5" />

      <div className="card-luxury w-full max-w-md mx-4 relative z-10 shadow-gold">
        <div className="flex justify-center mb-6">
          <Logo size="lg" />
        </div>

        <div className="flex rounded-lg border border-luxury-border overflow-hidden mb-6">
          <Link
            to="/login/employee"
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-all ${
              mode === 'employee'
                ? 'bg-gold-600/20 text-gold-400'
                : 'text-gray-400 hover:text-gold-300 hover:bg-luxury-slate'
            }`}
          >
            <User size={18} />
            Employee
          </Link>
          <Link
            to="/login/admin"
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-all ${
              mode === 'admin'
                ? 'bg-gold-600/20 text-gold-400'
                : 'text-gray-400 hover:text-gold-300 hover:bg-luxury-slate'
            }`}
          >
            <Shield size={18} />
            Admin
          </Link>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-gold-600/15 border border-gold-600/30">
            <ModeIcon className="text-gold-400" size={22} />
          </div>
          <div>
            <h2 className="text-xl font-display text-gold-400">{config.title}</h2>
            <p className="text-xs text-luxury-muted">{config.description}</p>
          </div>
        </div>

        {!isSupabaseConfigured && (
          <p className="text-amber-400 text-sm bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2 mb-4">
            Supabase is not configured. Copy <code className="text-amber-200">.env.example</code> to{' '}
            <code className="text-amber-200">.env</code> and add your project URL and anon key.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label-luxury">Email</label>
            <input
              type="email"
              className="input-luxury"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@arizonacarworld.com"
              autoComplete="email"
              required
              disabled={loading}
            />
          </div>
          <div>
            <label className="label-luxury">Password</label>
            <input
              type="password"
              className="input-luxury"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              disabled={loading}
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn-gold w-full mt-2"
            disabled={loading || !isSupabaseConfigured}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-luxury-muted text-xs mt-6">
          Secure login powered by Supabase · Session saved on this device
        </p>
      </div>
    </div>
  );
}

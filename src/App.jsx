import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppRouter from '@/components/AppRouter';
import { useAuthStore } from '@/store/authStore';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import GuestRoute from '@/components/GuestRoute';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import POS from '@/pages/POS';
import Inventory from '@/pages/Inventory';
import Purchases from '@/pages/Purchases';
import Reports from '@/pages/Reports';
import Services from '@/pages/Services';
import Expenses from '@/pages/Expenses';
import Customers from '@/pages/Customers';
import Backup from '@/pages/Backup';

export default function App() {
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <AppRouter>
      <Routes>
        <Route path="/login" element={<Navigate to="/login/employee" replace />} />
        <Route
          path="/login/:role"
          element={
            <GuestRoute>
              <Login />
            </GuestRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="pos" element={<POS />} />
          <Route path="inventory" element={<Inventory />} />
          <Route
            path="purchases"
            element={
              <ProtectedRoute adminOnly>
                <Purchases />
              </ProtectedRoute>
            }
          />
          <Route
            path="services"
            element={
              <ProtectedRoute adminOnly>
                <Services />
              </ProtectedRoute>
            }
          />
          <Route path="reports" element={<Reports />} />
          <Route path="customers" element={<Customers />} />
          <Route
            path="expenses"
            element={
              <ProtectedRoute adminOnly>
                <Expenses />
              </ProtectedRoute>
            }
          />
          <Route
            path="backup"
            element={
              <ProtectedRoute adminOnly>
                <Backup />
              </ProtectedRoute>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppRouter>
  );
}

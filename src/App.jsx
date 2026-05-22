import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import AppRouter from './components/AppRouter';
import ProtectedRoute from './components/ProtectedRoute';
import GuestRoute from './components/GuestRoute';
import Layout from './components/Layout';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Inventory from './pages/Inventory';
import Purchases from './pages/Purchases';
import Reports from './pages/Reports';
import Services from './pages/Services';
import Customers from './pages/Customers';
import Backup from './pages/Backup';
import Settings from './pages/Settings';

import { useAuthStore } from './store/authStore';

export default function App() {
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <AppRouter>
      <Routes>

        <Route
          path="/login"
          element={<Navigate to="/login/employee" replace />}
        />

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

          <Route path="reports" element={<Reports />} />

          <Route path="services" element={<Services />} />

          <Route path="customers" element={<Customers />} />

          <Route
            path="backup"
            element={
              <ProtectedRoute adminOnly>
                <Backup />
              </ProtectedRoute>
            }
          />

          <Route path="settings" element={<Settings />} />

        </Route>

      </Routes>
    </AppRouter>
  );
}
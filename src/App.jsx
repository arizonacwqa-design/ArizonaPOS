import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import ErrorBoundary from './ErrorBoundary';
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
import Bookings from './pages/Bookings';
import Backup from './pages/Backup';
import Settings from './pages/Settings';
import Expenses from './pages/Expenses';
import Website from './pages/Website';
import WhatsAppMonitor from './pages/WhatsAppMonitor';

import { useAuthStore } from './store/authStore';

export default function App() {
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <ErrorBoundary>
      <AppRouter>
        <Routes>

          <Route path="/website" element={<ErrorBoundary><Website /></ErrorBoundary>} />

          <Route
            path="/login"
            element={<Navigate to="/login/employee" replace />}
          />

          <Route
            path="/login/:role"
            element={
              <GuestRoute>
                <ErrorBoundary><Login /></ErrorBoundary>
              </GuestRoute>
            }
          />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <ErrorBoundary><Layout /></ErrorBoundary>
              </ProtectedRoute>
            }
          >

            <Route index element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />

            <Route path="pos" element={<ErrorBoundary><POS /></ErrorBoundary>} />

            <Route path="inventory" element={<ErrorBoundary><Inventory /></ErrorBoundary>} />

            <Route
              path="purchases"
              element={
                <ProtectedRoute adminOnly>
                  <ErrorBoundary><Purchases /></ErrorBoundary>
                </ProtectedRoute>
              }
            />

            <Route path="reports" element={<ErrorBoundary><Reports /></ErrorBoundary>} />

            <Route path="services" element={<ErrorBoundary><Services /></ErrorBoundary>} />

            <Route path="customers" element={<ErrorBoundary><Customers /></ErrorBoundary>} />

            <Route path="bookings" element={<ErrorBoundary><Bookings /></ErrorBoundary>} />

            <Route
              path="backup"
              element={
                <ProtectedRoute adminOnly>
                  <ErrorBoundary><Backup /></ErrorBoundary>
                </ProtectedRoute>
              }
            />

            <Route
              path="expenses"
              element={
                <ProtectedRoute adminOnly>
                  <ErrorBoundary><Expenses /></ErrorBoundary>
                </ProtectedRoute>
              }
            />

            <Route path="settings" element={<ErrorBoundary><Settings /></ErrorBoundary>} />

            <Route path="whatsapp" element={<ErrorBoundary><WhatsAppMonitor /></ErrorBoundary>} />

          </Route>

          {/* Catch-all so unknown URLs go home instead of showing a blank screen */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </AppRouter>
    </ErrorBoundary>
  );
}

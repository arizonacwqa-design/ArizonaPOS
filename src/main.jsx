import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './ErrorBoundary';
import LicenseGate from './components/LicenseGate';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <LicenseGate>
        <App />
      </LicenseGate>
    </ErrorBoundary>
  </React.StrictMode>
);

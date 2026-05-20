import { BrowserRouter, HashRouter } from 'react-router-dom';

/**
 * Packaged Electron loads the UI via file:// — BrowserRouter breaks (blank screen).
 * HashRouter uses #/paths and works for both dev (localhost) and production (file).
 */
const Router =
  typeof window !== 'undefined' && window.electronAPI?.isElectron
    ? HashRouter
    : BrowserRouter;

export default function AppRouter({ children }) {
  return <Router>{children}</Router>;
}

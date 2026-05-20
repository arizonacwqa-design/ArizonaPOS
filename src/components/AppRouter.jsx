import { HashRouter } from 'react-router-dom';

export default function AppRouter({ children }) {
  return <HashRouter>{children}</HashRouter>;
}
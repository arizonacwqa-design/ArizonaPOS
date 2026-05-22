import { Sun, Moon } from 'lucide-react';
import { useThemeStore } from '@/store/themeStore';

/**
 * Theme toggle button.
 *
 * variant="sidebar" — full-width row that fits the sidebar footer style.
 * variant="icon"    — compact circular icon button for the login screen / top bars.
 */
export default function ThemeToggle({ variant = 'icon', collapsed = false, className = '' }) {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const isDark = theme === 'dark';
  const Icon = isDark ? Sun : Moon;
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';

  if (variant === 'sidebar') {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        title={label}
        className={`flex items-center gap-3 w-full px-3 py-3 text-luxury-muted hover:text-gold-300 hover:bg-luxury-slate rounded-lg transition-all ${
          collapsed ? 'lg:justify-center' : ''
        } ${className}`}
      >
        <Icon size={20} className="shrink-0" />
        <span className={collapsed ? 'lg:hidden' : ''}>
          {isDark ? 'Light Mode' : 'Dark Mode'}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`p-2 rounded-lg text-luxury-muted hover:text-gold-300 hover:bg-luxury-slate border border-luxury-border transition-all ${className}`}
    >
      <Icon size={18} />
    </button>
  );
}

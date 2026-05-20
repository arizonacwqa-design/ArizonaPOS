import { Link } from 'react-router-dom';
import { AlertTriangle, X } from 'lucide-react';
import { formatStock } from '@/lib/format';

export default function LowStockBanner({ items, onDismiss }) {
  if (!items?.length) return null;

  return (
    <div className="mb-6 rounded-xl border border-red-500/40 bg-red-950/30 p-4 animate-slide-up">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={22} />
          <div>
            <p className="font-semibold text-red-300">
              Low stock alert — {items.length} item{items.length > 1 ? 's' : ''} need restocking
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {items.slice(0, 5).map((item) => (
                <li
                  key={item.id}
                  className="text-xs bg-red-500/15 border border-red-500/25 rounded-lg px-2 py-1 text-red-200"
                >
                  {item.name}: {formatStock(item)}
                </li>
              ))}
              {items.length > 5 && (
                <li className="text-xs text-red-300/80 self-center">+{items.length - 5} more</li>
              )}
            </ul>
            <Link to="/inventory" className="text-xs text-gold-400 hover:text-gold-300 mt-2 inline-block">
              View inventory →
            </Link>
          </div>
        </div>
        {onDismiss && (
          <button type="button" onClick={onDismiss} className="text-luxury-muted hover:text-white p-1">
            <X size={18} />
          </button>
        )}
      </div>
    </div>
  );
}

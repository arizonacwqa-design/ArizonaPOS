import { useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { searchCustomers } from '@/lib/customers';
import { formatCurrency } from '@/lib/format';

export default function CustomerAutocomplete({ value, onSelect, onChange }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const q = value?.customer_name?.trim();
    if (!q || q.length < 2) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      const list = await searchCustomers(q);
      setSuggestions(list);
      setOpen(list.length > 0);
    }, 300);
    return () => clearTimeout(t);
  }, [value?.customer_name]);

  function pick(c) {
    onSelect({
      customer_name: c.full_name,
      customer_phone: c.phone || '',
      car_model: value?.car_model || '',
      car_plate: value?.car_plate || '',
    });
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        className="input-luxury"
        value={value?.customer_name || ''}
        onChange={(e) => onChange({ ...value, customer_name: e.target.value })}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder="Full name (type to search past customers)"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full rounded-lg border border-gold-600/30 bg-luxury-charcoal shadow-card max-h-48 overflow-y-auto">
          {suggestions.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="w-full text-left px-4 py-3 hover:bg-gold-600/10 flex items-center gap-3 transition-colors"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(c)}
              >
                <User size={16} className="text-gold-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{c.full_name}</p>
                  <p className="text-xs text-luxury-muted">
                    {c.phone || 'No phone'} · {c.visit_count} visits · {formatCurrency(c.total_spent)}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

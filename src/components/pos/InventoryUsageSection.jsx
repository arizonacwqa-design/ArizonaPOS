import { Ruler, Boxes } from 'lucide-react';
import { formatStock } from '@/lib/format';
import { groupInventoryByType } from '@/lib/pos';

export default function InventoryUsageSection({ inventory, onAdd, selectedIds = [] }) {
  const { meter, quantity } = groupInventoryByType(inventory);

  return (
    <div className="p-5 space-y-5 animate-fade-in">
      {meter.length > 0 && (
        <div>
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold-400 mb-3">
            <Ruler size={14} />
            Meter stock — PPF & tint rolls
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {meter.map((item) => (
              <InventoryChip
                key={item.id}
                item={item}
                onAdd={onAdd}
                selected={selectedIds.includes(item.id)}
              />
            ))}
          </div>
        </div>
      )}

      {quantity.length > 0 && (
        <div>
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold-400 mb-3">
            <Boxes size={14} />
            Quantity — shampoo, polish, bottles, chemicals
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {quantity.map((item) => (
              <InventoryChip
                key={item.id}
                item={item}
                onAdd={onAdd}
                selected={selectedIds.includes(item.id)}
              />
            ))}
          </div>
        </div>
      )}

      {meter.length === 0 && quantity.length === 0 && (
        <p className="text-sm text-luxury-muted text-center py-4">
          No inventory items. Add stock in Inventory page first.
        </p>
      )}
    </div>
  );
}

function InventoryChip({ item, onAdd, selected }) {
  return (
    <button
      type="button"
      onClick={() => onAdd(item)}
      className={`text-left rounded-xl border px-3 py-2.5 transition-all hover:scale-[1.02] ${
        selected
          ? 'border-gold-500 bg-gold-600/15 shadow-gold'
          : 'border-luxury-border bg-luxury-black/50 hover:border-amber-600/40'
      }`}
    >
      <p className="font-medium text-sm truncate">{item.name}</p>
      <p className="text-xs text-luxury-muted mt-0.5">{formatStock(item)} in stock</p>
      <p className="text-[10px] text-amber-400/80 mt-1">Tap to add usage</p>
    </button>
  );
}

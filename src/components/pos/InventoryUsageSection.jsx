import { useState } from 'react';
import { Ruler, Boxes, Search, CheckCircle } from 'lucide-react';
import { formatStock } from '@/lib/format';
import { groupInventoryByType } from '@/lib/pos';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { getProductByBarcode } from '@/lib/productService';

export default function InventoryUsageSection({ inventory, onAdd, selectedIds = [] }) {
  const [search, setSearch] = useState('');
  const [scanMsg, setScanMsg] = useState('');

  const filtered = search.trim()
    ? inventory.filter((i) => i.name.toLowerCase().includes(search.trim().toLowerCase()))
    : inventory;
  const { meter, quantity } = groupInventoryByType(filtered);

  useBarcodeScanner(async (barcode) => {
    const product = await getProductByBarcode(barcode);
    if (product) {
      onAdd(product);
      setSearch('');
      setScanMsg(`Added: ${product.name}`);
    } else {
      setScanMsg(`Not found: ${barcode}`);
    }
    setTimeout(() => setScanMsg(''), 3000);
  });

  function handleAdd(item) {
    onAdd(item);
    setSearch('');
    setScanMsg('');
  }

  return (
    <div className="p-5 space-y-5 animate-fade-in">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-luxury-muted" size={16} />
        <input
          className="input-luxury pl-9 py-2 text-sm"
          placeholder="Search by name or scan barcode..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {scanMsg && (
        <p className={`flex items-center gap-1 text-sm ${scanMsg.startsWith('Added') ? 'text-green-400' : 'text-red-400'}`}>
          {scanMsg.startsWith('Added') && <CheckCircle size={14} />}
          {scanMsg}
        </p>
      )}

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
                onAdd={handleAdd}
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
                onAdd={handleAdd}
                selected={selectedIds.includes(item.id)}
              />
            ))}
          </div>
        </div>
      )}

      {meter.length === 0 && quantity.length === 0 && (
        <p className="text-sm text-luxury-muted text-center py-4">
          {search.trim() ? 'No matching items. Try a different name or scan barcode.' : 'No inventory items. Add stock in Inventory page first.'}
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

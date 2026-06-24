import { useEffect, useState } from 'react';
import { Plus, AlertTriangle, Pencil, Search, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { formatStock, isLowStock } from '@/lib/format';
import InventoryAddForm from '@/components/InventoryAddForm';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { getProductByBarcode } from '@/lib/productService';

export default function Inventory() {
  const isAdmin = useAuthStore((s) => s.isAdmin());
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [formMode, setFormMode] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchText, setSearchText] = useState('');
  const [highlightedId, setHighlightedId] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);

  useBarcodeScanner(async (barcode) => {
    const product = await getProductByBarcode(barcode);
    if (product) {
      setHighlightedId(product.id);
      setTimeout(() => setHighlightedId(null), 3000);
    } else {
      setMessage(`No product found with barcode: ${barcode}`);
      setTimeout(() => setMessage(''), 3000);
    }
  });

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    setLoading(true);
    setLoadError('');
    const { data, error } = await supabase.from('inventory_items').select('*').order('name');
    if (error) {
      setLoadError(error.message);
      setItems([]);
    } else {
      setItems(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  }

  function openNew() {
    setEditingItem(null);
    setFormMode('add');
  }

  function openEdit(item) {
    setEditingItem(item);
    setFormMode('edit');
  }

  function closeForm() {
    setFormMode(null);
    setEditingItem(null);
  }

  function handleFormSuccess(msg) {
    setMessage(msg);
    closeForm();
    loadItems();
  }

  const filtered =
    filter === 'all'
      ? items
      : filter === 'low'
        ? items.filter(isLowStock)
        : items.filter((i) => i.stock_type === filter);
  const dropdownItems = searchText.trim()
    ? items.filter((i) =>
        i.name.toLowerCase().includes(searchText.trim().toLowerCase()) ||
        (i.barcode && i.barcode.includes(searchText.trim()))
      )
    : [];

  const meterItems = items.filter((i) => i.stock_type === 'meter');
  const qtyItems = items.filter((i) => i.stock_type === 'quantity');

  return (
    <div className="p-4 sm:p-6 lg:p-8 animate-fade-in">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-gold-400">Inventory</h1>
          <p className="text-luxury-muted">
            Meter: PPF & Tint rolls · Quantity: shampoo, polish, chemicals, bottles, lighters
          </p>
        </div>
        {isAdmin && !formMode && (
          <button type="button" onClick={openNew} className="btn-gold flex items-center gap-2">
            <Plus size={18} />
            Add Item
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="card-luxury">
          <h3 className="text-gold-400 font-semibold mb-2">Meter Stock (PPF / Tint)</h3>
          <p className="text-2xl font-bold">{meterItems.length} items</p>
          <p className="text-sm text-luxury-muted">
            Total: {meterItems.reduce((s, i) => s + Number(i.current_stock), 0).toFixed(1)}m
          </p>
        </div>
        <div className="card-luxury">
          <h3 className="text-gold-400 font-semibold mb-2">Quantity Stock</h3>
          <p className="text-2xl font-bold">{qtyItems.length} items</p>
          <p className="text-sm text-luxury-muted">
            Shampoo, polish, detergents, bottles, lighters, chemicals
          </p>
        </div>
      </div>

      {formMode && isAdmin && (
        <InventoryAddForm
          key={formMode === 'edit' ? editingItem?.id : 'new'}
          mode={formMode}
          item={editingItem}
          onSuccess={handleFormSuccess}
          onCancel={closeForm}
        />
      )}

      {loadError && (
        <p className="mb-4 text-sm text-red-400">Could not load inventory: {loadError}</p>
      )}

      {message && !formMode && (
        <p
          className={`mb-4 text-sm ${
            message.includes('added') || message.includes('updated')
              ? 'text-green-400'
              : 'text-red-400'
          }`}
        >
          {message}
        </p>
      )}

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-luxury-muted" size={18} />
        <input
          className="input-luxury pl-10 pr-10"
          placeholder="Search by name or barcode..."
          value={searchText}
          onChange={(e) => { setSearchText(e.target.value); setShowDropdown(true); }}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
        />
        {searchText && (
          <button
            type="button"
            onClick={() => { setSearchText(''); setShowDropdown(false); setHighlightedId(null); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-luxury-muted hover:text-gold-300"
          >
            <X size={18} />
          </button>
        )}
        {showDropdown && dropdownItems.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-xl border border-luxury-border bg-luxury-charcoal shadow-lg max-h-60 overflow-y-auto">
            {dropdownItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onMouseDown={() => {
                  setHighlightedId(item.id);
                  setSearchText('');
                  setShowDropdown(false);
                  setTimeout(() => setHighlightedId(null), 3000);
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-gold-600/15 hover:text-gold-300 border-b border-luxury-border/50 last:border-b-0 flex items-center justify-between"
              >
                <div>
                  <span className="font-medium">{item.name}</span>
                  <span className="text-luxury-muted ml-2 text-xs">{item.barcode ? `[${item.barcode}]` : ''}</span>
                </div>
                <span className="text-gold-400 text-xs">{formatStock(item)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {['all', 'meter', 'quantity', 'low'].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm capitalize ${
              filter === f
                ? 'bg-gold-600/20 text-gold-400 border border-gold-600/30'
                : 'bg-luxury-slate text-gray-400'
            }`}
          >
            {f === 'low' ? 'Low Stock' : f}
          </button>
        ))}
      </div>

      <div className="card-luxury overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-luxury-muted border-b border-luxury-border">
              <th className="text-left py-3 px-2">Item</th>
              <th className="text-left py-3 px-2">Category</th>
              <th className="text-left py-3 px-2">Type</th>
              <th className="text-right py-3 px-2">Stock</th>
              <th className="text-right py-3 px-2">Alert At</th>
              <th className="text-center py-3 px-2">Status</th>
              {isAdmin && <th className="text-right py-3 px-2">Edit</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={isAdmin ? 7 : 6} className="py-8 text-center text-luxury-muted">
                  Loading inventory…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 7 : 6} className="py-8 text-center text-luxury-muted">
                  {items.length === 0
                    ? 'No inventory items yet. Admins can click “Add Item” to create the first one.'
                    : 'No items match this filter.'}
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.id} className={`border-b border-luxury-border/50 ${item.id === highlightedId ? 'bg-gold-600/20 border-gold-500' : ''}`}>
                  <td className="py-3 px-2 font-medium">{item.name ?? '—'}</td>
                  <td className="py-3 px-2 text-luxury-muted">{item.category ?? '—'}</td>
                  <td className="py-3 px-2 capitalize">{item.stock_type ?? '—'}</td>
                  <td className="py-3 px-2 text-right text-gold-400">{formatStock(item)}</td>
                  <td className="py-3 px-2 text-right text-luxury-muted">
                    {item.low_stock_threshold ?? '—'}
                    {item.stock_type === 'meter' ? 'm' : ` ${item.unit_label || 'pcs'}`}
                  </td>
                  <td className="py-3 px-2 text-center">
                    {isLowStock(item) ? (
                      <span className="inline-flex items-center gap-1 text-red-400 text-xs">
                        <AlertTriangle size={14} /> Low
                      </span>
                    ) : (
                      <span className="text-green-400 text-xs">OK</span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="py-3 px-2 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="text-gold-400 hover:text-gold-300"
                      >
                        <Pencil size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

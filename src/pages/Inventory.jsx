import { useEffect, useState } from 'react';
import { Plus, AlertTriangle, Pencil } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { formatStock, isLowStock } from '@/lib/format';
import InventoryAddForm from '@/components/InventoryAddForm';

export default function Inventory() {
  const isAdmin = useAuthStore((s) => s.isAdmin());
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [formMode, setFormMode] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

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

  const meterItems = items.filter((i) => i.stock_type === 'meter');
  const qtyItems = items.filter((i) => i.stock_type === 'quantity');

  return (
    <div className="p-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display text-gold-400">Inventory</h1>
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
                <tr key={item.id} className="border-b border-luxury-border/50">
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

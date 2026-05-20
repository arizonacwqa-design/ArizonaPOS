import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { formatCurrency } from '@/lib/format';
import { SERVICE_CATEGORIES } from '@/lib/constants';

const emptyForm = {
  name: '',
  price: '',
  category: 'Detailing',
  inventory_item_id: '',
  consumption_per_unit: 0,
  is_active: true,
};

export default function Services() {
  const isAdmin = useAuthStore((s) => s.isAdmin());
  const [services, setServices] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [svc, inv] = await Promise.all([
      supabase
        .from('services')
        .select('*, inventory_item:inventory_items(id, name, stock_type)')
        .order('name'),
      supabase.from('inventory_items').select('id, name, stock_type').order('name'),
    ]);
    setServices(svc.data || []);
    setInventory(inv.data || []);
  }

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(s) {
    setEditingId(s.id);
    setForm({
      name: s.name,
      price: s.price,
      category: s.category || 'Detailing',
      inventory_item_id: s.inventory_item_id || '',
      consumption_per_unit: s.consumption_per_unit || 0,
      is_active: s.is_active,
    });
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isAdmin) return;

    const payload = {
      name: form.name.trim(),
      price: Number(form.price) || 0,
      category: form.category,
      inventory_item_id: form.inventory_item_id || null,
      consumption_per_unit: Number(form.consumption_per_unit) || 0,
      is_active: form.is_active,
    };

    const { error } = editingId
      ? await supabase.from('services').update(payload).eq('id', editingId)
      : await supabase.from('services').insert(payload);

    if (error) {
      setMessage(error.message);
    } else {
      setMessage(editingId ? 'Service updated' : 'Service added');
      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
      load();
    }
  }

  async function handleDelete(id) {
    if (!isAdmin || !confirm('Deactivate this service?')) return;
    await supabase.from('services').update({ is_active: false }).eq('id', id);
    load();
  }

  if (!isAdmin) {
    return (
      <div className="p-8">
        <p className="text-red-400">Only admins can manage services.</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <header className="mb-6 flex flex-wrap justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display text-gold-400">Services Catalog</h1>
          <p className="text-luxury-muted">
            POS services, prices, and auto stock deduction links
          </p>
        </div>
        <button type="button" onClick={openNew} className="btn-gold flex items-center gap-2">
          <Plus size={18} />
          Add Service
        </button>
      </header>

      {showForm && (
        <form onSubmit={handleSubmit} className="card-luxury mb-6">
          <h2 className="text-lg text-gold-400 mb-4">
            {editingId ? 'Edit Service' : 'New Service'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label-luxury">Service Name</label>
              <input
                className="input-luxury"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label-luxury">Price (QAR)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="input-luxury"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label-luxury">Category</label>
              <select
                className="input-luxury"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {SERVICE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label-luxury">Link Inventory (auto deduct on sale)</label>
              <select
                className="input-luxury"
                value={form.inventory_item_id}
                onChange={(e) => setForm({ ...form, inventory_item_id: e.target.value })}
              >
                <option value="">None — no stock deduction</option>
                {inventory.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.stock_type})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-luxury">Usage per qty sold</label>
              <input
                type="number"
                min="0"
                step="0.1"
                className="input-luxury"
                value={form.consumption_per_unit}
                onChange={(e) =>
                  setForm({ ...form, consumption_per_unit: e.target.value })
                }
                placeholder="e.g. 2 meters for PPF"
              />
              <p className="text-xs text-luxury-muted mt-1">
                Meters or pcs removed × cart quantity
              </p>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button type="submit" className="btn-gold">
              Save
            </button>
            <button
              type="button"
              className="btn-outline"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {message && <p className="text-green-400 mb-4">{message}</p>}

      <div className="card-luxury overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-luxury-muted border-b border-luxury-border">
              <th className="text-left py-3 px-2">Service</th>
              <th className="text-left py-3 px-2">Category</th>
              <th className="text-right py-3 px-2">Price</th>
              <th className="text-left py-3 px-2">Stock Link</th>
              <th className="text-center py-3 px-2">Active</th>
              <th className="text-right py-3 px-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id} className="border-b border-luxury-border/50">
                <td className="py-3 px-2 font-medium">{s.name}</td>
                <td className="py-3 px-2 text-luxury-muted">{s.category}</td>
                <td className="py-3 px-2 text-right text-gold-400">
                  {formatCurrency(s.price)}
                </td>
                <td className="py-3 px-2 text-luxury-muted text-xs">
                  {s.inventory_item
                    ? `${s.inventory_item.name} (−${s.consumption_per_unit}/qty)`
                    : '—'}
                </td>
                <td className="py-3 px-2 text-center">
                  {s.is_active ? (
                    <span className="text-green-400">Yes</span>
                  ) : (
                    <span className="text-gray-500">No</span>
                  )}
                </td>
                <td className="py-3 px-2 text-right">
                  <button
                    type="button"
                    onClick={() => openEdit(s)}
                    className="text-gold-400 hover:text-gold-300 p-1 inline-flex"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(s.id)}
                    className="text-red-400 hover:text-red-300 p-1 inline-flex ml-1"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

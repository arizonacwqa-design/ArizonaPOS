import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { formatCurrency, formatDate, formatStock } from '@/lib/format';
import { startOfMonth } from 'date-fns';

export default function Purchases() {
  const { user } = useAuthStore();
  const [items, setItems] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [monthExpense, setMonthExpense] = useState(0);
  const [form, setForm] = useState({
    bill_number: '',
    supplier_name: '',
    purchase_date: new Date().toISOString().split('T')[0],
    inventory_item_id: '',
    quantity_added: 0,
    meters_added: 0,
    unit_cost: 0,
    notes: '',
  });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const monthStart = startOfMonth(new Date()).toISOString().split('T')[0];
    const [itemsRes, purchasesRes] = await Promise.all([
      supabase.from('inventory_items').select('*').order('name'),
      supabase
        .from('inventory_purchases')
        .select('*, inventory_items(name, stock_type, unit_label)')
        .order('created_at', { ascending: false })
        .limit(100),
    ]);
    setItems(itemsRes.data || []);
    const list = purchasesRes.data || [];
    setPurchases(list);
    const expense = list
      .filter((p) => p.purchase_date >= monthStart)
      .reduce((sum, p) => sum + Number(p.total_cost || 0), 0);
    setMonthExpense(expense);
  }

  const selectedItem = items.find((i) => i.id === form.inventory_item_id);
  const qtyAdded =
    selectedItem?.stock_type === 'meter'
      ? Number(form.meters_added) || 0
      : Number(form.quantity_added) || 0;
  const estimatedTotal = qtyAdded * (Number(form.unit_cost) || 0);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.inventory_item_id || !form.supplier_name.trim()) {
      setMessage('Select item and enter supplier name');
      return;
    }
    if (qtyAdded <= 0) {
      setMessage('Enter quantity or meters added');
      return;
    }

    setLoading(true);
    const payload = {
      bill_number: form.bill_number.trim() || null,
      supplier_name: form.supplier_name.trim(),
      purchase_date: form.purchase_date,
      inventory_item_id: form.inventory_item_id,
      quantity_added: selectedItem?.stock_type === 'quantity' ? qtyAdded : 0,
      meters_added: selectedItem?.stock_type === 'meter' ? qtyAdded : 0,
      unit_cost: Number(form.unit_cost) || 0,
      total_cost: estimatedTotal,
      notes: form.notes,
      created_by: user?.id,
    };

    const { error } = await supabase.from('inventory_purchases').insert(payload);
    setLoading(false);

    if (error) {
      setMessage(error.message);
    } else {
      setMessage('Purchase recorded — stock increased automatically!');
      setForm({
        bill_number: '',
        supplier_name: '',
        purchase_date: new Date().toISOString().split('T')[0],
        inventory_item_id: '',
        quantity_added: 0,
        meters_added: 0,
        unit_cost: 0,
        notes: '',
      });
      loadData();
    }
  }

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-display text-gold-400">Inventory Purchases</h1>
        <p className="text-luxury-muted">
          Stock IN with bill number, supplier, date, and expense tracking
        </p>
      </header>

      <div className="card-luxury mb-6 border-gold-600/20">
        <p className="text-luxury-muted text-sm">This month&apos;s purchase expenses</p>
        <p className="text-3xl font-bold text-gold-400">{formatCurrency(monthExpense)}</p>
      </div>

      <form onSubmit={handleSubmit} className="card-luxury mb-8">
        <h2 className="text-lg text-gold-400 mb-4">New Purchase Entry</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="label-luxury">Bill Number</label>
            <input
              className="input-luxury"
              value={form.bill_number}
              onChange={(e) => setForm({ ...form, bill_number: e.target.value })}
              placeholder="INV-2024-001"
            />
          </div>
          <div>
            <label className="label-luxury">Supplier Name *</label>
            <input
              className="input-luxury"
              value={form.supplier_name}
              onChange={(e) => setForm({ ...form, supplier_name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label-luxury">Purchase Date</label>
            <input
              type="date"
              className="input-luxury"
              value={form.purchase_date}
              onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <label className="label-luxury">Inventory Item *</label>
            <select
              className="input-luxury"
              value={form.inventory_item_id}
              onChange={(e) => setForm({ ...form, inventory_item_id: e.target.value })}
              required
            >
              <option value="">Select item...</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} — current: {formatStock(item)}
                </option>
              ))}
            </select>
          </div>

          {selectedItem?.stock_type === 'meter' ? (
            <div>
              <label className="label-luxury">Meters Added</label>
              <input
                type="number"
                step="0.1"
                min="0"
                className="input-luxury"
                value={form.meters_added}
                onChange={(e) => setForm({ ...form, meters_added: e.target.value })}
              />
            </div>
          ) : selectedItem ? (
            <div>
              <label className="label-luxury">Quantity Added (pcs)</label>
              <input
                type="number"
                min="0"
                className="input-luxury"
                value={form.quantity_added}
                onChange={(e) => setForm({ ...form, quantity_added: e.target.value })}
              />
            </div>
          ) : null}

          <div>
            <label className="label-luxury">Unit Cost (QAR)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="input-luxury"
              value={form.unit_cost}
              onChange={(e) => setForm({ ...form, unit_cost: e.target.value })}
            />
          </div>
          <div>
            <label className="label-luxury">Total Cost (QAR)</label>
            <input
              className="input-luxury bg-luxury-black/50"
              readOnly
              value={formatCurrency(estimatedTotal)}
            />
          </div>

          <div className="md:col-span-3">
            <label className="label-luxury">Notes</label>
            <textarea
              className="input-luxury min-h-[80px]"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>

        {message && (
          <p
            className={`mt-4 text-sm ${
              message.includes('recorded') ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {message}
          </p>
        )}

        <button type="submit" className="btn-gold mt-4" disabled={loading}>
          {loading ? 'Saving...' : 'Add Purchase & Update Stock'}
        </button>
      </form>

      <div className="card-luxury">
        <h2 className="text-lg text-gold-400 mb-4">Purchase History</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-luxury-muted border-b border-luxury-border">
                <th className="text-left py-3 px-2">Date</th>
                <th className="text-left py-3 px-2">Bill #</th>
                <th className="text-left py-3 px-2">Supplier</th>
                <th className="text-left py-3 px-2">Item</th>
                <th className="text-right py-3 px-2">Added</th>
                <th className="text-right py-3 px-2">Cost</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id} className="border-b border-luxury-border/50">
                  <td className="py-3 px-2">{formatDate(p.purchase_date)}</td>
                  <td className="py-3 px-2">{p.bill_number || '—'}</td>
                  <td className="py-3 px-2">{p.supplier_name}</td>
                  <td className="py-3 px-2">{p.inventory_items?.name}</td>
                  <td className="py-3 px-2 text-right text-gold-400">
                    {p.meters_added > 0 ? `${p.meters_added}m` : `${p.quantity_added} pcs`}
                  </td>
                  <td className="py-3 px-2 text-right">
                    {formatCurrency(p.total_cost || 0)}
                  </td>
                </tr>
              ))}
              {purchases.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-luxury-muted">
                    No purchases yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

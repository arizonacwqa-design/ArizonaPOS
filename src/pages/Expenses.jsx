import { useEffect, useState } from 'react';
import { Plus, X, ChevronDown, ChevronRight, Receipt } from 'lucide-react';
import { format, startOfMonth } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { formatCurrency, formatDate } from '@/lib/format';
import LoadingSpinner from '../LoadingSpinner';

const CATEGORIES = [
  { value: 'rent', label: 'Rent' },
  { value: 'salary', label: 'Salaries' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'purchases', label: 'Purchases (other)' },
  { value: 'other', label: 'Other' },
];

function emptyItem() {
  return {
    key: crypto.randomUUID(),
    description: '',
    quantity: 1,
    unit_cost: 0,
  };
}

export default function Expenses() {
  const { user, isAdmin } = useAuthStore();
  const [expenses, setExpenses] = useState([]);
  const [monthSales, setMonthSales] = useState(0);
  const [purchaseExpenses, setPurchaseExpenses] = useState(0);
  const [form, setForm] = useState({
    invoice_number: '',
    supplier_name: '',
    category: 'rent',
    expense_date: new Date().toISOString().slice(0, 10),
    notes: '',
  });
  const [items, setItems] = useState([emptyItem()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [expandedBills, setExpandedBills] = useState({});

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const monthStart = startOfMonth(new Date()).toISOString();
    const monthDate = format(new Date(), 'yyyy-MM-01');

    const [expRes, salesRes, purchRes] = await Promise.all([
      supabase.from('operating_expenses').select('*, expense_items(*)').order('created_at', { ascending: false }),
      supabase.from('sales').select('total_amount, sale_date, created_at'),
      supabase.from('inventory_purchases').select('total_cost, purchase_date'),
    ]);

    setExpenses(expRes.data || []);
    const sales = salesRes.data || [];
    setMonthSales(
      sales
        .filter((s) => (s.sale_date || s.created_at) >= monthStart)
        .reduce((sum, s) => sum + Number(s.total_amount), 0)
    );
    setPurchaseExpenses(
      (purchRes.data || [])
        .filter((p) => p.purchase_date >= monthDate)
        .reduce((sum, p) => sum + Number(p.total_cost), 0)
    );
    setLoading(false);
  }

  const monthOperating = expenses
    .filter((e) => e.expense_date >= format(new Date(), 'yyyy-MM-01'))
    .reduce((s, e) => {
      const items = e.expense_items || [];
      if (items.length > 0) {
        return s + items.reduce((si, i) => si + Number(i.total_cost || 0), 0);
      }
      return s + Number(e.amount || 0);
    }, 0);
  const totalCosts = monthOperating + purchaseExpenses;
  const profit = monthSales - totalCosts;

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(key) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  function updateItem(key, patch) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  const grandTotal = items.reduce((sum, i) => {
    const qty = Number(i.quantity) || 0;
    const cost = Number(i.unit_cost) || 0;
    return sum + qty * cost;
  }, 0);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isAdmin()) return;

    if (!form.supplier_name.trim()) {
      setMessage('Enter supplier/vendor name');
      return;
    }

    const validItems = items.filter((i) => i.description.trim() && (Number(i.quantity) || 0) > 0);
    if (validItems.length === 0) {
      setMessage('Add at least one item with description and quantity');
      return;
    }

    setSaving(true);

    const { data: expense, error: headerErr } = await supabase
      .from('operating_expenses')
      .insert({
        invoice_number: form.invoice_number.trim() || null,
        supplier_name: form.supplier_name.trim(),
        description: validItems[0].description.trim(),
        category: form.category,
        amount: grandTotal,
        expense_date: form.expense_date,
        notes: form.notes || null,
        created_by: user?.id,
      })
      .select()
      .single();

    if (headerErr) {
      setSaving(false);
      setMessage(headerErr.message);
      return;
    }

    const itemsToInsert = validItems.map((i) => {
      const qty = Number(i.quantity) || 0;
      const cost = Number(i.unit_cost) || 0;
      return {
        expense_id: expense.id,
        description: i.description.trim(),
        quantity: qty,
        unit_cost: cost,
        total_cost: qty * cost,
      };
    });

    const { error: itemsErr } = await supabase.from('expense_items').insert(itemsToInsert);
    setSaving(false);

    if (itemsErr) {
      setMessage(itemsErr.message);
      return;
    }

    setMessage('Expense bill recorded!');
    setForm({
      invoice_number: '',
      supplier_name: '',
      category: 'rent',
      expense_date: new Date().toISOString().slice(0, 10),
      notes: '',
    });
    setItems([emptyItem()]);
    load();
  }

  function toggleBill(id) {
    setExpandedBills((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function removeExpense(id) {
    if (!confirm('Delete this expense bill and all its items?')) return;
    const { error } = await supabase.from('operating_expenses').delete().eq('id', id);
    if (error) {
      setMessage(`Error deleting: ${error.message}`);
    } else {
      setMessage('Expense deleted');
      load();
    }
  }

  if (loading) {
    return <LoadingSpinner message="Loading expenses..." />;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 animate-fade-in">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-gold-500 mb-1">Finance</p>
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-gold-400">Expense Tracking</h1>
        <p className="text-luxury-muted">Multi-item bill-based expense entry</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Monthly Revenue" value={formatCurrency(monthSales)} />
        <SummaryCard label="Operating Expenses" value={formatCurrency(monthOperating)} />
        <SummaryCard label="Inventory Purchases" value={formatCurrency(purchaseExpenses)} />
        <SummaryCard
          label="Net Profit (est.)"
          value={formatCurrency(profit)}
          highlight={profit >= 0 ? 'positive' : 'negative'}
        />
      </div>

      {isAdmin() && (
        <form onSubmit={handleSubmit} className="card-luxury mb-8">
          <h2 className="text-lg font-semibold text-gold-400 mb-4 flex items-center gap-2">
            <Plus size={20} /> New Expense Bill
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="label-luxury">Invoice/Bill Number</label>
              <input
                className="input-luxury"
                value={form.invoice_number}
                onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
                placeholder="INV-2025-001"
              />
            </div>
            <div>
              <label className="label-luxury">Supplier/Vendor *</label>
              <input
                className="input-luxury"
                value={form.supplier_name}
                onChange={(e) => setForm({ ...form, supplier_name: e.target.value })}
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
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-luxury">Date</label>
              <input
                type="date"
                className="input-luxury"
                value={form.expense_date}
                onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-luxury-muted border-b border-luxury-border">
                  <th className="text-left py-2 px-2 w-1/2">Item Description</th>
                  <th className="text-center py-2 px-2 w-[100px]">Quantity</th>
                  <th className="text-center py-2 px-2 w-[130px]">Unit Cost (QAR)</th>
                  <th className="text-right py-2 px-2 w-[120px]">Total</th>
                  <th className="py-2 px-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const qty = Number(row.quantity) || 0;
                  const cost = Number(row.unit_cost) || 0;
                  const rowTotal = qty * cost;
                  return (
                    <tr key={row.key} className="border-b border-luxury-border/30">
                      <td className="py-1.5 px-2">
                        <input
                          className="input-luxury text-sm py-2"
                          value={row.description}
                          onChange={(e) => updateItem(row.key, { description: e.target.value })}
                          placeholder="Description of item/service..."
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          className="input-luxury text-sm py-2 text-center"
                          value={row.quantity}
                          onChange={(e) => updateItem(row.key, { quantity: e.target.value })}
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="input-luxury text-sm py-2 text-center"
                          value={row.unit_cost}
                          onChange={(e) => updateItem(row.key, { unit_cost: e.target.value })}
                        />
                      </td>
                      <td className="py-1.5 px-2 text-right font-medium text-gold-400">
                        {formatCurrency(rowTotal)}
                      </td>
                      <td className="py-1.5 px-2">
                        <button
                          type="button"
                          onClick={() => removeItem(row.key)}
                          className="p-1 text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button type="button" onClick={addItem} className="btn-outline text-sm mt-3 flex items-center gap-1.5">
            <Plus size={16} /> Add Item
          </button>

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-luxury-border">
            <div className="text-sm text-luxury-muted">{items.filter((i) => i.description.trim()).length} items</div>
            <div className="text-xl font-bold text-gold-400">
              Grand Total: {formatCurrency(grandTotal)}
            </div>
          </div>

          <div className="mt-4">
            <label className="label-luxury">Notes</label>
            <textarea
              className="input-luxury min-h-[60px]"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          {message && (
            <p className={`mt-3 text-sm ${message.includes('recorded') || message.includes('deleted') ? 'text-green-400' : 'text-red-400'}`}>
              {message}
            </p>
          )}

          <button type="submit" className="btn-gold mt-4 flex items-center gap-2" disabled={saving}>
            <Receipt size={18} /> {saving ? 'Saving...' : 'Save Expense'}
          </button>
        </form>
      )}

      <div className="card-luxury">
        <h2 className="text-lg font-semibold text-gold-400 mb-4">All Operating Expenses</h2>
        <div className="space-y-2">
          {expenses.map((e) => {
            const billItems = e.expense_items || [];
            const billTotal = billItems.length > 0
              ? billItems.reduce((s, i) => s + Number(i.total_cost || 0), 0)
              : Number(e.amount || 0);
            const isExpanded = expandedBills[e.id];
            return (
              <div key={e.id} className="border border-luxury-border rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleBill(e.id)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-luxury-slate/50 hover:bg-luxury-slate transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isExpanded ? <ChevronDown size={16} className="shrink-0 text-gold-400" /> : <ChevronRight size={16} className="shrink-0 text-luxury-muted" />}
                    <span className="text-sm font-medium truncate">{e.supplier_name || e.category}</span>
                    <span className="text-xs text-luxury-muted shrink-0">{formatDate(e.expense_date)}</span>
                    {e.invoice_number && <span className="text-xs text-luxury-muted shrink-0">#{e.invoice_number}</span>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-semibold text-gold-400">{formatCurrency(billTotal)}</span>
                    {isAdmin() && (
                      <button
                        type="button"
                        onClick={(ev) => { ev.stopPropagation(); removeExpense(e.id); }}
                        className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-4 pb-3 pt-1">
                    {billItems.length > 0 ? (
                      <>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-luxury-muted text-xs border-b border-luxury-border/50">
                              <th className="text-left py-2 px-2">Item</th>
                              <th className="text-center py-2 px-2">Qty</th>
                              <th className="text-center py-2 px-2">Unit Cost</th>
                              <th className="text-right py-2 px-2">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {billItems.map((i) => (
                              <tr key={i.id} className="border-b border-luxury-border/20">
                                <td className="py-1.5 px-2">{i.description}</td>
                                <td className="py-1.5 px-2 text-center">{Number(i.quantity)}</td>
                                <td className="py-1.5 px-2 text-center">{formatCurrency(i.unit_cost)}</td>
                                <td className="py-1.5 px-2 text-right text-gold-400">{formatCurrency(i.total_cost)}</td>
                              </tr>
                            ))}
                            <tr className="font-semibold">
                              <td colSpan={3} className="py-2 px-2 text-right text-gold-400">Grand Total</td>
                              <td className="py-2 px-2 text-right text-gold-400">{formatCurrency(billTotal)}</td>
                            </tr>
                          </tbody>
                        </table>
                        {e.notes && <p className="text-xs text-luxury-muted mt-2 italic">{e.notes}</p>}
                      </>
                    ) : (
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-luxury-muted py-2">
                          {e.description} — {formatCurrency(Number(e.amount || 0))}
                        </p>
                        {e.notes && <p className="text-xs text-luxury-muted italic">{e.notes}</p>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {expenses.length === 0 && (
            <p className="text-center text-luxury-muted py-8">No expenses yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, highlight }) {
  const color =
    highlight === 'positive'
      ? 'text-green-400'
      : highlight === 'negative'
        ? 'text-red-400'
        : 'text-gold-400';
  return (
    <div className="card-luxury">
      <p className="text-xs text-luxury-muted uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}

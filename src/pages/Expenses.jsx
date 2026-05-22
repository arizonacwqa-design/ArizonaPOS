import { useEffect, useState } from 'react';
import { Receipt, Plus, Trash2 } from 'lucide-react';
import { format, startOfMonth } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { formatCurrency, formatDate } from '@/lib/format';
import LuxuryTable from '@/components/LuxuryTable';
import { PageHeaderSkeleton, TableSkeleton } from '@/components/LoadingSkeleton';
import { useTranslation } from '@/lib/translations';

const CATEGORIES = [
  { value: 'rent', label: 'Rent' },
  { value: 'salary', label: 'Salaries' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'purchases', label: 'Purchases (other)' },
  { value: 'other', label: 'Other' },
];

const emptyForm = {
  category: 'rent',
  description: '',
  amount: '',
  expense_date: new Date().toISOString().slice(0, 10),
  notes: '',
};

export default function Expenses() {
  const { user, isAdmin } = useAuthStore();
  const [expenses, setExpenses] = useState([]);
  const [monthSales, setMonthSales] = useState(0);
  const [purchaseExpenses, setPurchaseExpenses] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const { t } = useTranslation();

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const monthStart = startOfMonth(new Date()).toISOString();
    const monthDate = format(new Date(), 'yyyy-MM-01');

    const [expRes, salesRes, purchRes] = await Promise.all([
      supabase.from('operating_expenses').select('*').order('expense_date', { ascending: false }),
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
    .reduce((s, e) => s + Number(e.amount), 0);
  const totalCosts = monthOperating + purchaseExpenses;
  const profit = monthSales - totalCosts;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isAdmin()) return;
    const { error } = await supabase.from('operating_expenses').insert({
      ...form,
      amount: Number(form.amount),
      created_by: user?.id,
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    setForm(emptyForm);
    setMessage('Expense recorded');
    load();
  }

  async function remove(id) {
    if (!confirm('Delete this expense?')) return;
    const { error } = await supabase.from('operating_expenses').delete().eq('id', id);
    if (error) {
      setMessage(`Error deleting expense: ${error.message}`);
    } else {
      setMessage('Expense deleted');
      load();
    }
  }

  if (loading) {
    return (
      <div className="p-8 animate-fade-in">
        <PageHeaderSkeleton />
        <TableSkeleton rows={6} cols={5} />
      </div>
    );
  }

  return (
    <div className="p-8 animate-fade-in">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-gold-500 mb-1">{t('finance')}</p>
        <h1 className="text-3xl font-display text-gold-400">{t('expenseTracking')}</h1>
        <p className="text-luxury-muted mt-1">Rent, salaries, utilities, and profit calculation</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <SummaryCard label={t('monthlyRevenue')} value={formatCurrency(monthSales)} />
        <SummaryCard label={t('operatingExpenses')} value={formatCurrency(monthOperating)} />
        <SummaryCard label={t('inventoryPurchases')} value={formatCurrency(purchaseExpenses)} />
        <SummaryCard
          label={t('netProfitEstimated')}
          value={formatCurrency(profit)}
          highlight={profit >= 0 ? 'positive' : 'negative'}
        />
      </div>

      {isAdmin() && (
        <form onSubmit={handleSubmit} className="card-luxury mb-8">
          <h2 className="text-lg font-semibold text-gold-400 mb-4 flex items-center gap-2">{t('addExpense')}
            <Plus size={20} /> Add Expense
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="label-luxury">{t('category')}</label>
              <select
                className="input-luxury"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-luxury">{t('description')}</label>
              <input
                className="input-luxury"
                required
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <label className="label-luxury">{t('amount')}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="input-luxury"
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <div>
              <label className="label-luxury">{t('date')}</label>
              <input
                type="date"
                className="input-luxury"
                value={form.expense_date}
                onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="label-luxury">{t('notes')}</label>
              <input
                className="input-luxury"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          {message && <p className="text-sm text-gold-400 mt-3">{message}</p>}
          <button type="submit" className="btn-gold mt-4 flex items-center gap-2">
            <Receipt size={18} /> {t('saveExpense')}
          </button>
        </form>
      )}

      <div className="card-luxury">
        <h2 className="text-lg font-semibold text-gold-400 mb-4">All Operating Expenses</h2>
        <LuxuryTable
          columns={[
            { key: 'date', header: t('date'), render: (r) => formatDate(r.expense_date) },
            { key: 'category', header: t('category'), render: (r) => r.category },
            { key: 'description', header: t('description') },
            {
              key: 'amount',
              header: t('amount'),
              align: 'right',
              render: (r) => formatCurrency(r.amount),
              cellClassName: 'text-gold-400 font-medium',
            },
            ...(isAdmin()
              ? [
                  {
                    key: 'actions',
                    header: '',
                    align: 'right',
                    render: (r) => (
                      <button
                        type="button"
                        onClick={() => remove(r.id)}
                        className="text-red-400 hover:text-red-300 p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    ),
                  },
                ]
              : []),
          ]}
          rows={expenses}
          emptyMessage={t('noOperatingExpenses')}
        />
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

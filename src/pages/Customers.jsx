import { useEffect, useState } from 'react';
import { Users, Search, FileText, Pencil, Check, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/format';
import { getCustomerHistory, updateCustomer } from '@/lib/customers';
import LuxuryTable from '@/components/LuxuryTable';
import { PageHeaderSkeleton, TableSkeleton } from '@/components/LoadingSkeleton';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState({ customer: null, sales: [] });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ full_name: '', phone: '', email: '', notes: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    setLoading(true);
    const { data } = await supabase
      .from('customers')
      .select('*')
      .order('last_visit_at', { ascending: false, nullsFirst: false });
    setCustomers(data || []);
    setLoading(false);
  }

  const filtered = customers.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.full_name?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q)
    );
  });

  async function viewHistory(customer) {
    setSelected(customer);
    setEditing(false);
    setEditError('');
    const result = await getCustomerHistory(customer.id || customer.phone);
    setHistory(result);
  }

  function startEditing() {
    if (!selected) return;
    setEditForm({
      full_name: selected.full_name || '',
      phone: selected.phone || '',
      email: selected.email || '',
      notes: selected.notes || '',
    });
    setEditError('');
    setEditing(true);
  }

  async function saveEdits() {
    if (!selected) return;
    const name = editForm.full_name.trim();
    const phone = editForm.phone.trim();
    
    if (!name) {
      setEditError('Name is required');
      return;
    }
    
    // Validate phone format if provided (must be digits and common separators)
    if (phone && !/^[\d\s\-\+\(\)\.]+$/.test(phone)) {
      setEditError('Phone must contain only numbers, spaces, dashes, and common separators');
      return;
    }
    
    setEditSaving(true);
    try {
      await updateCustomer(selected.id, {
        full_name: name,
        phone: phone || null,
        email: editForm.email.trim() || null,
        notes: editForm.notes.trim() || null,
      });
      // Refresh data
      await loadCustomers();
      const updated = { ...selected, ...editForm };
      setSelected(updated);
      setEditing(false);
    } catch (e) {
      setEditError(e.message || 'Failed to save');
    } finally {
      setEditSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <PageHeaderSkeleton />
        <TableSkeleton />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 animate-fade-in">
      <header className="mb-6 sm:mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-gold-500 mb-1">CRM</p>
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-gold-400 flex items-center gap-3">
          <Users className="text-gold-500" />
          Customer History
        </h1>
        <p className="text-luxury-muted mt-1 text-sm sm:text-base">Past invoices, services, and total spent</p>
      </header>

      <div className="relative max-w-md mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-luxury-muted" size={18} />
        <input
          className="input-luxury pl-10"
          placeholder="Search by name or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card-luxury">
          <h2 className="text-lg font-semibold text-gold-400 mb-4">Customers</h2>
          <LuxuryTable
            columns={[
              { key: 'name', header: 'Name', render: (r) => r.full_name },
              { key: 'phone', header: 'Phone', render: (r) => r.phone || '—' },
              {
                key: 'spent',
                header: 'Total Spent',
                align: 'right',
                render: (r) => formatCurrency(r.total_spent),
                cellClassName: 'text-gold-400',
              },
              {
                key: 'visits',
                header: 'Visits',
                align: 'right',
                render: (r) => r.visit_count,
              },
              {
                key: 'view',
                header: '',
                render: (r) => (
                  <button
                    type="button"
                    onClick={() => viewHistory(r)}
                    className="text-gold-400 hover:text-gold-300 text-xs"
                  >
                    View history
                  </button>
                ),
              },
            ]}
            rows={filtered}
            emptyMessage="No customers yet. They are created automatically when you complete a sale in POS."
          />
        </div>

        <div className="card-luxury">
          <div className="flex items-center justify-between mb-4 gap-2">
            <h2 className="text-lg font-semibold text-gold-400 flex items-center gap-2 min-w-0">
              <FileText size={20} className="shrink-0" />
              <span className="truncate">
                {selected ? `${selected.full_name} — History` : 'Select a customer'}
              </span>
            </h2>
            {selected && !editing && (
              <button
                type="button"
                onClick={startEditing}
                className="text-gold-400 hover:text-gold-300 text-xs inline-flex items-center gap-1 shrink-0"
              >
                <Pencil size={14} /> Edit
              </button>
            )}
          </div>

          {selected && editing && (
            <div className="space-y-3 mb-4 border border-gold-600/30 rounded-lg p-3 bg-luxury-slate/40">
              <div>
                <label className="label-luxury">Name</label>
                <input
                  className="input-luxury"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="label-luxury">Phone</label>
                  <input
                    className="input-luxury"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label-luxury">Email</label>
                  <input
                    type="email"
                    className="input-luxury"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="label-luxury">Notes</label>
                <textarea
                  rows={3}
                  className="input-luxury resize-none"
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  placeholder="Preferred services, allergies, parking notes…"
                />
              </div>
              {editError && <p className="text-red-400 text-xs">{editError}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={saveEdits}
                  disabled={editSaving}
                  className="btn-gold flex items-center gap-1 text-sm"
                >
                  <Check size={14} /> {editSaving ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="btn-outline flex items-center gap-1 text-sm"
                >
                  <X size={14} /> Cancel
                </button>
              </div>
            </div>
          )}

          {selected && !editing && (selected.phone || selected.email || selected.notes) && (
            <div className="text-xs text-luxury-muted mb-4 space-y-0.5">
              {selected.phone && <p>📞 {selected.phone}</p>}
              {selected.email && <p>✉ {selected.email}</p>}
              {selected.notes && <p className="italic">"{selected.notes}"</p>}
            </div>
          )}

          {selected && history.sales.length > 0 ? (
            <ul className="space-y-3 max-h-[480px] overflow-y-auto">
              {history.sales.map((sale) => (
                <li
                  key={sale.id}
                  className="rounded-lg border border-luxury-border bg-luxury-slate p-4 transition-all hover:border-gold-600/30"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-mono text-gold-400">{sale.invoice_number}</span>
                    <span className="font-bold">{formatCurrency(sale.total_amount)}</span>
                  </div>
                  <p className="text-xs text-luxury-muted">
                    {formatDate(sale.sale_date || sale.created_at)}
                    {sale.car_model && ` · ${sale.car_model}`}
                  </p>
                  <ul className="mt-2 text-xs text-luxury-muted space-y-0.5">
                    {(sale.sale_items || []).map((item, i) => (
                      <li key={i}>
                        {item.service_name} ×{item.quantity}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : selected ? (
            <p className="text-luxury-muted text-sm">No invoices found for this customer.</p>
          ) : (
            <p className="text-luxury-muted text-sm">Click "View history" on a customer row.</p>
          )}
        </div>
      </div>
    </div>
  );
}

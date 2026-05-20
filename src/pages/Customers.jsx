import { useEffect, useState } from 'react';
import { Users, Search, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/format';
import { getCustomerHistory } from '@/lib/customers';
import LuxuryTable from '@/components/LuxuryTable';
import { PageHeaderSkeleton, TableSkeleton } from '@/components/LoadingSkeleton';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState({ customer: null, sales: [] });
  const [loading, setLoading] = useState(true);

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
    const result = await getCustomerHistory(customer.phone || customer.id);
    setHistory(result);
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
    <div className="p-8 animate-fade-in">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-gold-500 mb-1">CRM</p>
        <h1 className="text-3xl font-display text-gold-400 flex items-center gap-3">
          <Users className="text-gold-500" />
          Customer History
        </h1>
        <p className="text-luxury-muted mt-1">Past invoices, services, and total spent</p>
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
          <h2 className="text-lg font-semibold text-gold-400 mb-4 flex items-center gap-2">
            <FileText size={20} />
            {selected ? `${selected.full_name} — History` : 'Select a customer'}
          </h2>
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
            <p className="text-luxury-muted text-sm">Click “View history” on a customer row.</p>
          )}
        </div>
      </div>
    </div>
  );
}

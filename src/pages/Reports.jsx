import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { formatCurrency, formatDate, formatStock, isLowStock } from '@/lib/format';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import ExportButtons from '@/components/ExportButtons';
import {
  buildSalesExportRows,
  SALES_EXPORT_COLUMNS,
} from '@/lib/export';

const TABS = [
  { id: 'daily', label: 'Daily Sales' },
  { id: 'monthly', label: 'Monthly Sales' },
  { id: 'expenses', label: 'Expenses', adminOnly: true },
  { id: 'inventory', label: 'Inventory' },
  { id: 'lowstock', label: 'Low Stock' },
  { id: 'topservices', label: 'Top Services' },
  { id: 'invusage', label: 'Inventory Usage' },
  { id: 'employees', label: 'Employee Sales' },
];

export default function Reports() {
  const isAdmin = useAuthStore((s) => s.isAdmin());
  const [tab, setTab] = useState('daily');
  const [sales, setSales] = useState([]);
  const [saleItems, setSaleItems] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [inventoryUsage, setInventoryUsage] = useState([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, []);

  async function loadReports() {
    setLoading(true);
    const [salesRes, itemsRes, invRes, profRes, purchRes, usageRes] = await Promise.all([
      supabase
        .from('sales')
        .select('*, profiles(full_name)')
        .order('created_at', { ascending: false }),
      supabase.from('sale_items').select('*'),
      supabase.from('inventory_items').select('*').order('name'),
      supabase.from('profiles').select('*'),
      supabase
        .from('inventory_purchases')
        .select('*, inventory_items(name)')
        .order('purchase_date', { ascending: false }),
      supabase.from('inventory_usage_report').select('*').limit(500),
    ]);
    setSales(salesRes.data || []);
    setSaleItems(itemsRes.data || []);
    setInventory(invRes.data || []);
    setProfiles(profRes.data || []);
    setPurchases(purchRes.data || []);
    setInventoryUsage(usageRes.data || []);
    setLoading(false);
  }

  const dailySales = useMemo(
    () =>
      sales.filter(
        (s) => format(new Date(s.sale_date || s.created_at), 'yyyy-MM-dd') === selectedDate
      ),
    [sales, selectedDate]
  );

  const monthlySales = useMemo(
    () =>
      sales.filter(
        (s) => format(new Date(s.sale_date || s.created_at), 'yyyy-MM') === selectedMonth
      ),
    [sales, selectedMonth]
  );

  const monthlyPurchases = useMemo(() => {
    const start = startOfMonth(parseISO(`${selectedMonth}-01`));
    const end = endOfMonth(start);
    return purchases.filter((p) => {
      const d = parseISO(p.purchase_date);
      return d >= start && d <= end;
    });
  }, [purchases, selectedMonth]);

  const dailyTotal = dailySales.reduce((sum, s) => sum + Number(s.total_amount), 0);
  const monthlyTotal = monthlySales.reduce((sum, s) => sum + Number(s.total_amount), 0);
  const monthlyExpense = monthlyPurchases.reduce(
    (sum, p) => sum + Number(p.total_cost || 0),
    0
  );

  const monthSaleIds = new Set(monthlySales.map((s) => s.id));
  const monthSaleItems = saleItems.filter((i) => monthSaleIds.has(i.sale_id));

  const serviceCounts = {};
  monthSaleItems.forEach((item) => {
    serviceCounts[item.service_name] =
      (serviceCounts[item.service_name] || 0) + Number(item.quantity);
  });
  const topServices = Object.entries(serviceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const employeeSales = profiles.map((emp) => {
    const empSales = monthlySales.filter((s) => s.employee_id === emp.id);
    const total = empSales.reduce((sum, s) => sum + Number(s.total_amount), 0);
    return { ...emp, count: empSales.length, total };
  });

  const lowStock = inventory.filter(isLowStock);
  const dailyExportRows = buildSalesExportRows(dailySales);
  const monthlyExportRows = buildSalesExportRows(monthlySales);

  const expenseExportColumns = [
    { header: 'Date', accessor: (r) => formatDate(r.purchase_date) },
    { header: 'Bill', accessor: (r) => r.bill_number || '—' },
    { header: 'Supplier', accessor: (r) => r.supplier_name },
    { header: 'Item', accessor: (r) => r.inventory_items?.name || '—' },
    { header: 'Cost', accessor: (r) => formatCurrency(r.total_cost) },
  ];

  if (loading) {
    return <div className="p-8 text-gold-400 animate-pulse">Loading reports...</div>;
  }

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-display text-gold-400">Reports</h1>
        <p className="text-luxury-muted">Export daily/monthly sales, inventory, and expenses</p>
      </header>

      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.filter((t) => !t.adminOnly || isAdmin).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm ${
              tab === t.id
                ? 'bg-gold-600/20 text-gold-400 border border-gold-600/30'
                : 'bg-luxury-slate text-gray-400 hover:text-gold-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'daily' && (
        <div className="space-y-4">
          <input
            type="date"
            className="input-luxury w-auto"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
          <div className="card-luxury">
            <p className="text-3xl font-bold text-gold-400">{formatCurrency(dailyTotal)}</p>
            <p className="text-luxury-muted">{dailySales.length} transactions</p>
          </div>
          <ExportButtons
            title={`Daily Sales — ${selectedDate}`}
            subtitle={`Total: ${formatCurrency(dailyTotal)}`}
            columns={SALES_EXPORT_COLUMNS}
            rows={dailyExportRows}
            filenameBase={`daily_sales_${selectedDate}`}
          />
          <SalesTable data={dailySales} />
        </div>
      )}

      {tab === 'monthly' && (
        <div className="space-y-4">
          <input
            type="month"
            className="input-luxury w-auto"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
          <div className="card-luxury grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-luxury-muted text-sm">Revenue</p>
              <p className="text-2xl font-bold text-gold-400">{formatCurrency(monthlyTotal)}</p>
            </div>
            <div>
              <p className="text-luxury-muted text-sm">Transactions</p>
              <p className="text-2xl font-bold">{monthlySales.length}</p>
            </div>
            <div>
              <p className="text-luxury-muted text-sm">Net (sales − expenses)</p>
              <p className="text-2xl font-bold text-green-400">
                {formatCurrency(monthlyTotal - monthlyExpense)}
              </p>
            </div>
          </div>
          <ExportButtons
            title={`Monthly Sales — ${selectedMonth}`}
            subtitle={`Revenue: ${formatCurrency(monthlyTotal)}`}
            columns={SALES_EXPORT_COLUMNS}
            rows={monthlyExportRows}
            filenameBase={`monthly_sales_${selectedMonth}`}
          />
          <SalesTable data={monthlySales} />
        </div>
      )}

      {tab === 'expenses' && isAdmin && (
        <div className="space-y-4">
          <input
            type="month"
            className="input-luxury w-auto"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
          <div className="card-luxury">
            <p className="text-3xl font-bold text-gold-400">{formatCurrency(monthlyExpense)}</p>
            <p className="text-luxury-muted">{monthlyPurchases.length} purchase entries</p>
          </div>
          <ExportButtons
            title={`Expenses — ${selectedMonth}`}
            columns={expenseExportColumns}
            rows={monthlyPurchases}
            filenameBase={`expenses_${selectedMonth}`}
          />
          <div className="card-luxury overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-luxury-muted border-b border-luxury-border">
                  <th className="text-left py-3 px-2">Date</th>
                  <th className="text-left py-3 px-2">Bill</th>
                  <th className="text-left py-3 px-2">Supplier</th>
                  <th className="text-left py-3 px-2">Item</th>
                  <th className="text-right py-3 px-2">Cost</th>
                </tr>
              </thead>
              <tbody>
                {monthlyPurchases.map((p) => (
                  <tr key={p.id} className="border-b border-luxury-border/50">
                    <td className="py-3 px-2">{formatDate(p.purchase_date)}</td>
                    <td className="py-3 px-2">{p.bill_number || '—'}</td>
                    <td className="py-3 px-2">{p.supplier_name}</td>
                    <td className="py-3 px-2">{p.inventory_items?.name}</td>
                    <td className="py-3 px-2 text-right text-gold-400">
                      {formatCurrency(p.total_cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'inventory' && (
        <div className="space-y-4">
          <ExportButtons
            title="Inventory Report"
            columns={[
              { header: 'Item', accessor: (r) => r.name },
              { header: 'Category', accessor: (r) => r.category },
              { header: 'Type', accessor: (r) => r.stock_type },
              { header: 'Stock', accessor: (r) => formatStock(r) },
            ]}
            rows={inventory}
            filenameBase="inventory_report"
          />
          <div className="card-luxury overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-luxury-muted border-b border-luxury-border">
                  <th className="text-left py-3 px-2">Item</th>
                  <th className="text-left py-3 px-2">Category</th>
                  <th className="text-left py-3 px-2">Type</th>
                  <th className="text-right py-3 px-2">Stock</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((item) => (
                  <tr key={item.id} className="border-b border-luxury-border/50">
                    <td className="py-3 px-2">{item.name}</td>
                    <td className="py-3 px-2 text-luxury-muted">{item.category}</td>
                    <td className="py-3 px-2 capitalize">{item.stock_type}</td>
                    <td className="py-3 px-2 text-right text-gold-400">{formatStock(item)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'lowstock' && (
        <div className="card-luxury">
          {lowStock.length === 0 ? (
            <p className="text-green-400">All items are above low stock threshold</p>
          ) : (
            <ul className="space-y-3">
              {lowStock.map((item) => (
                <li
                  key={item.id}
                  className="flex justify-between bg-luxury-slate rounded-lg p-4 border border-red-500/20"
                >
                  <span>{item.name}</span>
                  <span className="text-red-400">{formatStock(item)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'topservices' && (
        <div className="space-y-4">
          <p className="text-luxury-muted text-sm">Filtered by selected month (Monthly tab date)</p>
          <input
            type="month"
            className="input-luxury w-auto"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
          <ExportButtons
            title={`Top Services — ${selectedMonth}`}
            columns={[
              { header: 'Rank', accessor: (r) => r.rank },
              { header: 'Service', accessor: (r) => r.name },
              { header: 'Qty Sold', accessor: (r) => r.qty },
            ]}
            rows={topServices.map(([name, qty], i) => ({
              rank: i + 1,
              name,
              qty,
            }))}
            filenameBase={`top_services_${selectedMonth}`}
          />
          <div className="card-luxury">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-luxury-muted border-b border-luxury-border">
                  <th className="text-left py-3 px-2">#</th>
                  <th className="text-left py-3 px-2">Service</th>
                  <th className="text-right py-3 px-2">Qty Sold</th>
                </tr>
              </thead>
              <tbody>
                {topServices.map(([name, qty], i) => (
                  <tr key={name} className="border-b border-luxury-border/50">
                    <td className="py-3 px-2 text-gold-400">{i + 1}</td>
                    <td className="py-3 px-2">{name}</td>
                    <td className="py-3 px-2 text-right">{qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'invusage' && (
        <div className="space-y-4">
          <input
            type="month"
            className="input-luxury w-auto"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
          <div className="card-luxury overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-luxury-muted border-b border-luxury-border">
                  <th className="text-left py-3 px-2">Date</th>
                  <th className="text-left py-3 px-2">Invoice</th>
                  <th className="text-left py-3 px-2">Item</th>
                  <th className="text-left py-3 px-2">Type</th>
                  <th className="text-right py-3 px-2">Used</th>
                </tr>
              </thead>
              <tbody>
                {inventoryUsage
                  .filter(
                    (r) =>
                      format(new Date(r.sale_date || r.created_at), 'yyyy-MM') === selectedMonth
                  )
                  .map((r) => (
                    <tr key={r.id} className="border-b border-luxury-border/50">
                      <td className="py-3 px-2">{formatDate(r.sale_date || r.created_at)}</td>
                      <td className="py-3 px-2 font-mono text-xs">{r.invoice_number}</td>
                      <td className="py-3 px-2">{r.item_name || r.service_name}</td>
                      <td className="py-3 px-2 capitalize">{r.stock_type}</td>
                      <td className="py-3 px-2 text-right text-amber-400">
                        {r.amount_used}
                        {r.stock_type === 'meter' ? 'm' : ' pcs'}
                      </td>
                    </tr>
                  ))}
                {inventoryUsage.filter(
                  (r) =>
                    format(new Date(r.sale_date || r.created_at), 'yyyy-MM') === selectedMonth
                ).length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-luxury-muted">
                      No inventory usage this month (run migration 004 for report view)
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'employees' && (
        <div className="space-y-4">
          <input
            type="month"
            className="input-luxury w-auto"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
          <ExportButtons
            title={`Employee Sales — ${selectedMonth}`}
            columns={[
              { header: 'Employee', accessor: (r) => r.full_name },
              { header: 'Role', accessor: (r) => r.role },
              { header: 'Sales', accessor: (r) => r.count },
              { header: 'Revenue', accessor: (r) => formatCurrency(r.total) },
            ]}
            rows={employeeSales}
            filenameBase={`employee_sales_${selectedMonth}`}
          />
          <div className="card-luxury overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-luxury-muted border-b border-luxury-border">
                  <th className="text-left py-3 px-2">Employee</th>
                  <th className="text-left py-3 px-2">Role</th>
                  <th className="text-right py-3 px-2">Sales</th>
                  <th className="text-right py-3 px-2">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {employeeSales.map((emp) => (
                  <tr key={emp.id} className="border-b border-luxury-border/50">
                    <td className="py-3 px-2">{emp.full_name}</td>
                    <td className="py-3 px-2 capitalize text-luxury-muted">{emp.role}</td>
                    <td className="py-3 px-2 text-right">{emp.count}</td>
                    <td className="py-3 px-2 text-right text-gold-400">
                      {formatCurrency(emp.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SalesTable({ data }) {
  return (
    <div className="card-luxury overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-luxury-muted border-b border-luxury-border">
            <th className="text-left py-3 px-2">Invoice</th>
            <th className="text-left py-3 px-2">Customer</th>
            <th className="text-left py-3 px-2">Car</th>
            <th className="text-left py-3 px-2">Payment</th>
            <th className="text-right py-3 px-2">Total</th>
          </tr>
        </thead>
        <tbody>
          {data.map((s) => (
            <tr key={s.id} className="border-b border-luxury-border/50">
              <td className="py-3 px-2">{s.invoice_number}</td>
              <td className="py-3 px-2">{s.customer_name}</td>
              <td className="py-3 px-2 text-luxury-muted">
                {s.car_model} {s.car_plate && `· ${s.car_plate}`}
              </td>
              <td className="py-3 px-2 capitalize">{s.payment_method?.replace('_', ' ')}</td>
              <td className="py-3 px-2 text-right text-gold-400">
                {formatCurrency(s.total_amount)}
              </td>
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={5} className="py-8 text-center text-luxury-muted">
                No sales for this period
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

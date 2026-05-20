import { useEffect, useState, useMemo } from 'react';
import { Printer, Download, MessageCircle, X, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { formatCurrency, formatDate, formatDateTime, formatStock, isLowStock } from '@/lib/format';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import ExportButtons from '@/components/ExportButtons';
import {
  buildSalesExportRows,
  SALES_EXPORT_COLUMNS,
} from '@/lib/export';
import ThermalInvoice from '@/components/ThermalInvoice';
import A4Invoice from '@/components/A4Invoice';
import { downloadLuxuryInvoicePdf } from '@/lib/invoicePdf';
import { buildInvoiceWhatsAppMessage, openWhatsApp } from '@/lib/share';

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
  const [reprintSale, setReprintSale] = useState(null);
  const [reprintItems, setReprintItems] = useState([]);
  const [reprintLoading, setReprintLoading] = useState(false);
  const [reprintError, setReprintError] = useState('');

  async function openReprint(sale) {
    setReprintSale(sale);
    setReprintItems([]);
    setReprintError('');
    setReprintLoading(true);
    const { data, error } = await supabase
      .from('sale_items')
      .select('*, inventory_items(name, stock_type)')
      .eq('sale_id', sale.id)
      .order('id');
    setReprintLoading(false);
    if (error) {
      setReprintError(error.message);
      return;
    }
    setReprintItems(data || []);
  }

  function closeReprint() {
    setReprintSale(null);
    setReprintItems([]);
    setReprintError('');
  }

  function reprintBrowserPrint(mode) {
    document.body.classList.remove('print-thermal', 'print-a4');
    document.body.classList.add(mode === 'a4' ? 'print-a4' : 'print-thermal');
    if (window.electronAPI?.printInvoice) {
      window.electronAPI.printInvoice();
    } else {
      window.print();
    }
    setTimeout(() => {
      document.body.classList.remove('print-thermal', 'print-a4');
    }, 500);
  }

  const reprintInventoryUsage = useMemo(() => {
    const map = new Map();
    for (const item of reprintItems) {
      if (!item.inventory_item_id || !Number(item.inventory_deducted)) continue;
      const key = item.inventory_item_id;
      const prev = map.get(key) || {
        id: key,
        name: item.inventory_items?.name || item.service_name,
        stock_type: item.inventory_items?.stock_type || 'quantity',
        total: 0,
      };
      prev.total += Number(item.inventory_deducted) || 0;
      map.set(key, prev);
    }
    return [...map.values()];
  }, [reprintItems]);

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
          <SalesTable data={dailySales} onReprint={openReprint} />
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
          <SalesTable data={monthlySales} onReprint={openReprint} />
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

      <ReprintModal
        sale={reprintSale}
        items={reprintItems}
        inventoryUsage={reprintInventoryUsage}
        loading={reprintLoading}
        error={reprintError}
        onClose={closeReprint}
        onPrint={reprintBrowserPrint}
      />

      {reprintSale && (
        <>
          <ThermalInvoice sale={reprintSale} items={reprintItems} inventoryUsage={reprintInventoryUsage} />
          <A4Invoice sale={reprintSale} items={reprintItems} inventoryUsage={reprintInventoryUsage} />
        </>
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

function SalesTable({ data, onReprint }) {
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
            <th className="text-right py-3 px-2 w-32"></th>
          </tr>
        </thead>
        <tbody>
          {data.map((s) => (
            <tr key={s.id} className="border-b border-luxury-border/50 hover:bg-luxury-slate/40">
              <td className="py-3 px-2">{s.invoice_number}</td>
              <td className="py-3 px-2">{s.customer_name}</td>
              <td className="py-3 px-2 text-luxury-muted">
                {s.car_model} {s.car_plate && `· ${s.car_plate}`}
              </td>
              <td className="py-3 px-2 capitalize">{s.payment_method?.replace('_', ' ')}</td>
              <td className="py-3 px-2 text-right text-gold-400">
                {formatCurrency(s.total_amount)}
              </td>
              <td className="py-3 px-2 text-right">
                <button
                  type="button"
                  onClick={() => onReprint?.(s)}
                  className="text-gold-400 hover:text-gold-300 text-xs inline-flex items-center gap-1"
                >
                  <FileText size={14} /> Reprint
                </button>
              </td>
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={6} className="py-8 text-center text-luxury-muted">
                No sales for this period
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ReprintModal({
  sale,
  items,
  inventoryUsage,
  loading,
  error,
  onClose,
  onPrint,
}) {
  if (!sale) return null;
  const customerPhone = sale.customer_phone;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 print:hidden"
      onClick={onClose}
    >
      <div
        className="card-luxury w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-gold-500">Invoice</p>
            <h3 className="text-xl font-display text-gold-400">{sale.invoice_number}</h3>
            <p className="text-xs text-luxury-muted mt-1">
              {formatDateTime(sale.sale_date || sale.created_at)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-luxury-muted hover:text-gold-300 p-1"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-1 text-sm border border-luxury-border rounded-lg p-3 bg-luxury-slate/40 mb-4">
          <p><span className="text-luxury-muted">Customer:</span> {sale.customer_name}</p>
          {sale.customer_phone && (
            <p><span className="text-luxury-muted">Phone:</span> {sale.customer_phone}</p>
          )}
          {(sale.car_model || sale.car_plate) && (
            <p><span className="text-luxury-muted">Vehicle:</span> {[sale.car_model, sale.car_plate].filter(Boolean).join(' · ')}</p>
          )}
          <p className="capitalize"><span className="text-luxury-muted">Payment:</span> {sale.payment_method?.replace('_', ' ')}</p>
          <p className="text-gold-400 font-semibold">
            <span className="text-luxury-muted font-normal">Total:</span> {formatCurrency(sale.total_amount)}
          </p>
        </div>

        {loading && <p className="text-gold-400 animate-pulse text-sm">Loading invoice items…</p>}
        {error && <p className="text-red-400 text-sm">{error}</p>}

        {!loading && !error && items.length > 0 && (
          <ul className="text-xs space-y-1 mb-4 max-h-40 overflow-y-auto border border-luxury-border rounded p-2">
            {items.map((it) => (
              <li key={it.id} className="flex justify-between">
                <span>{it.service_name} ×{it.quantity}</span>
                <span className="text-gold-400">{formatCurrency(it.line_total)}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={loading || !!error}
              onClick={() => onPrint('thermal')}
              className="btn-outline flex items-center justify-center gap-2 text-sm"
            >
              <Printer size={16} /> Thermal (80mm)
            </button>
            <button
              type="button"
              disabled={loading || !!error}
              onClick={() => onPrint('a4')}
              className="btn-outline flex items-center justify-center gap-2 text-sm"
            >
              <Printer size={16} /> A4 Invoice
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={loading || !!error}
              onClick={() => downloadLuxuryInvoicePdf(sale, items, { format: 'a4' })}
              className="btn-outline flex items-center justify-center gap-2 text-sm"
            >
              <Download size={16} /> PDF (A4)
            </button>
            <button
              type="button"
              disabled={loading || !!error}
              onClick={() => downloadLuxuryInvoicePdf(sale, items, { format: 'thermal' })}
              className="btn-outline flex items-center justify-center gap-2 text-sm"
            >
              <Download size={16} /> PDF (Thermal)
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={loading || !!error || !customerPhone}
              onClick={() => openWhatsApp(customerPhone, buildInvoiceWhatsAppMessage(sale, items))}
              className="btn-gold flex items-center justify-center gap-2 text-sm py-2"
            >
              <MessageCircle size={16} /> WhatsApp Customer
            </button>
            <button
              type="button"
              disabled={loading || !!error}
              onClick={() => openWhatsApp(null, buildInvoiceWhatsAppMessage(sale, items))}
              className="btn-outline flex items-center justify-center gap-2 text-sm"
            >
              <MessageCircle size={16} /> Share to Shop
            </button>
          </div>
        </div>

        {inventoryUsage.length > 0 && (
          <p className="text-[11px] text-luxury-muted mt-3">
            Inventory used: {inventoryUsage.map((u) => `${u.name} (−${u.total}${u.stock_type === 'meter' ? 'm' : ' pcs'})`).join(', ')}
          </p>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState, useMemo } from 'react';
import { Printer, Download, MessageCircle, X, FileText, Search, RotateCcw } from 'lucide-react';
import { supabase, companyInfo } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { formatCurrency, formatDate, formatDateTime, formatStock, isLowStock } from '@/lib/format';
import LoadingSpinner from '../LoadingSpinner';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import ExportButtons from '@/components/ExportButtons';
import {
  buildSalesExportRows,
  SALES_EXPORT_COLUMNS,
} from '@/lib/export';
import ThermalInvoice from '@/components/ThermalInvoice';
import A4Invoice from '@/components/A4Invoice';
import { downloadLuxuryInvoicePdf } from '@/lib/invoicePdf';
import { buildInvoiceWhatsAppMessage, buildRefundWhatsAppMessage, openWhatsApp } from '@/lib/share';
import { downloadRefundPdf } from '@/lib/refundPdf';
import RefundDialog from '@/components/RefundDialog';
import { getRefundLog } from '@/lib/refund';

const TABS = [
  { id: 'daily', label: 'Daily Sales' },
  { id: 'monthly', label: 'Monthly Sales' },
  { id: 'search', label: 'Search Bills' },
  { id: 'vehicle', label: 'Vehicle History' },
  { id: 'expenses', label: 'Expenses', adminOnly: true },
  { id: 'inventory', label: 'Inventory' },
  { id: 'lowstock', label: 'Low Stock' },
  { id: 'topservices', label: 'Top Services' },
  { id: 'invusage', label: 'Inventory Usage' },
  { id: 'employees', label: 'Employee Sales' },
  { id: 'purchases', label: 'Purchase Reports' },
  { id: 'refunds', label: 'Refunds', adminOnly: true },
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
  const [searchQuery, setSearchQuery] = useState('');
  const [vehicleQuery, setVehicleQuery] = useState('');
  const [reprintSale, setReprintSale] = useState(null);
  const [reprintItems, setReprintItems] = useState([]);
  const [reprintLoading, setReprintLoading] = useState(false);
  const [reprintError, setReprintError] = useState('');
  const [fromDate, setFromDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [purchaseView, setPurchaseView] = useState('daily');
  const [refundDialogSale, setRefundDialogSale] = useState(null);
  const [refundLog, setRefundLog] = useState([]);
  const [refundLogLoading, setRefundLogLoading] = useState(false);
  const [refundView, setRefundView] = useState('daily');
  const [selectedRefundDate, setSelectedRefundDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedRefundMonth, setSelectedRefundMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [refundPrintLog, setRefundPrintLog] = useState(null);

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

  function printPurchaseReport() {
    document.body.classList.add('printing-purchase-report');
    window.print();
    setTimeout(() => document.body.classList.remove('printing-purchase-report'), 500);
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

  useEffect(() => {
    if (tab === 'refunds') loadRefundLog();
  }, [tab]);

  async function loadReports() {
    setLoading(true);
    const [salesRes, itemsRes, invRes, profRes, purchRes, usageRes] = await Promise.all([
      supabase
        .from('sales')
        .select('*, profiles!employee_id(full_name)')
        .order('created_at', { ascending: false }),
      supabase.from('sale_items').select('*'),
      supabase.from('inventory_items').select('*').order('name'),
      supabase.from('profiles').select('*'),
      supabase
        .from('inventory_purchases')
        .select('*, inventory_items(name), purchase_items(*)')
        .order('purchase_date', { ascending: false }),
      supabase
        .from('inventory_usage_report')
        .select('*')
        .order('created_at', { ascending: false }),
    ]);
    
    setSales(salesRes.data || []);
    setSaleItems(itemsRes.data || []);
    setInventory(invRes.data || []);
    setProfiles(profRes.data || []);
    setPurchases(purchRes.data || []);
    setInventoryUsage(usageRes.data || []);
    setLoading(false);
  }

  const activeSales = useMemo(() => sales.filter((s) => {
    if (!s.refunded_at) return true;
    return (Number(s.refunded_amount) || 0) < Number(s.total_amount);
  }), [sales]);

  const dailySales = useMemo(
    () =>
      activeSales.filter(
        (s) => format(new Date(s.sale_date || s.created_at), 'yyyy-MM-dd') === selectedDate
      ),
    [activeSales, selectedDate]
  );

  async function loadRefundLog() {
    setRefundLogLoading(true);
    try {
      const data = await getRefundLog();
      setRefundLog(data);
    } catch {
      setRefundLog([]);
    }
    setRefundLogLoading(false);
  }

  function handleRefundSuccess() {
    setRefundDialogSale(null);
    loadRefundLog();
    loadReports();
  }

  const dailyRefunds = useMemo(
    () =>
      refundLog.filter(
        (r) => format(new Date(r.refunded_at), 'yyyy-MM-dd') === selectedRefundDate
      ),
    [refundLog, selectedRefundDate]
  );

  const dailyRefundTotal = dailyRefunds.reduce((sum, r) => sum + Number(r.total_refunded), 0);

  const monthlyRefunds = useMemo(
    () =>
      refundLog.filter(
        (r) => format(new Date(r.refunded_at), 'yyyy-MM') === selectedRefundMonth
      ),
    [refundLog, selectedRefundMonth]
  );

  const monthlyRefundTotal = monthlyRefunds.reduce((sum, r) => sum + Number(r.total_refunded), 0);

  const monthlySales = useMemo(
    () =>
      activeSales.filter(
        (s) => format(new Date(s.sale_date || s.created_at), 'yyyy-MM') === selectedMonth
      ),
    [activeSales, selectedMonth]
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

  const today = format(new Date(), 'yyyy-MM-dd');
  const dailyPurchases = purchases.filter(p => p.purchase_date === today);
  const purchasesDailyTotal = dailyPurchases.reduce((s, p) => s + Number(p.total_cost || 0), 0);

  const monthlyGroupedPurchases = useMemo(() => {
    const groups = {};
    for (const p of purchases) {
      const month = p.purchase_date ? p.purchase_date.substring(0, 7) : 'unknown';
      if (!groups[month]) groups[month] = { month, total: 0, count: 0 };
      groups[month].total += Number(p.total_cost || 0);
      groups[month].count += 1;
    }
    return Object.values(groups).sort((a, b) => b.month.localeCompare(a.month));
  }, [purchases]);
  const monthlyGroupedTotal = monthlyGroupedPurchases.reduce((s, g) => s + g.total, 0);

  const rangePurchases = purchases.filter(p => p.purchase_date >= fromDate && p.purchase_date <= toDate);
  const rangeTotal = rangePurchases.reduce((s, p) => s + Number(p.total_cost || 0), 0);

  const lowStock = inventory.filter(isLowStock);
  const dailyExportRows = buildSalesExportRows(dailySales);
  const monthlyExportRows = buildSalesExportRows(monthlySales);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return sales
      .filter(
        (s) =>
          s.invoice_number?.toLowerCase().includes(q) ||
          s.customer_name?.toLowerCase().includes(q) ||
          s.customer_phone?.toLowerCase().includes(q) ||
          s.car_plate?.toLowerCase().includes(q) ||
          s.car_model?.toLowerCase().includes(q)
      )
      .slice(0, 100);
  }, [sales, searchQuery]);

  const vehicleResults = useMemo(() => {
    const q = vehicleQuery.trim().toLowerCase();
    if (!q) return [];
    return sales.filter(
      (s) =>
        s.car_plate?.toLowerCase().includes(q) ||
        s.car_model?.toLowerCase().includes(q)
    );
  }, [sales, vehicleQuery]);

  const vehicleStats = useMemo(() => {
    if (!vehicleResults.length) return null;
    const total = vehicleResults.reduce((s, r) => s + Number(r.total_amount || 0), 0);
    const first = vehicleResults[vehicleResults.length - 1];
    const last = vehicleResults[0];
    return {
      visits: vehicleResults.length,
      total,
      firstVisit: first.sale_date || first.created_at,
      lastVisit: last.sale_date || last.created_at,
    };
  }, [vehicleResults]);

  const expenseExportColumns = [
    { header: 'Date', accessor: (r) => formatDate(r.purchase_date) },
    { header: 'Bill', accessor: (r) => r.bill_number || '—' },
    { header: 'Supplier', accessor: (r) => r.supplier_name },
    { header: 'Item', accessor: (r) => r.inventory_items?.name || '—' },
    { header: 'Cost', accessor: (r) => formatCurrency(r.total_cost) },
  ];

  if (loading) return <LoadingSpinner message="Loading reports..." />;

  return (
    <div className="p-4 sm:p-6 lg:p-8 animate-fade-in">
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-gold-400">Reports</h1>
        <p className="text-luxury-muted text-sm sm:text-base">Export daily/monthly sales, inventory, and expenses</p>
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

      {tab === 'search' && (
        <div className="space-y-4">
          <div className="relative max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-luxury-muted" size={18} />
            <input
              className="input-luxury pl-10"
              autoFocus
              placeholder="Invoice #, customer name, phone, or plate…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {searchQuery.trim() === '' ? (
            <p className="text-luxury-muted text-sm">
              Type to find any past invoice. Up to 100 results shown.
            </p>
          ) : (
            <>
              <p className="text-luxury-muted text-xs">
                {searchResults.length} result{searchResults.length === 1 ? '' : 's'}
              </p>
              <SalesTable data={searchResults} onReprint={openReprint} />
            </>
          )}
        </div>
      )}

      {tab === 'vehicle' && (
        <div className="space-y-4">
          <div className="relative max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-luxury-muted" size={18} />
            <input
              className="input-luxury pl-10"
              autoFocus
              placeholder="Plate number or car model…"
              value={vehicleQuery}
              onChange={(e) => setVehicleQuery(e.target.value)}
            />
          </div>
          {!vehicleQuery.trim() ? (
            <p className="text-luxury-muted text-sm">
              Look up every service done on a specific car. Search by plate or model.
            </p>
          ) : vehicleStats ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="card-luxury p-4">
                  <p className="text-luxury-muted text-xs">Visits</p>
                  <p className="text-2xl font-bold text-gold-400">{vehicleStats.visits}</p>
                </div>
                <div className="card-luxury p-4">
                  <p className="text-luxury-muted text-xs">Total Spent</p>
                  <p className="text-2xl font-bold text-gold-400">{formatCurrency(vehicleStats.total)}</p>
                </div>
                <div className="card-luxury p-4">
                  <p className="text-luxury-muted text-xs">First Visit</p>
                  <p className="text-sm font-medium">{formatDate(vehicleStats.firstVisit)}</p>
                </div>
                <div className="card-luxury p-4">
                  <p className="text-luxury-muted text-xs">Last Visit</p>
                  <p className="text-sm font-medium">{formatDate(vehicleStats.lastVisit)}</p>
                </div>
              </div>
              <SalesTable data={vehicleResults} onReprint={openReprint} />
            </>
          ) : (
            <p className="text-luxury-muted text-sm">No services match "{vehicleQuery}".</p>
          )}
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
                      No inventory usage this month
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
        isAdmin={isAdmin}
        onRefund={setRefundDialogSale}
      />

      {reprintSale && (
        <>
          <ThermalInvoice sale={reprintSale} items={reprintItems} inventoryUsage={reprintInventoryUsage} />
          <A4Invoice sale={reprintSale} items={reprintItems} inventoryUsage={reprintInventoryUsage} />
        </>
      )}

      {tab === 'purchases' && (
        <div className="space-y-4" data-print-area="purchase-report">
          <div className="flex flex-wrap gap-2">
            {['date', 'daily', 'monthly', 'range'].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setPurchaseView(v)}
                className={`px-4 py-2 rounded-lg text-sm capitalize ${
                  purchaseView === v
                    ? 'bg-gold-600/20 text-gold-400 border border-gold-600/30'
                    : 'bg-luxury-slate text-gray-400'
                }`}
              >
                {v === 'date' ? 'By Date' : v === 'daily' ? 'Daily' : v === 'monthly' ? 'Monthly' : 'Date Range'}
              </button>
            ))}
          </div>

          {purchaseView === 'date' && (
            <>
              <div>
                <label className="label-luxury">Select Date</label>
                <input
                  type="date"
                  className="input-luxury w-auto"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>
              <div className="card-luxury flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-gold-400">{formatCurrency(purchasesDailyTotal)}</p>
                  <p className="text-luxury-muted text-sm">{dailyPurchases.length} purchase bills on {selectedDate}</p>
                </div>
                <button type="button" onClick={printPurchaseReport} className="btn-outline flex items-center gap-2 text-sm">
                  <Printer size={16} /> Print
                </button>
              </div>
              <div className="card-luxury overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-luxury-muted border-b border-luxury-border">
                      <th className="text-left py-3 px-2">Supplier</th>
                      <th className="text-left py-3 px-2">Bill #</th>
                      <th className="text-left py-3 px-2">Item</th>
                      <th className="text-right py-3 px-2">Qty</th>
                      <th className="text-right py-3 px-2">Unit Cost</th>
                      <th className="text-right py-3 px-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyPurchases.map((p) => {
                      const billItems = p.purchase_items || [];
                      if (billItems.length > 0) {
                        return billItems.map((i, idx) => (
                          <tr key={i.id || `${p.id}-${idx}`} className="border-b border-luxury-border/50">
                            {idx === 0 && (
                              <>
                                <td className="py-3 px-2" rowSpan={billItems.length}>{p.supplier_name}</td>
                                <td className="py-3 px-2" rowSpan={billItems.length}>{p.bill_number || '—'}</td>
                              </>
                            )}
                            <td className="py-3 px-2">{i.item_name}</td>
                            <td className="py-3 px-2 text-right">{Number(i.quantity)}</td>
                            <td className="py-3 px-2 text-right">{formatCurrency(i.unit_cost)}</td>
                            <td className="py-3 px-2 text-right text-gold-400">{formatCurrency(i.total_cost)}</td>
                          </tr>
                        ));
                      }
                      return (
                        <tr key={p.id} className="border-b border-luxury-border/50">
                          <td className="py-3 px-2">{p.supplier_name}</td>
                          <td className="py-3 px-2">{p.bill_number || '—'}</td>
                          <td className="py-3 px-2">{p.inventory_items?.name || '—'}</td>
                          <td className="py-3 px-2 text-right">{p.meters_added > 0 ? `${p.meters_added}m` : `${p.quantity_added} pcs`}</td>
                          <td className="py-3 px-2 text-right">{formatCurrency(p.unit_cost)}</td>
                          <td className="py-3 px-2 text-right text-gold-400">{formatCurrency(p.total_cost)}</td>
                        </tr>
                      );
                    })}
                    <tr className="border-t-2 border-gold-500/30 font-semibold">
                      <td colSpan={5} className="py-3 px-2 text-right text-gold-400">Grand Total</td>
                      <td className="py-3 px-2 text-right text-gold-400">{formatCurrency(purchasesDailyTotal)}</td>
                    </tr>
                    {dailyPurchases.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-luxury-muted">No purchases on this date</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {purchaseView === 'daily' && (
            <>
              <div className="card-luxury flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-gold-400">{formatCurrency(purchasesDailyTotal)}</p>
                  <p className="text-luxury-muted text-sm">{dailyPurchases.length} purchase bills today</p>
                </div>
                <button type="button" onClick={printPurchaseReport} className="btn-outline flex items-center gap-2 text-sm">
                  <Printer size={16} /> Print
                </button>
              </div>
              <div className="card-luxury overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-luxury-muted border-b border-luxury-border">
                      <th className="text-left py-3 px-2">Supplier</th>
                      <th className="text-left py-3 px-2">Bill #</th>
                      <th className="text-left py-3 px-2">Item</th>
                      <th className="text-right py-3 px-2">Qty</th>
                      <th className="text-right py-3 px-2">Unit Cost</th>
                      <th className="text-right py-3 px-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyPurchases.map((p) => {
                      const billItems = p.purchase_items || [];
                      if (billItems.length > 0) {
                        return billItems.map((i, idx) => (
                          <tr key={i.id || `${p.id}-${idx}`} className="border-b border-luxury-border/50">
                            {idx === 0 && (
                              <>
                                <td className="py-3 px-2" rowSpan={billItems.length}>{p.supplier_name}</td>
                                <td className="py-3 px-2" rowSpan={billItems.length}>{p.bill_number || '—'}</td>
                              </>
                            )}
                            <td className="py-3 px-2">{i.item_name}</td>
                            <td className="py-3 px-2 text-right">{Number(i.quantity)}</td>
                            <td className="py-3 px-2 text-right">{formatCurrency(i.unit_cost)}</td>
                            <td className="py-3 px-2 text-right text-gold-400">{formatCurrency(i.total_cost)}</td>
                          </tr>
                        ));
                      }
                      return (
                        <tr key={p.id} className="border-b border-luxury-border/50">
                          <td className="py-3 px-2">{p.supplier_name}</td>
                          <td className="py-3 px-2">{p.bill_number || '—'}</td>
                          <td className="py-3 px-2">{p.inventory_items?.name || '—'}</td>
                          <td className="py-3 px-2 text-right">{p.meters_added > 0 ? `${p.meters_added}m` : `${p.quantity_added} pcs`}</td>
                          <td className="py-3 px-2 text-right">{formatCurrency(p.unit_cost)}</td>
                          <td className="py-3 px-2 text-right text-gold-400">{formatCurrency(p.total_cost)}</td>
                        </tr>
                      );
                    })}
                    <tr className="border-t-2 border-gold-500/30 font-semibold">
                      <td colSpan={5} className="py-3 px-2 text-right text-gold-400">Grand Total</td>
                      <td className="py-3 px-2 text-right text-gold-400">{formatCurrency(purchasesDailyTotal)}</td>
                    </tr>
                    {dailyPurchases.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-luxury-muted">No purchases today</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {purchaseView === 'monthly' && (
            <>
              <div className="card-luxury flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-gold-400">{formatCurrency(monthlyGroupedTotal)}</p>
                  <p className="text-luxury-muted text-sm">{monthlyGroupedPurchases.length} months with purchases</p>
                </div>
                <button type="button" onClick={printPurchaseReport} className="btn-outline flex items-center gap-2 text-sm">
                  <Printer size={16} /> Print
                </button>
              </div>
              <div className="card-luxury overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-luxury-muted border-b border-luxury-border">
                      <th className="text-left py-3 px-2">Month</th>
                      <th className="text-right py-3 px-2">Bills</th>
                      <th className="text-right py-3 px-2">Total Spend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyGroupedPurchases.map((g) => (
                      <tr key={g.month} className="border-b border-luxury-border/50">
                        <td className="py-3 px-2">{g.month}</td>
                        <td className="py-3 px-2 text-right">{g.count}</td>
                        <td className="py-3 px-2 text-right text-gold-400">{formatCurrency(g.total)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-gold-500/30 font-semibold">
                      <td colSpan={2} className="py-3 px-2 text-right text-gold-400">Grand Total</td>
                      <td className="py-3 px-2 text-right text-gold-400">{formatCurrency(monthlyGroupedTotal)}</td>
                    </tr>
                    {monthlyGroupedPurchases.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-8 text-center text-luxury-muted">No purchase data</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {purchaseView === 'range' && (
            <>
              <div className="flex flex-wrap gap-3">
                <div>
                  <label className="label-luxury block mb-1">From</label>
                  <input type="date" className="input-luxury" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                </div>
                <div>
                  <label className="label-luxury block mb-1">To</label>
                  <input type="date" className="input-luxury" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                </div>
              </div>
              <div className="card-luxury flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-gold-400">{formatCurrency(rangeTotal)}</p>
                  <p className="text-luxury-muted text-sm">{rangePurchases.length} purchase bills in range</p>
                </div>
                <button type="button" onClick={printPurchaseReport} className="btn-outline flex items-center gap-2 text-sm">
                  <Printer size={16} /> Print
                </button>
              </div>
              <div className="card-luxury overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-luxury-muted border-b border-luxury-border">
                      <th className="text-left py-3 px-2">Date</th>
                      <th className="text-left py-3 px-2">Supplier</th>
                      <th className="text-left py-3 px-2">Bill #</th>
                      <th className="text-left py-3 px-2">Item</th>
                      <th className="text-right py-3 px-2">Qty</th>
                      <th className="text-right py-3 px-2">Unit Cost</th>
                      <th className="text-right py-3 px-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rangePurchases.map((p) => {
                      const billItems = p.purchase_items || [];
                      if (billItems.length > 0) {
                        return billItems.map((i, idx) => (
                          <tr key={i.id || `${p.id}-${idx}`} className="border-b border-luxury-border/50">
                            {idx === 0 && (
                              <>
                                <td className="py-3 px-2" rowSpan={billItems.length}>{formatDate(p.purchase_date)}</td>
                                <td className="py-3 px-2" rowSpan={billItems.length}>{p.supplier_name}</td>
                                <td className="py-3 px-2" rowSpan={billItems.length}>{p.bill_number || '—'}</td>
                              </>
                            )}
                            <td className="py-3 px-2">{i.item_name}</td>
                            <td className="py-3 px-2 text-right">{Number(i.quantity)}</td>
                            <td className="py-3 px-2 text-right">{formatCurrency(i.unit_cost)}</td>
                            <td className="py-3 px-2 text-right text-gold-400">{formatCurrency(i.total_cost)}</td>
                          </tr>
                        ));
                      }
                      return (
                        <tr key={p.id} className="border-b border-luxury-border/50">
                          <td className="py-3 px-2">{formatDate(p.purchase_date)}</td>
                          <td className="py-3 px-2">{p.supplier_name}</td>
                          <td className="py-3 px-2">{p.bill_number || '—'}</td>
                          <td className="py-3 px-2">{p.inventory_items?.name || '—'}</td>
                          <td className="py-3 px-2 text-right">{p.meters_added > 0 ? `${p.meters_added}m` : `${p.quantity_added} pcs`}</td>
                          <td className="py-3 px-2 text-right">{formatCurrency(p.unit_cost)}</td>
                          <td className="py-3 px-2 text-right text-gold-400">{formatCurrency(p.total_cost)}</td>
                        </tr>
                      );
                    })}
                    <tr className="border-t-2 border-gold-500/30 font-semibold">
                      <td colSpan={6} className="py-3 px-2 text-right text-gold-400">Grand Total</td>
                      <td className="py-3 px-2 text-right text-gold-400">{formatCurrency(rangeTotal)}</td>
                    </tr>
                    {rangePurchases.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-luxury-muted">No purchases in this date range</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
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

      {tab === 'refunds' && isAdmin && (
        <div className="space-y-4" data-print-area="refund-report">
          <div className="flex items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              {['daily','monthly','all'].map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    refundView === v ? 'bg-gold-500 text-black' : 'bg-luxury-card text-luxury-muted'
                  }`}
                  onClick={() => setRefundView(v)}
                >
                  {v === 'daily' ? 'Daily Refunds' : v === 'monthly' ? 'Monthly Refunds' : 'All Refunds'}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => { document.body.classList.add('printing-refund-report'); window.print(); setTimeout(() => document.body.classList.remove('printing-refund-report'), 500); }}
              className="btn-outline flex items-center gap-2 text-sm"
            >
              <Printer size={16} /> Print
            </button>
          </div>

          {refundView === 'daily' && (
            <div className="space-y-4">
              <input
                type="date"
                className="input-luxury w-auto"
                value={selectedRefundDate}
                onChange={(e) => setSelectedRefundDate(e.target.value)}
              />
              <div className="card-luxury">
                <p className="text-3xl font-bold text-red-400">{formatCurrency(dailyRefundTotal)}</p>
                <p className="text-luxury-muted">{dailyRefunds.length} refunds</p>
              </div>
              <RefundTable data={dailyRefunds} loading={refundLogLoading} onPrint={setRefundPrintLog} />
            </div>
          )}

          {refundView === 'monthly' && (
            <div className="space-y-4">
              <input
                type="month"
                className="input-luxury w-auto"
                value={selectedRefundMonth}
                onChange={(e) => setSelectedRefundMonth(e.target.value)}
              />
              <div className="card-luxury">
                <p className="text-2xl font-bold text-red-400">{formatCurrency(monthlyRefundTotal)}</p>
                <p className="text-luxury-muted">{monthlyRefunds.length} refunds</p>
              </div>
              <RefundTable data={monthlyRefunds} loading={refundLogLoading} onPrint={setRefundPrintLog} />
            </div>
          )}

          {refundView === 'all' && (
            <div className="card-luxury">
              <p className="text-sm text-luxury-muted">All Refunds</p>
              <p className="text-3xl font-bold text-gold-400">{refundLog.length} total</p>
            </div>
          )}
          {refundView === 'all' && <RefundTable data={refundLog} loading={refundLogLoading} onPrint={setRefundPrintLog} />}
        </div>
      )}

      <RefundDialog
        sale={refundDialogSale}
        onClose={() => setRefundDialogSale(null)}
        onRefunded={handleRefundSuccess}
      />
      <RefundPrintModal
        group={refundPrintLog}
        onClose={() => setRefundPrintLog(null)}
      />
    </div>
  );
}

function SalesTable({ data, onReprint }) {
  const [page, setPage] = useState(1);
  const perPage = 20;
  const total = Math.ceil(data.length / perPage) || 1;
  const paginated = data.slice((page - 1) * perPage, page * perPage);

  useEffect(() => { setPage(1); }, [data]);

  return (
    <div>
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
            {paginated.map((s) => (
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
            {paginated.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-luxury-muted">
                  No sales for this period
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4">
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          className="px-3 py-1 bg-gray-800 text-white rounded disabled:opacity-40"
        >Previous</button>
        <span className="text-gray-400 text-sm">Page {page} of {total}</span>
        <button
          onClick={() => setPage(p => p + 1)}
          disabled={page >= total}
          className="px-3 py-1 bg-gray-800 text-white rounded disabled:opacity-40"
        >Next</button>
      </div>
    </div>
  );
}

function RefundTable({ data, loading, onPrint }) {
  const groups = [];
  const map = new Map();
  data.forEach((r) => {
    const key = r.sale_id;
    if (!map.has(key)) {
      map.set(key, {
        sale_id: key,
        sale: r.sales,
        refunds: [],
        total_refunded: 0,
      });
    }
    const entry = map.get(key);
    entry.refunds.push(r);
    entry.total_refunded += Number(r.total_refunded);
  });
  for (const entry of map.values()) {
    groups.push(entry);
  }
  groups.sort((a, b) => {
    const aDate = a.refunds[0]?.refunded_at || '';
    const bDate = b.refunds[0]?.refunded_at || '';
    return bDate.localeCompare(aDate);
  });

  return (
    <div className="card-luxury overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-luxury-muted border-b border-luxury-border">
            <th className="text-left py-3 px-2">Date</th>
            <th className="text-left py-3 px-2">Invoice</th>
            <th className="text-left py-3 px-2">Customer</th>
            <th className="text-right py-3 px-2">Refunded</th>
            <th className="text-center py-3 px-2">Refunds</th>
            <th className="text-left py-3 px-2">Reason</th>
            <th className="text-center py-3 px-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={7} className="py-8 text-center text-luxury-muted">Loading...</td>
            </tr>
          ) : groups.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-8 text-center text-luxury-muted">No refunds recorded yet</td>
            </tr>
          ) : (
            groups.map((g) => {
              const latest = g.refunds[0];
              const allItems = g.refunds.flatMap((r) =>
                Array.isArray(r.items_refunded) ? r.items_refunded : []
              );
              return (
                <tr key={g.sale_id} className="border-b border-luxury-border/50">
                  <td className="py-3 px-2">{formatDateTime(latest.refunded_at)}</td>
                  <td className="py-3 px-2 font-mono text-xs">{g.sale?.invoice_number || '—'}</td>
                  <td className="py-3 px-2">{g.sale?.customer_name || '—'}</td>
                  <td className="py-3 px-2 text-right text-red-400 font-medium">{formatCurrency(g.total_refunded)}</td>
                  <td className="py-3 px-2 text-center text-xs text-luxury-muted">{g.refunds.length}x</td>
                  <td className="py-3 px-2 max-w-[160px] truncate text-xs">{latest.refund_reason}</td>
                  <td className="py-3 px-2 text-center">
                    <button
                      type="button"
                      onClick={() => onPrint?.(g)}
                      className="text-gold-400 hover:text-gold-300 text-xs flex items-center gap-1 mx-auto"
                    >
                      <Printer size={14} /> Print Slip
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, function (m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    if (m === '"') return '&quot;';
    return '&#39;';
  });
}

function RefundPrintModal({ group, onClose }) {
  if (!group) return null;
  const { sale, refunds, total_refunded } = group;
  const allItems = refunds.flatMap((r) =>
    Array.isArray(r.items_refunded) ? r.items_refunded : []
  );
  const latest = refunds[0];

  function buildRefundSlipHtml() {
    const logoUrl = window.location.origin + '/logo.png';
    const itemsHtml = allItems.length === 0
      ? '<tr><td colspan="3" style="text-align:center;padding:8px;color:#666;font-family:\'Courier New\',monospace;font-size:10px;">No items</td></tr>'
      : allItems.map((it) =>
        `<tr>
          <td style="padding:4px 8px;text-align:left;border-bottom:1px solid #ddd;font-family:'Courier New',monospace;font-size:10px;">${escapeHtml(it.service_name)}</td>
          <td style="padding:4px 8px;text-align:center;border-bottom:1px solid #ddd;font-family:'Courier New',monospace;font-size:10px;">${it.quantity}</td>
          <td style="padding:4px 8px;text-align:right;border-bottom:1px solid #ddd;font-family:'Courier New',monospace;font-size:10px;">${formatCurrency(it.line_total)}</td>
        </tr>`
      ).join('');

    return `<!DOCTYPE html>
<html>
<head><title>Refund Slip - ${escapeHtml(sale?.invoice_number || '')}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: 12px; color: #000; background: #fff; padding: 16px; width: 80mm; margin: 0 auto; }
  .header { text-align: center; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 2px dashed #000; }
  .header img { width: 80px; height: 80px; object-fit: contain; margin: 0 auto 8px; display: block; }
  .company-name { font-weight: bold; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }
  .company-detail { font-size: 10px; color: #333; line-height: 1.4; margin-top: 4px; }
  hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
  .info-row { padding: 2px 0; font-size: 11px; }
  .info-row strong { font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 10px; }
  th { padding: 4px 0; border-bottom: 2px solid #000; text-align: left; font-size: 10px; }
  th.right { text-align: right; }
  th.center { text-align: center; }
  td { padding: 4px 0; border-bottom: 1px solid #ddd; }
  td.right { text-align: right; }
  td.center { text-align: center; }
  .totals { font-size: 11px; }
  .totals .row { display: flex; justify-content: space-between; padding: 2px 0; }
  .totals .grand { font-weight: bold; font-size: 13px; border-top: 1px solid #000; padding-top: 4px; margin-top: 4px; }
  .totals .grand.total-refunded { color: #dc2626; }
  .footer { text-align: center; margin-top: 12px; padding-top: 8px; border-top: 2px dashed #000; font-size: 10px; color: #333; }
  .note { font-size: 10px; color: #888; text-align: center; margin: 4px 0; }
  .payment { font-size: 10px; margin-top: 4px; text-transform: capitalize; }
  @media print { body { padding: 0; } }
</style></head>
<body>
  <div class="header">
    <img src="${logoUrl}" alt="${escapeHtml(companyInfo.name || 'Arizona Car World')}" />
    <p class="company-name">${escapeHtml(companyInfo.name || 'Arizona Car World')}</p>
    <p class="company-detail">${escapeHtml(companyInfo.address || '')}</p>
    ${companyInfo.phone ? `<p class="company-detail">Tel: ${escapeHtml(companyInfo.phone)}</p>` : ''}
    ${companyInfo.whatsapp ? `<p class="company-detail">WhatsApp: ${escapeHtml(companyInfo.whatsapp)}</p>` : ''}
    ${companyInfo.instagram ? `<p class="company-detail">IG: ${escapeHtml(companyInfo.instagram)}</p>` : ''}
  </div>

  <hr />

  <p class="info-row"><strong>Refund Slip</strong></p>

  <hr />

  <p class="info-row"><strong>Invoice #</strong> ${escapeHtml(sale?.invoice_number || '—')}</p>
  <p class="info-row"><strong>Date:</strong> ${formatDateTime(latest?.refunded_at)}</p>

  <hr />

  <p class="info-row"><strong>Customer:</strong> ${escapeHtml(sale?.customer_name || '—')}</p>
  ${sale?.customer_phone ? `<p class="info-row"><strong>Phone:</strong> ${escapeHtml(sale.customer_phone)}</p>` : ''}
  ${sale?.car_model ? `<p class="info-row"><strong>Vehicle:</strong> ${escapeHtml(sale.car_model)}</p>` : ''}
  ${sale?.car_plate ? `<p class="info-row"><strong>Plate:</strong> ${escapeHtml(sale.car_plate)}</p>` : ''}

  <hr />

  <table>
    <thead>
      <tr>
        <th>Service / Item</th>
        <th class="center">Qty</th>
        <th class="right">Amt</th>
      </tr>
    </thead>
    <tbody>${itemsHtml}</tbody>
  </table>

  <hr />

  <div class="totals">
    <div class="row grand total-refunded">
      <span>Total Refunded</span>
      <span>${formatCurrency(total_refunded)}</span>
    </div>
    <div class="row">
      <span>Original Total</span>
      <span>${formatCurrency(sale?.total_amount || 0)}</span>
    </div>
    <p class="payment">Payment: ${escapeHtml((sale?.payment_method || '').replace('_', ' ') || '—')}</p>
  </div>

  <hr />

  <p class="info-row"><strong>Reason:</strong> ${escapeHtml(latest?.refund_reason || '—')}</p>
  <p class="info-row"><strong>Processed By:</strong> ${escapeHtml(latest?.profiles?.full_name || '—')}</p>
  ${refunds.length > 1 ? `<p class="note">This bill has ${refunds.length} refund transaction(s)</p>` : ''}

  <hr />

  <div class="footer">
    <p>Thank you for choosing ${escapeHtml(companyInfo.name || 'Arizona Car World')}</p>
    ${companyInfo.whatsapp ? `<p>WhatsApp: ${escapeHtml(companyInfo.whatsapp)}</p>` : ''}
  </div>
</body></html>`;
  }

  function openPrintWindow(html) {
    const w = window.open('', '_blank', 'width=400,height=600,scrollbars=yes');
    if (!w) { alert('Please allow popups to print the refund slip.'); return null; }
    w.document.write(html);
    w.document.close();
    w.focus();
    return w;
  }

  function autoClosePrintWindow(w) {
    const closeCheck = setInterval(() => {
      try {
        if (w.closed) { clearInterval(closeCheck); return; }
        if (w.matchMedia) {
          const mq = w.matchMedia('print');
          mq.addEventListener('change', function handler(e) {
            if (!e.matches) {
              mq.removeEventListener('change', handler);
              setTimeout(() => { try { if (!w.closed) w.close(); } catch (_) {} }, 500);
            }
          });
        }
        clearInterval(closeCheck);
      } catch (_) { clearInterval(closeCheck); }
    }, 100);
  }

  function handleThermalPrint() {
    const w = openPrintWindow(buildRefundSlipHtml());
    if (w) {
      setTimeout(() => { w.print(); autoClosePrintWindow(w); }, 500);
    }
  }

  function handleA4Print() {
    const html = buildRefundSlipHtml();
    const a4Html = html.replace(
      '</style>',
      'body { width: 210mm !important; padding: 20mm !important; font-size: 12px !important; }</style>'
    );
    const w = openPrintWindow(a4Html);
    if (w) {
      setTimeout(() => { w.print(); autoClosePrintWindow(w); }, 500);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="card-luxury w-full max-w-lg max-h-[95vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <RotateCcw className="text-red-400" size={24} />
            <div>
              <p className="text-xs uppercase tracking-wider text-red-400">Refund Slip</p>
              <h3 className="text-xl font-display text-gold-400 font-bold">{sale?.invoice_number || 'Refund'}</h3>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-luxury-muted hover:text-gold-300 p-1">
            <X size={20} />
          </button>
        </div>

        <div className="bg-luxury-slate/50 rounded-xl p-4 mb-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-luxury-muted">Customer</span>
            <span>{sale?.customer_name || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-luxury-muted">Date</span>
            <span>{formatDateTime(latest?.refunded_at)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-luxury-muted">Total Refunded</span>
            <span className="text-red-400 font-bold">{formatCurrency(total_refunded)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-luxury-muted">Original Total</span>
            <span>{formatCurrency(sale?.total_amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-luxury-muted">Payment</span>
            <span className="capitalize">{sale?.payment_method?.replace('_', ' ') || '—'}</span>
          </div>
        </div>

        <p className="text-sm text-luxury-muted mb-2">Refunded Items:</p>
        <div className="space-y-2 mb-4">
          {allItems.length === 0 ? (
            <p className="text-sm text-luxury-muted">No items recorded</p>
          ) : (
            allItems.map((it, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-red-500/20 bg-red-950/5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{it.service_name}</p>
                  <p className="text-xs text-luxury-muted">
                    Qty: {it.quantity} × {formatCurrency(it.line_total)}
                  </p>
                </div>
                <div className="text-right text-sm font-medium text-red-400">
                  {formatCurrency(it.line_total)}
                </div>
              </div>
            ))
          )}
        </div>

        {refunds.length > 1 && (
          <p className="text-xs text-luxury-muted mb-3">
            This bill has {refunds.length} refund transaction(s)
          </p>
        )}

        <label className="label-luxury block mb-1">Reason</label>
        <p className="text-sm mb-4 bg-luxury-slate/30 rounded-lg p-3">{latest?.refund_reason || '—'}</p>

        <label className="label-luxury block mb-1">Processed By</label>
        <p className="text-sm mb-4">{latest?.profiles?.full_name || '—'}</p>

        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={handleThermalPrint} className="btn-outline flex items-center justify-center gap-2 text-sm">
              <Printer size={16} /> Thermal (80mm)
            </button>
            <button type="button" onClick={handleA4Print} className="btn-outline flex items-center justify-center gap-2 text-sm">
              <Printer size={16} /> A4 Slip
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => downloadRefundPdf(sale, refunds, totalRefunded, allItems, { format: 'a4' })} className="btn-outline flex items-center justify-center gap-2 text-sm">
              <Download size={16} /> PDF (A4)
            </button>
            <button type="button" onClick={() => downloadRefundPdf(sale, refunds, totalRefunded, allItems, { format: 'thermal' })} className="btn-outline flex items-center justify-center gap-2 text-sm">
              <Download size={16} /> PDF (Thermal)
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={!sale?.customer_phone} onClick={() => openWhatsApp(sale?.customer_phone, buildRefundWhatsAppMessage(sale, refunds, totalRefunded, allItems))} className="btn-gold flex items-center justify-center gap-2 text-sm py-2">
              <MessageCircle size={16} /> WhatsApp Customer
            </button>
            <button type="button" onClick={() => openWhatsApp(null, buildRefundWhatsAppMessage(sale, refunds, totalRefunded, allItems))} className="btn-outline flex items-center justify-center gap-2 text-sm">
              <MessageCircle size={16} /> Share to Shop
            </button>
          </div>
        </div>
        <button type="button" onClick={onClose} className="btn-outline w-full flex items-center justify-center gap-2 py-2 mt-2">
          Close
        </button>
      </div>
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
  isAdmin,
  onRefund,
}) {
  if (!sale) return null;
  const customerPhone = sale.customer_phone;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-2 sm:p-4 print:hidden"
      onClick={onClose}
    >
      <div
        className="card-luxury w-full max-w-3xl max-h-[95vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-gold-500">Invoice Preview</p>
            <h3 className="text-xl font-display text-gold-400 font-bold">{sale.invoice_number}</h3>
            <p className="text-xs text-luxury-muted mt-1">
              {formatDateTime(sale.sale_date || sale.created_at)}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close invoice"
            onClick={onClose}
            className="text-luxury-muted hover:text-gold-300 p-1"
          >
            <X size={20} />
          </button>
        </div>

        {/* Invoice preview pane — mimics the printed A4 look on a light card */}
        <div className="bg-white text-gray-900 rounded-xl border-2 border-gold-600/30 p-5 sm:p-6 mb-4 shadow-inner">
          <header className="flex flex-wrap justify-between items-start gap-3 border-b-2 border-amber-700 pb-3 mb-4">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="Arizona Car World" className="w-14 h-14 object-contain" />
              <div>
                <p className="font-bold text-sm sm:text-base text-gray-900">Arizona Car World</p>
                <p className="text-[11px] text-gray-600">Detailing · PPF · Tint</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg sm:text-xl font-bold text-amber-700">INVOICE</p>
              <p className="font-mono text-sm text-gray-900">{sale.invoice_number}</p>
              <p className="text-[11px] text-gray-500">
                {formatDateTime(sale.sale_date || sale.created_at)}
              </p>
            </div>
          </header>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm mb-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold mb-1">
                Bill To
              </p>
              <p className="font-semibold">{sale.customer_name}</p>
              {sale.customer_phone && <p className="text-gray-700">{sale.customer_phone}</p>}
              {(sale.car_model || sale.car_plate) && (
                <p className="text-gray-600">
                  Vehicle: {[sale.car_model, sale.car_plate].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            <div className="sm:text-right">
              <p className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold mb-1">
                Payment
              </p>
              <p className="capitalize font-medium">{sale.payment_method?.replace('_', ' ')}</p>
            </div>
          </div>

          {loading && <p className="text-gray-500 text-sm">Loading invoice items…</p>}
          {error && <p className="text-red-600 text-sm">{error}</p>}

          {!loading && !error && (
            <>
              <table className="w-full text-xs sm:text-sm mb-4">
                <thead>
                  <tr className="bg-amber-50 border-y border-amber-200">
                    <th className="text-left py-2 px-2">Description</th>
                    <th className="text-center py-2 px-2 w-12">Qty</th>
                    <th className="text-right py-2 px-2 w-20">Unit</th>
                    <th className="text-right py-2 px-2 w-24">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id} className="border-b border-gray-100">
                      <td className="py-2 px-2">{it.service_name}</td>
                      <td className="text-center py-2 px-2">{it.quantity}</td>
                      <td className="text-right py-2 px-2">{formatCurrency(it.unit_price)}</td>
                      <td className="text-right py-2 px-2 font-medium">
                        {Number(it.line_total) > 0 ? formatCurrency(it.line_total) : '—'}
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-gray-500">No items</td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="flex justify-end">
                <div className="w-full sm:w-64 space-y-1 text-xs sm:text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal</span>
                    <span>{formatCurrency(sale.subtotal)}</span>
                  </div>
                  {Number(sale.discount) > 0 && (
                    <div className="flex justify-between text-red-700">
                      <span>Discount</span>
                      <span>−{formatCurrency(sale.discount)}</span>
                    </div>
                  )}
                  {Number(sale.tax_amount) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tax ({sale.tax_rate}%)</span>
                      <span>{formatCurrency(sale.tax_amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-amber-800 border-t-2 border-amber-700 pt-1.5 text-base">
                    <span>Total</span>
                    <span>{formatCurrency(sale.total_amount)}</span>
                  </div>
                </div>
              </div>

              {sale.notes && (
                <p className="text-xs text-gray-600 mt-3 border-t border-gray-200 pt-2">
                  <strong>Notes:</strong> {sale.notes}
                </p>
              )}
            </>
          )}
        </div>

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

          {isAdmin && (!sale.refunded_at || Number(sale.refunded_amount) < Number(sale.total_amount)) && (
            <button
              type="button"
              disabled={loading || !!error}
              onClick={() => onRefund?.(sale)}
              className="btn-outline w-full flex items-center justify-center gap-2 text-sm py-2 mt-2 border-red-500/40 text-red-300 hover:bg-red-950/20"
            >
              <RotateCcw size={16} /> Refund This Invoice
            </button>
          )}
          {(sale.refunded_at && Number(sale.refunded_amount) >= Number(sale.total_amount)) && (
            <p className="text-xs text-red-400 text-center mt-2">
              Refunded on {formatDateTime(sale.refunded_at)}
            </p>
          )}
          {(sale.refunded_at && Number(sale.refunded_amount) > 0 && Number(sale.refunded_amount) < Number(sale.total_amount)) && (
            <p className="text-xs text-amber-400 text-center mt-2">
              Partially refunded ({formatCurrency(sale.refunded_amount)} of {formatCurrency(sale.total_amount)})
            </p>
          )}

          {inventoryUsage.length > 0 && (
          <p className="text-[11px] text-luxury-muted mt-3">
            Inventory used: {inventoryUsage.map((u) => `${u.name} (−${u.total}${u.stock_type === 'meter' ? 'm' : ' pcs'})`).join(', ')}
          </p>
        )}
      </div>
    </div>
  );
}

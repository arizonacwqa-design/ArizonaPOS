import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Package,
  ShoppingCart,
  Receipt,
  Award,
  Boxes,
  PiggyBank,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { useThemeStore } from '@/store/themeStore';
import { formatCurrency, formatStock, isLowStock } from '@/lib/format';
import StatCard from '@/components/StatCard';
import LowStockBanner from '@/components/LowStockBanner';
import LuxuryTable from '@/components/LuxuryTable';
import { StatCardSkeleton, PageHeaderSkeleton } from '@/components/LoadingSkeleton';
import { startOfDay, startOfMonth, subDays, format, parseISO } from 'date-fns';

import { useTranslation } from '@/lib/translations';

export default function Dashboard() {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const isDark = theme === 'dark';
  const [todaySales, setTodaySales] = useState(0);
  const [monthSales, setMonthSales] = useState(0);
  const [monthExpenses, setMonthExpenses] = useState(0);
  const [monthOperating, setMonthOperating] = useState(0);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [topServices, setTopServices] = useState([]);
  const [topInventoryUsage, setTopInventoryUsage] = useState([]);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    const today = startOfDay(new Date()).toISOString();
    const monthStart = startOfMonth(new Date()).toISOString();
    const monthStartDate = startOfMonth(new Date());

    const [salesRes, inventoryRes, saleItemsRes, purchasesRes, opExpRes] = await Promise.all([
      supabase.from('sales').select('total_amount, sale_date, created_at'),
      supabase.from('inventory_items').select('*').order('name'),
      supabase
        .from('sale_items')
        .select('service_name, quantity, line_total, inventory_deducted, inventory_items(name), sales!inner(sale_date, created_at)'),
      supabase.from('inventory_purchases').select('total_cost, purchase_date'),
      supabase.from('operating_expenses').select('amount, expense_date'),
    ]);

    const sales = salesRes.data || [];
    const items = inventoryRes.data || [];
    const saleItems = (saleItemsRes.data || []).filter((row) => {
      const d = row.sales?.sale_date || row.sales?.created_at;
      return d && d >= monthStart;
    });
    const purchases = purchasesRes.data || [];
    const opExp = opExpRes.data || [];

    const todayTotal = sales
      .filter((s) => (s.sale_date || s.created_at) >= today)
      .reduce((sum, s) => sum + Number(s.total_amount), 0);

    const monthTotal = sales
      .filter((s) => (s.sale_date || s.created_at) >= monthStart)
      .reduce((sum, s) => sum + Number(s.total_amount), 0);

    const purchaseTotal = purchases
      .filter((p) => {
        const purchaseDate = parseISO(p.purchase_date);
        return purchaseDate >= monthStartDate;
      })
      .reduce((sum, p) => sum + Number(p.total_cost), 0);

    const operatingTotal = opExp
      .filter((e) => {
        const expenseDate = parseISO(e.expense_date);
        return expenseDate >= monthStartDate;
      })
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const serviceStats = {};
    saleItems.forEach((row) => {
      if (!serviceStats[row.service_name]) {
        serviceStats[row.service_name] = { qty: 0, revenue: 0 };
      }
      serviceStats[row.service_name].qty += Number(row.quantity);
      serviceStats[row.service_name].revenue += Number(row.line_total);
    });
    const topSvc = Object.entries(serviceStats)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    const usageStats = {};
    saleItems.forEach((row) => {
      const name = row.inventory_items?.name;
      const deducted = Number(row.inventory_deducted) || 0;
      if (!name || deducted <= 0) return;
      usageStats[name] = (usageStats[name] || 0) + deducted;
    });
    const topInv = Object.entries(usageStats)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = subDays(new Date(), 6 - i);
      const dayStr = format(d, 'yyyy-MM-dd');
      const total = sales
        .filter((s) => format(new Date(s.sale_date || s.created_at), 'yyyy-MM-dd') === dayStr)
        .reduce((sum, s) => sum + Number(s.total_amount), 0);
      return { day: format(d, 'EEE'), sales: total };
    });

    setTodaySales(todayTotal);
    setMonthSales(monthTotal);
    setMonthExpenses(purchaseTotal);
    setMonthOperating(operatingTotal);
    setLowStockItems(items.filter(isLowStock));
    setInventory(items);
    setChartData(last7);
    setTopServices(topSvc);
    setTopInventoryUsage(topInv);
    setLoading(false);
  }

  const profit = monthSales - monthExpenses - monthOperating;

  if (loading) {
    return (
      <div className="p-8">
        <PageHeaderSkeleton />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 animate-fade-in">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-gold-400">{t('dashboard')}</h1>
        <p className="text-luxury-muted mt-1 text-sm sm:text-base">{t('arizonaAnalytics')}</p>
      </header>

      {!bannerDismissed && (
        <LowStockBanner items={lowStockItems} onDismiss={() => setBannerDismissed(true)} />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <StatCard title={t('dailySales')} value={formatCurrency(todaySales)} icon={DollarSign} />
        <StatCard title={t('monthlySales')} value={formatCurrency(monthSales)} icon={TrendingUp} />
        <StatCard
          title={t('netProfit')}
          value={formatCurrency(profit)}
          subtitle={t('profitSubtitle')}
          icon={PiggyBank}
          alert={profit < 0}
        />
        <StatCard
          title={t('lowStock')}
          value={lowStockItems.length}
          subtitle={lowStockItems.length ? t('restockNeeded') : t('allGood')}
          icon={AlertTriangle}
          alert={lowStockItems.length > 0}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="card-luxury text-sm">
          <p className="text-luxury-muted">{t('inventoryPurchases')}</p>
          <p className="text-xl font-bold text-gold-400 mt-1">{formatCurrency(monthExpenses)}</p>
        </div>
        <div className="card-luxury text-sm">
          <p className="text-luxury-muted">{t('operatingExpenses')}</p>
          <p className="text-xl font-bold text-gold-400 mt-1">{formatCurrency(monthOperating)}</p>
        </div>
        <div className="card-luxury text-sm">
          <p className="text-luxury-muted">{t('inventoryItems')}</p>
          <p className="text-xl font-bold text-gold-400 mt-1">{inventory.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card-luxury lg:col-span-2">
          <h2 className="text-lg font-semibold text-gold-400 mb-4">{t('dailySalesChart')}</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <XAxis dataKey="day" stroke={isDark ? '#888' : '#666'} />
              <YAxis stroke={isDark ? '#888' : '#666'} />
              <Tooltip
                contentStyle={{
                  background: isDark ? '#141414' : '#ffffff',
                  border: '1px solid #c9a227',
                  color: isDark ? '#fff' : '#1a1a1a',
                }}
                labelStyle={{ color: isDark ? '#fff' : '#1a1a1a' }}
                formatter={(v) => [formatCurrency(v), t('dailySales')]}
              />
              <Bar dataKey="sales" fill="#c9a227" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card-luxury">
          <h2 className="text-lg font-semibold text-gold-400 mb-4 flex items-center gap-2">
            <Award size={20} />
            {t('topServicesMonth')}
          </h2>
          {topServices.length === 0 ? (
            <p className="text-luxury-muted text-sm">{t('noSalesMonth')}</p>
          ) : (
            <ul className="space-y-3">
              {topServices.map((p, i) => (
                <li key={p.name} className="flex justify-between items-center bg-luxury-slate rounded-lg px-3 py-2">
                  <span className="text-sm">
                    <span className="text-gold-500 mr-2">#{i + 1}</span>
                    {p.name}
                  </span>
                  <span className="text-gold-400 text-sm">{p.qty} {t('sold')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="card-luxury">
          <h2 className="text-lg font-semibold text-gold-400 mb-4 flex items-center gap-2">
            <Boxes size={20} />
            {t('topInventoryUsage')}
          </h2>
          {topInventoryUsage.length === 0 ? (
            <p className="text-luxury-muted text-sm">{t('noInventoryDeducted')}</p>
          ) : (
            <ul className="space-y-2">
              {topInventoryUsage.map((u) => (
                <li key={u.name} className="flex justify-between bg-luxury-slate rounded-lg px-3 py-2 text-sm">
                  <span>{u.name}</span>
                  <span className="text-amber-400">{u.total.toFixed(1)} {t('used')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card-luxury">
          <h2 className="text-lg font-semibold text-gold-400 mb-4">{t('quickActions')}</h2>
          <div className="space-y-3">
            <Link to="/pos" className="btn-gold flex items-center justify-center gap-2 w-full">
              <ShoppingCart size={18} /> {t('newSale')}
            </Link>
            <Link to="/customers" className="btn-outline flex items-center justify-center gap-2 w-full">
              {t('customerHistory')}
            </Link>
            <Link to="/reports" className="btn-outline flex items-center justify-center gap-2 w-full">
              <Receipt size={18} /> {t('fullReports')}
            </Link>
          </div>
        </div>
      </div>

      {lowStockItems.length > 0 && (
        <div className="card-luxury mt-6 border-red-500/40 bg-red-950/20">
          <h2 className="text-lg font-semibold text-red-400 mb-4 flex items-center gap-2">
            <AlertTriangle size={20} />
            {t('lowStockRestock')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {lowStockItems.map((item) => (
              <div key={item.id} className="rounded-lg p-4 border-2 border-red-500/50 bg-red-500/10">
                <p className="font-medium text-red-200">{item.name}</p>
                <p className="text-red-400 text-sm font-semibold">
                  {formatStock(item)} — {t('below')} {item.low_stock_threshold}
                  {item.stock_type === 'meter' ? 'm' : ` ${item.unit_label}`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card-luxury mt-6">
        <h2 className="text-lg font-semibold text-gold-400 mb-4 flex items-center gap-2">
          <Package size={20} /> {t('allInventory')}
        </h2>
        <LuxuryTable
          columns={[
            { key: 'name', header: t('item') },
            { key: 'category', header: t('category'), cellClassName: 'text-luxury-muted' },
            { key: 'type', header: t('type'), render: (r) => r.stock_type },
            {
              key: 'stock',
              header: t('stock'),
              align: 'right',
              render: (r) => (
                <span className={isLowStock(r) ? 'text-red-400 font-semibold' : 'text-gold-400'}>
                  {formatStock(r)}
                </span>
              ),
            },
          ]}
          rows={inventory}
        />
      </div>
    </div>
  );
}

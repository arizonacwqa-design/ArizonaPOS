import { useEffect, useState, useRef, useMemo } from 'react';
import {
  User,
  Car,
  Wrench,
  Package,
  ShoppingCart,
  CheckCircle,
  Printer,
  Trash2,
  Search,
  Plus,
  Minus,
  AlertTriangle,
  FileText,
  MessageCircle,
  Download,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { formatCurrency, formatStock } from '@/lib/format';
import { PAYMENT_METHODS, POS_SERVICE_GROUPS, DEFAULT_TAX_RATE } from '@/lib/constants';
import ThermalInvoice from '@/components/ThermalInvoice';
import A4Invoice from '@/components/A4Invoice';
import InvoicePreviewPanel from '@/components/pos/InvoicePreviewPanel';
import InventoryUsageSection from '@/components/pos/InventoryUsageSection';
import CustomerAutocomplete from '@/components/CustomerAutocomplete';

import { buildInvoiceWhatsAppMessage, openWhatsApp } from '@/lib/share';
import { downloadLuxuryInvoicePdf } from '@/lib/invoicePdf';
import {
  cartLineFromService,
  cartLineFromInventory,
  updateCartLineQuantity,
  aggregateInventoryUsage,
  validateCartStock,
  cartLineKey,
  saleItemsPayload,
  calcBillingTotals,
} from '@/lib/pos';
import { useTranslation } from '@/lib/translations';

const emptyCustomer = {
  customer_name: '',
  customer_phone: '',
  car_model: '',
  car_plate: '',
};

export default function POS() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const invoiceRef = useRef();

  const [services, setServices] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState(emptyCustomer);
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState('flat'); // 'flat' | 'percent'
  const [taxEnabled, setTaxEnabled] = useState(DEFAULT_TAX_RATE > 0);
  const [taxRate, setTaxRate] = useState(DEFAULT_TAX_RATE);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [serviceSearch, setServiceSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [lastItems, setLastItems] = useState([]);
  const [lastInventoryUsage, setLastInventoryUsage] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadCatalog();
  }, []);

  async function loadCatalog() {
    const [svcRes, invRes] = await Promise.all([
      supabase
        .from('services')
        .select('*, inventory_item:inventory_items(id, name, stock_type, current_stock)')
        .eq('is_active', true)
        .order('name'),
      supabase.from('inventory_items').select('*').order('name'),
    ]);
    setServices(svcRes.data || []);
    setInventory(invRes.data || []);
  }

  const cartWithKeys = useMemo(
    () => cart.map((line) => ({ ...line, _key: cartLineKey(line) })),
    [cart]
  );

  const subtotal = cart.reduce((sum, item) => sum + item.line_total, 0);
  const billing = useMemo(
    () => calcBillingTotals(subtotal, discount, taxRate, taxEnabled, discountType),
    [subtotal, discount, taxRate, taxEnabled, discountType]
  );
  const inventoryUsage = useMemo(() => aggregateInventoryUsage(cart), [cart]);
  const selectedInventoryIds = useMemo(
    () => cart.filter((c) => c.lineType === 'material').map((c) => c.inventory_item_id),
    [cart]
  );

  const filteredServices = services.filter((s) => {
    const matchCat = serviceFilter === 'all' || s.category === serviceFilter;
    const q = serviceSearch.trim().toLowerCase();
    const matchSearch = !q || s.name.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  function addService(service) {
    const key = `svc-${service.id}`;
    const existing = cart.find((c) => cartLineKey(c) === key);
    if (existing) {
      setCart(
        cart.map((c) =>
          cartLineKey(c) === key
            ? updateCartLineQuantity(c, c.quantity + 1)
            : c
        )
      );
    } else {
      setCart([...cart, cartLineFromService(service)]);
    }
    setMessage('');
  }

  function addMaterial(item) {
    const step = item.stock_type === 'meter' ? 0.5 : 1;
    const key = `mat-${item.id}`;
    const existing = cart.find((c) => cartLineKey(c) === key);
    if (existing) {
      setCart(
        cart.map((c) =>
          cartLineKey(c) === key
            ? updateCartLineQuantity(c, c.quantity + step)
            : c
        )
      );
    } else {
      setCart([...cart, cartLineFromInventory(item, step)]);
    }
    setMessage('');
  }

  function updateQty(key, qty) {
    setCart(
      cart.map((c) => (cartLineKey(c) === key ? updateCartLineQuantity(c, qty) : c))
    );
  }

  function removeLine(key) {
    setCart(cart.filter((c) => cartLineKey(c) !== key));
  }

  async function completeSale() {
    const name = customer.customer_name.trim();
    if (!name) {
      setMessage(t('customerNameRequired'));
      return;
    }
    if (name.length > 100) {
      setMessage(t('customerNameLength'));
      return;
    }
    if (cart.length === 0) {
      setMessage(t('addAtLeastOneService'));
      return;
    }

    const stockErrors = validateCartStock(cart);
    if (stockErrors.length > 0) {
      setMessage(stockErrors.join(' · '));
      return;
    }

    setLoading(true);
    setMessage('');

    const customerPayload = {
      customer_name: customer.customer_name.trim(),
      customer_phone: customer.customer_phone.trim() || null,
    };

    const salePayload = {
      ...customer,
      customer_name: customer.customer_name.trim(),
      subtotal: billing.subtotal,
      discount: billing.discount,
      tax_rate: billing.taxRate,
      tax_amount: billing.taxAmount,
      total_amount: billing.total,
      payment_method: paymentMethod,
      employee_id: user?.id,
      notes: notes.trim() || null,
    };

    const itemsPayload = saleItemsPayload(cart, null).map(({ sale_id: _ignore, ...rest }) => rest);

    const { data: rpcResult, error: rpcError } = await supabase.rpc('create_sale', {
      p_sale: salePayload,
      p_items: itemsPayload,
      p_customer: customerPayload,
    });

    setLoading(false);

    if (rpcError) {
      const msg = rpcError.message || '';
      let errorMsg = msg;
      
      if (msg.includes('Insufficient stock')) {
        // Preserve full error details for insufficient stock
        errorMsg = msg;
      } else if (msg.includes('create_sale') || rpcError.code === 'PGRST202') {
        errorMsg = 'Sale creation RPC not available. Admin must run migrations (006_pos_security_atomicity.sql).';
      } else if (msg.includes('Not authorized')) {
        errorMsg = 'You do not have permission to create sales.';
      }
      
      setMessage(errorMsg);
      return;
    }

    const sale = rpcResult?.sale;
    const items = rpcResult?.items || [];
    if (!sale) {
      setMessage(t('saleNotCreated'));
      return;
    }

    setLastSale(sale);
    setLastItems(items);
    setLastInventoryUsage(inventoryUsage);
    setMessage(`Invoice ${sale.invoice_number} saved — stock updated automatically`);
    setCart([]);
    setCustomer(emptyCustomer);
    setNotes('');
    setDiscount(0);
    setTaxEnabled(DEFAULT_TAX_RATE > 0);
    setTaxRate(DEFAULT_TAX_RATE);
    loadCatalog();
  }

  function startNewSale() {
    setLastSale(null);
    setLastItems([]);
    setLastInventoryUsage([]);
    setMessage('');
  }

  function runPrint(mode) {
    document.body.classList.remove('print-thermal', 'print-a4');
    document.body.classList.add(mode === 'a4' ? 'print-a4' : 'print-thermal');
    if (window.electronAPI?.printInvoice) {
      window.electronAPI.printInvoice().then((result) => {
        if (result && !result.success) setMessage(result.error || 'Print failed');
      });
    } else {
      window.print();
    }
    setTimeout(() => {
      document.body.classList.remove('print-thermal', 'print-a4');
    }, 500);
  }

  return (
    <div className="min-h-full p-4 sm:p-6 lg:p-8 animate-fade-in">
      {/* Header */}
      <header className="mb-6 lg:mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gold-500 mb-1">{t('posBilling')}</p>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold text-gold-400">{t('posBilling')}</h1>
          <p className="text-luxury-muted mt-1 max-w-xl text-sm sm:text-base">
            {t('createInvoicesDescription')}
          </p>
        </div>
        {lastSale && (
          <button type="button" onClick={startNewSale} className="btn-outline text-sm">
            {t('newSale')}
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Customer + Services */}
        <div className="lg:col-span-7 space-y-6">
          {/* Step 1 — Customer */}
          <section className="rounded-2xl border border-luxury-border bg-luxury-charcoal/80 overflow-hidden">
            <div className="flex items-center gap-3 border-b border-gold-600/15 bg-luxury-slate/40 px-5 py-3">
              <StepBadge n={1} />
              <User className="text-gold-400" size={20} />
              <h2 className="font-semibold text-gold-300">{t('customerVehicle')}</h2>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t('customerName')} required>
                <CustomerAutocomplete
                  key={lastSale?.id || 'new'}
                  value={customer}
                  onChange={setCustomer}
                  onSelect={setCustomer}
                />
              </Field>
              <Field label={t('phoneNumber')}>
                <input
                  className="input-luxury"
                  value={customer.customer_phone}
                  onChange={(e) =>
                    setCustomer({ ...customer, customer_phone: e.target.value })
                  }
                  placeholder="+974 …"
                />
              </Field>
              <Field label={t('carModel')} icon={Car}>
                <input
                  className="input-luxury"
                  value={customer.car_model}
                  onChange={(e) => setCustomer({ ...customer, car_model: e.target.value })}
                  placeholder="e.g. Range Rover Sport"
                />
              </Field>
              <Field label={t('carPlate')}>
                <input
                  className="input-luxury"
                  value={customer.car_plate}
                  onChange={(e) => setCustomer({ ...customer, car_plate: e.target.value })}
                  placeholder={t('carPlate')}
                />
              </Field>
              <div className="sm:col-span-2">
                <label className="label-luxury flex items-center gap-2">
                  <FileText size={14} /> {t('notesOptional')}
                </label>
                <input
                  className="input-luxury"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('notesOptional')}
                />
              </div>
            </div>
          </section>

          {/* Step 2 — Services */}
          <section className="rounded-2xl border border-luxury-border bg-luxury-charcoal/80 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gold-600/15 bg-luxury-slate/40 px-5 py-3">
              <div className="flex items-center gap-3">
                <StepBadge n={2} />
                <Wrench className="text-gold-400" size={20} />
                <h2 className="font-semibold text-gold-300">Services</h2>
              </div>
              <div className="relative flex-1 min-w-[160px] max-w-xs">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-luxury-muted"
                  size={16}
                />
                <input
                  className="input-luxury pl-9 py-2 text-sm"
                  placeholder={t('searchServices')}
                  value={serviceSearch}
                  onChange={(e) => setServiceSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="px-5 py-3 flex flex-wrap gap-2 border-b border-luxury-border/50">
              <FilterPill
                active={serviceFilter === 'all'}
                onClick={() => setServiceFilter('all')}
                label={t('all')}
              />
              {POS_SERVICE_GROUPS.filter((g) => g.id !== 'all').map((g) => (
                <FilterPill
                  key={g.id}
                  active={serviceFilter === g.id}
                  onClick={() => setServiceFilter(g.id)}
                  label={g.label}
                />
              ))}
            </div>

            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[280px] overflow-y-auto">
              {filteredServices.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => addService(s)}
                  className="group text-left rounded-xl border border-luxury-border bg-luxury-slate p-4 hover:border-gold-500/60 hover:shadow-gold transition-all"
                >
                  <p className="text-[10px] uppercase tracking-wider text-gold-600/80 mb-1">
                    {s.category}
                  </p>
                  <p className="font-medium text-sm text-white group-hover:text-gold-200">
                    {s.name}
                  </p>
                  <p className="text-gold-400 font-semibold mt-2">{formatCurrency(s.price)}</p>
                  {s.inventory_item && s.consumption_per_unit > 0 && (
                    <p className="text-[10px] text-amber-400/80 mt-1">
                      Uses {s.consumption_per_unit}
                      {s.inventory_item.stock_type === 'meter' ? 'm' : ' pcs'} ·{' '}
                      {s.inventory_item.name}
                    </p>
                  )}
                </button>
              ))}
              {filteredServices.length === 0 && (
                <p className="col-span-full text-center text-luxury-muted py-8 text-sm">
                  {t('noServicesFound')}
                </p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-luxury-border bg-luxury-charcoal/80 overflow-hidden animate-slide-up">
            <div className="flex items-center gap-3 border-b border-gold-600/15 bg-luxury-slate/40 px-5 py-3">
              <StepBadge n={3} />
              <Package className="text-gold-400" size={20} />
              <div>
                <h2 className="font-semibold text-gold-300">Inventory Usage</h2>
                <p className="text-xs text-luxury-muted">
                  {t('inventoryUsageDetail')}
                </p>
              </div>
            </div>
            <InventoryUsageSection
              inventory={inventory}
              onAdd={addMaterial}
              selectedIds={selectedInventoryIds}
            />
          </section>
        </div>

        {/* Right: Cart + Invoice */}
        <div className="lg:col-span-5 space-y-6">
          <section className="rounded-2xl border border-gold-600/20 bg-luxury-charcoal lg:sticky lg:top-6">
            <div className="flex items-center gap-3 border-b border-gold-600/15 px-5 py-3">
              <StepBadge n={4} />
              <ShoppingCart className="text-gold-400" size={20} />
              <h2 className="font-semibold text-gold-300">{t('cartCheckout')}</h2>
            </div>

            <div className="p-5">
              {cartWithKeys.length === 0 ? (
                <p className="text-center text-luxury-muted py-10 text-sm">
                  {t('tapToAddToCart')}
                </p>
              ) : (
                <ul className="space-y-2 mb-4 max-h-52 overflow-y-auto">
                  {cartWithKeys.map((item) => (
                    <li
                      key={item._key}
                      className="flex items-center gap-2 rounded-xl bg-luxury-slate border border-luxury-border p-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.service_name}</p>
                        {item.lineType === 'material' && (
                          <span className="text-[10px] text-amber-400">{t('materialOnly')}</span>
                        )}
                        {item.inventory_deducted > 0 && (
                          <p className="text-[10px] text-amber-400/90">
                            −{item.inventory_deducted}
                            {item.stock_type === 'meter' ? 'm' : ' pcs'} stock
                          </p>
                        )}
                        {item.line_total > 0 && (
                          <p className="text-gold-400 text-sm">{formatCurrency(item.line_total)}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label="Decrease quantity"
                          onClick={() =>
                            updateQty(
                              item._key,
                              item.quantity - (item.stock_type === 'meter' ? 0.5 : 1)
                            )
                          }
                          className="p-1 rounded bg-luxury-black text-gold-400 hover:bg-gold-600/20"
                        >
                          <Minus size={14} />
                        </button>
                        <input
                          type="number"
                          min={item.stock_type === 'meter' ? 0.1 : 1}
                          step={item.stock_type === 'meter' ? 0.1 : 1}
                          className="w-14 input-luxury py-1 text-center text-sm"
                          value={item.quantity}
                          onChange={(e) => updateQty(item._key, Number(e.target.value))}
                        />
                        <button
                          type="button"
                          aria-label="Increase quantity"
                          onClick={() =>
                            updateQty(
                              item._key,
                              item.quantity + (item.stock_type === 'meter' ? 0.5 : 1)
                            )
                          }
                          className="p-1 rounded bg-luxury-black text-gold-400 hover:bg-gold-600/20"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <button
                        type="button"
                        aria-label={`Remove ${item.service_name} from cart`}
                        onClick={() => removeLine(item._key)}
                        className="text-red-400 hover:text-red-300 p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {inventoryUsage.length > 0 && (
                <div className="mb-4 rounded-lg border border-amber-600/25 bg-amber-950/30 p-3">
                  <p className="text-xs font-semibold text-amber-400 flex items-center gap-1 mb-2">
                    <AlertTriangle size={14} />
                    {t('autoStockDeduction')}
                  </p>
                  <ul className="text-xs space-y-1 text-luxury-muted">
                    {inventoryUsage.map((u) => (
                      <li key={u.id} className="flex justify-between">
                        <span>{u.name}</span>
                        <span className="text-amber-300">
                          −{u.total}
                          {u.stock_type === 'meter' ? 'm' : ' pcs'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="space-y-3 border-t border-luxury-border pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-luxury-muted">Subtotal</span>
                  <span>{formatCurrency(billing.subtotal)}</span>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="label-luxury mb-0">
                      {t('discount')} {discountType === 'percent' ? '(%)' : '(QAR)'}
                    </label>
                    <div className="inline-flex rounded-md overflow-hidden border border-luxury-border text-[11px]">
                      <button
                        type="button"
                        onClick={() => setDiscountType('flat')}
                        className={`px-2 py-0.5 ${
                          discountType === 'flat'
                            ? 'bg-gold-600/25 text-gold-300'
                            : 'text-luxury-muted hover:text-gold-300'
                        }`}
                      >
                        QAR
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiscountType('percent')}
                        className={`px-2 py-0.5 ${
                          discountType === 'percent'
                            ? 'bg-gold-600/25 text-gold-300'
                            : 'text-luxury-muted hover:text-gold-300'
                        }`}
                      >
                        %
                      </button>
                    </div>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max={discountType === 'percent' ? '100' : undefined}
                    step="0.01"
                    className="input-luxury"
                    value={discount}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '') return setDiscount(0);
                      const n = Number(v);
                      const max = discountType === 'percent' ? 100 : Infinity;
                      setDiscount(Number.isFinite(n) && n >= 0 ? Math.min(n, max) : 0);
                    }}
                  />
                  {discountType === 'percent' && billing.rawDiscount > 0 && (
                    <p className="text-[11px] text-gold-300/80 mt-1">
                      = {formatCurrency(billing.rawDiscount)} off
                    </p>
                  )}
                  {billing.discountCapped && (
                    <p className="text-[11px] text-amber-400 mt-1">
                      Discount capped at subtotal ({formatCurrency(billing.subtotal)}).
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-gold-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={taxEnabled}
                      onChange={(e) => setTaxEnabled(e.target.checked)}
                      className="rounded border-gold-600"
                    />
                    {t('tax')}
                  </label>
                  {taxEnabled && (
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      className="input-luxury flex-1 min-w-[80px] py-2"
                      value={taxRate}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '') return setTaxRate('');
                        const n = Number(v);
                        setTaxRate(Number.isFinite(n) && n >= 0 ? Math.min(n, 100) : 0);
                      }}
                      placeholder="%"
                    />
                  )}
                  {taxEnabled && billing.taxAmount > 0 && (
                    <span className="text-sm text-luxury-muted ml-auto">
                      {formatCurrency(billing.taxAmount)}
                    </span>
                  )}
                </div>
                <div>
                  <label className="label-luxury">{t('paymentMethod')}</label>
                  <select
                    className="input-luxury"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-between text-xl font-bold text-gold-400 pt-1">
                  <span>{t('grandTotal')}</span>
                  <span>{formatCurrency(billing.total)}</span>
                </div>
              </div>

              {message && (
                <p
                  className={`text-sm mt-3 p-3 rounded-lg ${
                    message.includes('saved') || message.includes('success')
                      ? 'text-green-400 bg-green-500/10 border border-green-500/20'
                      : 'text-red-400 bg-red-500/10 border border-red-500/20'
                  }`}
                >
                  {message}
                </p>
              )}

              <button
                type="button"
                onClick={completeSale}
                disabled={loading || cart.length === 0 || !customer.customer_name.trim()}
                className="btn-gold w-full mt-4 flex items-center justify-center gap-2 py-3"
              >
                <CheckCircle size={20} />
                {loading ? t('savingInvoice') : t('completeSaleDeduct')}
              </button>

              {lastSale && (
                <div className="space-y-2 mt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button type="button" onClick={() => runPrint('thermal')} className="btn-outline flex items-center justify-center gap-2">
                      <Printer size={18} /> {t('thermal')}
                    </button>
                    <button type="button" onClick={() => runPrint('a4')} className="btn-outline flex items-center justify-center gap-2">
                      <Printer size={18} /> {t('a4Invoice')}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button type="button" onClick={() => downloadLuxuryInvoicePdf(lastSale, lastItems, { format: 'a4' })} className="btn-outline flex items-center justify-center gap-2 text-sm">
                      <Download size={16} /> {t('pdfA4')}
                    </button>
                    <button type="button" onClick={() => downloadLuxuryInvoicePdf(lastSale, lastItems, { format: 'thermal' })} className="btn-outline flex items-center justify-center gap-2 text-sm">
                      <Download size={16} /> {t('pdfThermal')}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button type="button" disabled={!lastSale.customer_phone} onClick={() => openWhatsApp(lastSale.customer_phone, buildInvoiceWhatsAppMessage(lastSale, lastItems))} className="btn-gold flex items-center justify-center gap-2 text-sm py-2">
                      <MessageCircle size={16} /> {t('whatsAppCustomer')}
                    </button>
                    <button type="button" onClick={() => openWhatsApp(null, buildInvoiceWhatsAppMessage(lastSale, lastItems))} className="btn-outline flex items-center justify-center gap-2 text-sm">
                      <MessageCircle size={16} /> {t('shareToShop')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          <InvoicePreviewPanel
            customer={customer}
            cart={cartWithKeys}
            subtotal={billing.subtotal}
            discount={billing.discount}
            taxAmount={billing.taxAmount}
            taxRate={billing.taxRate}
            total={billing.total}
            paymentMethod={paymentMethod}
            invoiceNumber={lastSale?.invoice_number}
            inventoryUsage={inventoryUsage}
          />
        </div>
      </div>

      {lastSale && (
        <>
          <ThermalInvoice
            ref={invoiceRef}
            sale={lastSale}
            items={lastItems}
            inventoryUsage={lastInventoryUsage}
          />
          <A4Invoice sale={lastSale} items={lastItems} inventoryUsage={lastInventoryUsage} />
        </>
      )}
    </div>
  );
}

function StepBadge({ n }) {
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold-600/25 border border-gold-500/40 text-xs font-bold text-gold-400">
      {n}
    </span>
  );
}

function Field({ label, required, icon: Icon, children }) {
  return (
    <div>
      <label className="label-luxury flex items-center gap-1">
        {Icon && <Icon size={14} className="text-gold-500" />}
        {label}
        {required && <span className="text-gold-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function FilterPill({ active, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
        active
          ? 'bg-gold-600/25 text-gold-300 border border-gold-500/40'
          : 'bg-luxury-slate text-luxury-muted border border-transparent hover:border-luxury-border'
      }`}
    >
      {label}
    </button>
  );
}

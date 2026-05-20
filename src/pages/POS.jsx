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
import { upsertCustomerFromSale } from '@/lib/customers';
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

const emptyCustomer = {
  customer_name: '',
  customer_phone: '',
  car_model: '',
  car_plate: '',
};

export default function POS() {
  const { user } = useAuthStore();
  const invoiceRef = useRef();

  const [services, setServices] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState(emptyCustomer);
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState(0);
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
    () => calcBillingTotals(subtotal, discount, taxRate, taxEnabled),
    [subtotal, discount, taxRate, taxEnabled]
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
    if (!customer.customer_name.trim()) {
      setMessage('Customer name is required');
      return;
    }
    if (cart.length === 0) {
      setMessage('Add at least one service or material');
      return;
    }

    const stockErrors = validateCartStock(cart);
    if (stockErrors.length > 0) {
      setMessage(stockErrors.join(' · '));
      return;
    }

    setLoading(true);
    setMessage('');

    const customerId = await upsertCustomerFromSale({
      customer_name: customer.customer_name,
      customer_phone: customer.customer_phone,
      total_amount: billing.total,
    });

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
      customer_id: customerId || null,
    };

    const itemsPayload = saleItemsPayload(cart, null).map(({ sale_id: _ignore, ...rest }) => rest);

    const { data: rpcResult, error: rpcError } = await supabase.rpc('create_sale', {
      p_sale: salePayload,
      p_items: itemsPayload,
    });

    setLoading(false);

    if (rpcError) {
      const msg = rpcError.message || '';
      if (msg.includes('Insufficient stock')) {
        setMessage(msg.replace(/^.*Insufficient stock/, 'Insufficient stock'));
      } else if (msg.includes('create_sale') || rpcError.code === 'PGRST202') {
        setMessage('Database not migrated yet. Admin must run supabase/migrations/006_pos_security_atomicity.sql.');
      } else {
        setMessage(msg);
      }
      return;
    }

    const sale = rpcResult?.sale;
    const items = rpcResult?.items || [];
    if (!sale) {
      setMessage('Sale was not created. Please try again.');
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
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gold-500 mb-1">Point of Sale</p>
          <h1 className="text-3xl lg:text-4xl font-display text-gold-400">POS Billing</h1>
          <p className="text-luxury-muted mt-1 max-w-xl">
            Create invoices, link services to inventory, and auto-deduct meter & quantity stock on save
          </p>
        </div>
        {lastSale && (
          <button type="button" onClick={startNewSale} className="btn-outline text-sm">
            New Sale
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left: Customer + Services */}
        <div className="xl:col-span-7 space-y-6">
          {/* Step 1 — Customer */}
          <section className="rounded-2xl border border-luxury-border bg-luxury-charcoal/80 overflow-hidden">
            <div className="flex items-center gap-3 border-b border-gold-600/15 bg-luxury-slate/40 px-5 py-3">
              <StepBadge n={1} />
              <User className="text-gold-400" size={20} />
              <h2 className="font-semibold text-gold-300">Customer & Vehicle</h2>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Customer Name" required>
                <CustomerAutocomplete
                  value={customer}
                  onChange={setCustomer}
                  onSelect={setCustomer}
                />
              </Field>
              <Field label="Phone Number">
                <input
                  className="input-luxury"
                  value={customer.customer_phone}
                  onChange={(e) =>
                    setCustomer({ ...customer, customer_phone: e.target.value })
                  }
                  placeholder="+974 …"
                />
              </Field>
              <Field label="Car Model" icon={Car}>
                <input
                  className="input-luxury"
                  value={customer.car_model}
                  onChange={(e) => setCustomer({ ...customer, car_model: e.target.value })}
                  placeholder="e.g. Range Rover Sport"
                />
              </Field>
              <Field label="Plate Number">
                <input
                  className="input-luxury"
                  value={customer.car_plate}
                  onChange={(e) => setCustomer({ ...customer, car_plate: e.target.value })}
                  placeholder="Plate / VIN"
                />
              </Field>
              <div className="sm:col-span-2">
                <label className="label-luxury flex items-center gap-2">
                  <FileText size={14} /> Notes (optional)
                </label>
                <input
                  className="input-luxury"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Special requests, warranty, etc."
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
                  placeholder="Search services…"
                  value={serviceSearch}
                  onChange={(e) => setServiceSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="px-5 py-3 flex flex-wrap gap-2 border-b border-luxury-border/50">
              <FilterPill
                active={serviceFilter === 'all'}
                onClick={() => setServiceFilter('all')}
                label="All"
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

            <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[280px] overflow-y-auto">
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
                  No services found. Add services in Admin → Services.
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
                  Meters for PPF/tint · quantity for shampoo, polish, chemicals
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
        <div className="xl:col-span-5 space-y-6">
          <section className="rounded-2xl border border-gold-600/20 bg-luxury-charcoal sticky top-6">
            <div className="flex items-center gap-3 border-b border-gold-600/15 px-5 py-3">
              <StepBadge n={4} />
              <ShoppingCart className="text-gold-400" size={20} />
              <h2 className="font-semibold text-gold-300">Cart & Checkout</h2>
            </div>

            <div className="p-5">
              {cartWithKeys.length === 0 ? (
                <p className="text-center text-luxury-muted py-10 text-sm">
                  Tap services to add to cart
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
                          <span className="text-[10px] text-amber-400">Material only</span>
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
                    Auto stock deduction on save
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
                  <label className="label-luxury">Discount (QAR)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="input-luxury"
                    value={discount}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '') return setDiscount('');
                      const n = Number(v);
                      setDiscount(Number.isFinite(n) && n >= 0 ? n : 0);
                    }}
                  />
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
                    Tax
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
                  <label className="label-luxury">Payment Method</label>
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
                  <span>Grand Total</span>
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
                disabled={loading}
                className="btn-gold w-full mt-4 flex items-center justify-center gap-2 py-3"
              >
                <CheckCircle size={20} />
                {loading ? 'Saving invoice…' : 'Complete Sale & Deduct Stock'}
              </button>

              {lastSale && (
                <div className="space-y-2 mt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button type="button" onClick={() => runPrint('thermal')} className="btn-outline flex items-center justify-center gap-2">
                      <Printer size={18} /> Thermal (80mm)
                    </button>
                    <button type="button" onClick={() => runPrint('a4')} className="btn-outline flex items-center justify-center gap-2">
                      <Printer size={18} /> A4 Invoice
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button type="button" onClick={() => downloadLuxuryInvoicePdf(lastSale, lastItems, { format: 'a4' })} className="btn-outline flex items-center justify-center gap-2 text-sm">
                      <Download size={16} /> PDF (A4)
                    </button>
                    <button type="button" onClick={() => downloadLuxuryInvoicePdf(lastSale, lastItems, { format: 'thermal' })} className="btn-outline flex items-center justify-center gap-2 text-sm">
                      <Download size={16} /> PDF (Thermal)
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button type="button" disabled={!lastSale.customer_phone} onClick={() => openWhatsApp(lastSale.customer_phone, buildInvoiceWhatsAppMessage(lastSale, lastItems))} className="btn-gold flex items-center justify-center gap-2 text-sm py-2">
                      <MessageCircle size={16} /> WhatsApp Customer
                    </button>
                    <button type="button" onClick={() => openWhatsApp(null, buildInvoiceWhatsAppMessage(lastSale, lastItems))} className="btn-outline flex items-center justify-center gap-2 text-sm">
                      <MessageCircle size={16} /> Share to Shop
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

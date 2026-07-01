import { useEffect, useLayoutEffect, useState, useRef } from 'react';
import { Plus, X, Printer, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { formatCurrency, formatDate, formatStock } from '@/lib/format';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { getProductByBarcode } from '@/lib/productService';
import LoadingSpinner from '../LoadingSpinner';
import PurchasePrint from '@/components/PurchasePrint';

function emptyRow() {
  return {
    key: crypto.randomUUID(),
    inventory_item_id: '',
    searchText: '',
    showDropdown: false,
    quantity: 1,
    unit_cost: 0,
  };
}

export default function Purchases() {
  const { user } = useAuthStore();
  const [items, setItems] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [monthExpense, setMonthExpense] = useState(0);
  const [form, setForm] = useState({
    bill_number: '',
    supplier_name: '',
    purchase_date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [rows, setRows] = useState([emptyRow()]);
  const [message, setMessage] = useState('');
  const [dataLoading, setDataLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [expandedBills, setExpandedBills] = useState({});
  const [printBill, setPrintBill] = useState(null);
  const printTriggered = useRef(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setDataLoading(true);
    const [itemsRes, purchasesRes] = await Promise.all([
      supabase.from('inventory_items').select('*').order('name'),
      supabase
        .from('inventory_purchases')
        .select('*, purchase_items(*)')
        .order('created_at', { ascending: false })
        .limit(100),
    ]);
    setItems(itemsRes.data || []);
    const list = purchasesRes.data || [];
    setPurchases(list);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const expense = list
      .filter((p) => new Date(p.purchase_date) >= monthStart)
      .reduce((sum, p) => sum + Number(p.total_cost || 0), 0);
    setMonthExpense(expense);
    setDataLoading(false);
  }

  useBarcodeScanner(async (barcode) => {
    const product = await getProductByBarcode(barcode);
    if (!product) {
      setMessage(`Product not found for barcode: ${barcode}. Please add it first.`);
      return;
    }
    const { data: lastPurchase } = await supabase
      .from('inventory_purchases')
      .select('unit_cost')
      .eq('inventory_item_id', product.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setRows((prev) => {
      const next = [...prev];
      const existing = next.find((r) => r.inventory_item_id === product.id);
      if (existing) {
        existing.quantity = Number(existing.quantity) + 1;
      } else {
        next.push({
          key: crypto.randomUUID(),
          inventory_item_id: product.id,
          searchText: product.name,
          showDropdown: false,
          quantity: 1,
          unit_cost: lastPurchase?.unit_cost || 0,
        });
      }
      return next;
    });
    setMessage(`Scanned: ${product.name}`);
  });

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(key) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function updateRow(key, patch) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  const grandTotal = rows.reduce((sum, r) => {
    const qty = Number(r.quantity) || 0;
    const cost = Number(r.unit_cost) || 0;
    return sum + qty * cost;
  }, 0);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.supplier_name.trim()) {
      setMessage('Enter supplier name');
      return;
    }
    const validRows = rows.filter((r) => r.inventory_item_id && (Number(r.quantity) || 0) > 0);
    if (validRows.length === 0) {
      setMessage('Add at least one item with quantity');
      return;
    }
    setLoading(true);
    const { data: purchase, error: headerErr } = await supabase
      .from('inventory_purchases')
      .insert({
        bill_number: form.bill_number.trim() || null,
        supplier_name: form.supplier_name.trim(),
        purchase_date: form.purchase_date,
        notes: form.notes || null,
        created_by: user?.id,
      })
      .select()
      .single();
    if (headerErr) {
      setLoading(false);
      if (headerErr.message?.includes('unique') || headerErr.code === '23505') {
        setMessage('Bill number already exists. Use a unique bill number or leave it blank.');
      } else {
        setMessage(headerErr.message);
      }
      return;
    }
    const itemsToInsert = validRows.map((r) => {
      const item = items.find((i) => i.id === r.inventory_item_id);
      const qty = Number(r.quantity) || 0;
      const cost = Number(r.unit_cost) || 0;
      return {
        purchase_id: purchase.id,
        inventory_item_id: r.inventory_item_id,
        item_name: item?.name || '',
        quantity: qty,
        unit_cost: cost,
        total_cost: qty * cost,
      };
    });
    const { error: itemsErr } = await supabase.from('purchase_items').insert(itemsToInsert);
    setLoading(false);
    if (itemsErr) {
      setMessage(itemsErr.message);
      return;
    }
    setMessage('Purchase recorded — stock increased automatically!');
    setForm({
      bill_number: '',
      supplier_name: '',
      purchase_date: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setRows([emptyRow()]);
    loadData();
  }

  function toggleBill(id) {
    setExpandedBills((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function handlePrint(bill) {
    setPrintBill(bill);
    printTriggered.current = true;
    document.body.classList.add('printing-purchase-bill');
  }

  useLayoutEffect(() => {
    if (printTriggered.current) {
      printTriggered.current = false;
      window.print();
    }
  });

  useEffect(() => {
    if (!printBill) return;
    const afterPrint = () => {
      document.body.classList.remove('printing-purchase-bill');
      setPrintBill(null);
    };
    window.addEventListener('afterprint', afterPrint);
    return () => window.removeEventListener('afterprint', afterPrint);
  }, [printBill]);

  if (dataLoading) return <LoadingSpinner message="Loading purchases..." />;

  return (
    <div className="p-4 sm:p-6 lg:p-8 animate-fade-in">
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-gold-400">Inventory Purchases</h1>
        <p className="text-luxury-muted">
          Multi-item stock IN with bill number, supplier, date
        </p>
      </header>

      <div className="card-luxury mb-6 border-gold-600/20">
        <p className="text-luxury-muted text-sm">This month&apos;s purchase expenses</p>
        <p className="text-3xl font-bold text-gold-400">{formatCurrency(monthExpense)}</p>
      </div>

      <form onSubmit={handleSubmit} className="card-luxury mb-8">
        <h2 className="text-lg text-gold-400 mb-4">New Purchase Entry</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="label-luxury">Bill Number</label>
            <input
              className="input-luxury"
              value={form.bill_number}
              onChange={(e) => setForm({ ...form, bill_number: e.target.value })}
              placeholder="INV-2024-001"
            />
          </div>
          <div>
            <label className="label-luxury">Supplier Name *</label>
            <input
              className="input-luxury"
              value={form.supplier_name}
              onChange={(e) => setForm({ ...form, supplier_name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label-luxury">Purchase Date</label>
            <input
              type="date"
              className="input-luxury"
              value={form.purchase_date}
              onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-luxury-muted border-b border-luxury-border">
                <th className="text-left py-2 px-2 w-1/2">Item</th>
                <th className="text-center py-2 px-2 w-[100px]">Quantity</th>
                <th className="text-center py-2 px-2 w-[120px]">Unit Cost</th>
                <th className="text-right py-2 px-2 w-[120px]">Total</th>
                <th className="py-2 px-2 w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const qty = Number(row.quantity) || 0;
                const cost = Number(row.unit_cost) || 0;
                const rowTotal = qty * cost;
                const selectedItem = items.find((i) => i.id === row.inventory_item_id);
                const filteredItems = row.searchText.trim()
                  ? items.filter((i) =>
                      i.name.toLowerCase().includes(row.searchText.trim().toLowerCase()) ||
                      (i.barcode && i.barcode.includes(row.searchText.trim()))
                    )
                  : [];
                return (
                  <tr key={row.key} className="border-b border-luxury-border/30">
                    <td className="py-1.5 px-2">
                      <div className="relative">
                        <input
                          className="input-luxury text-sm py-2"
                          value={row.searchText}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateRow(row.key, {
                              searchText: val,
                              showDropdown: true,
                              inventory_item_id: '',
                            });
                            const match = items.find((i) => i.barcode && i.barcode === val.trim());
                            if (match) {
                              updateRow(row.key, {
                                inventory_item_id: match.id,
                                searchText: match.name,
                                showDropdown: false,
                              });
                              supabase
                                .from('inventory_purchases')
                                .select('unit_cost')
                                .eq('inventory_item_id', match.id)
                                .order('created_at', { ascending: false })
                                .limit(1)
                                .maybeSingle()
                                .then(({ data }) => {
                                  if (data?.unit_cost) {
                                    updateRow(row.key, { unit_cost: data.unit_cost });
                                  }
                                });
                            }
                          }}
                          onFocus={() => updateRow(row.key, { showDropdown: true })}
                          onBlur={() => setTimeout(() => updateRow(row.key, { showDropdown: false }), 200)}
                          placeholder="Search item or scan barcode..."
                        />
                        {row.showDropdown && filteredItems.length > 0 && (
                          <div className="absolute z-50 mt-1 w-full rounded-xl border border-luxury-border bg-luxury-charcoal shadow-lg max-h-[55vh] overflow-y-auto">
                            {filteredItems.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onMouseDown={() => {
                                  updateRow(row.key, {
                                    inventory_item_id: item.id,
                                    searchText: item.name,
                                    showDropdown: false,
                                  });
                                  supabase
                                    .from('inventory_purchases')
                                    .select('unit_cost')
                                    .eq('inventory_item_id', item.id)
                                    .order('created_at', { ascending: false })
                                    .limit(1)
                                    .maybeSingle()
                                    .then(({ data }) => {
                                      if (data?.unit_cost) {
                                        updateRow(row.key, { unit_cost: data.unit_cost });
                                      }
                                    });
                                }}
                                className="w-full text-left py-3 px-4 text-sm text-white hover:bg-gold-600/15 hover:text-gold-300 border-b border-luxury-border/50 last:border-b-0"
                              >
                                <span className="font-medium">{item.name}</span>
                                {item.barcode && <span className="text-luxury-muted ml-2 text-xs">#{item.barcode}</span>}
                                <span className="text-luxury-muted ml-auto text-xs">{formatStock(item)}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {selectedItem && (
                          <p className="mt-0.5 text-[11px] text-amber-300">
                            Stock: {formatStock(selectedItem)}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-1.5 px-2">
                      <input
                        type="number"
                        min="0"
                        step={selectedItem?.stock_type === 'meter' ? '0.1' : '1'}
                        className="input-luxury text-sm py-2 text-center"
                        value={row.quantity}
                        onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                      />
                    </td>
                    <td className="py-1.5 px-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="input-luxury text-sm py-2 text-center"
                        value={row.unit_cost}
                        onChange={(e) => updateRow(row.key, { unit_cost: e.target.value })}
                      />
                    </td>
                    <td className="py-1.5 px-2 text-right font-medium text-gold-400">
                      {formatCurrency(rowTotal)}
                    </td>
                    <td className="py-1.5 px-2">
                      <button
                        type="button"
                        onClick={() => removeRow(row.key)}
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

        <button type="button" onClick={addRow} className="btn-outline text-sm mt-3 flex items-center gap-1.5">
          <Plus size={16} /> Add Item
        </button>

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-luxury-border">
          <div className="text-sm text-luxury-muted">{rows.filter((r) => r.inventory_item_id).length} items</div>
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
          <p className={`mt-3 text-sm ${message.includes('recorded') ? 'text-green-400' : 'text-red-400'}`}>
            {message}
          </p>
        )}

        <button type="submit" className="btn-gold mt-4" disabled={loading}>
          {loading ? 'Saving...' : 'Save Purchase & Update Stock'}
        </button>
      </form>

      <div className="card-luxury">
        <h2 className="text-lg text-gold-400 mb-4">Purchase History</h2>
        <div className="space-y-2">
          {purchases.map((p) => {
            const billItems = p.purchase_items || [];
            const billTotal = billItems.reduce((s, i) => s + Number(i.total_cost || 0), 0) || Number(p.total_cost || 0);
            const isExpanded = expandedBills[p.id];
            return (
              <div key={p.id} className="border border-luxury-border rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleBill(p.id)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-luxury-slate/50 hover:bg-luxury-slate transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isExpanded ? <ChevronDown size={16} className="shrink-0 text-gold-400" /> : <ChevronRight size={16} className="shrink-0 text-luxury-muted" />}
                    <span className="text-sm font-medium truncate">{p.supplier_name}</span>
                    <span className="text-xs text-luxury-muted shrink-0">{formatDate(p.purchase_date)}</span>
                    {p.bill_number && <span className="text-xs text-luxury-muted shrink-0">#{p.bill_number}</span>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-semibold text-gold-400">{formatCurrency(billTotal)}</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handlePrint(p); }}
                      className="p-1.5 text-luxury-muted hover:text-gold-400 hover:bg-gold-600/10 rounded-lg transition-colors"
                      title="Print A4"
                    >
                      <Printer size={16} />
                    </button>
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-4 pb-3 pt-1">
                    {billItems.length > 0 ? (
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
                              <td className="py-1.5 px-2">{i.item_name}</td>
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
                    ) : (
                      <p className="text-xs text-luxury-muted py-2">
                        {p.inventory_items?.name} &mdash; {p.meters_added > 0 ? `${p.meters_added}m` : `${p.quantity_added} pcs`} @ {formatCurrency(p.unit_cost)}
                      </p>
                    )}
                    {p.notes && <p className="text-xs text-luxury-muted mt-2 italic">{p.notes}</p>}
                  </div>
                )}
              </div>
            );
          })}
          {purchases.length === 0 && (
            <p className="text-center text-luxury-muted py-8">No purchases yet</p>
          )}
        </div>
      </div>

      <PurchasePrint purchase={printBill} items={printBill?.purchase_items || []} />
    </div>
  );
}

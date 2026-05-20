import { useState } from 'react';
import {
  Package,
  Truck,
  Layers,
  FileText,
  Ruler,
  Boxes,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { METER_CATEGORIES, QUANTITY_CATEGORIES } from '@/lib/constants';

const emptyAddForm = {
  name: '',
  category: 'Chemicals',
  stock_type: 'quantity',
  supplier_name: '',
  bill_number: '',
  purchase_date: new Date().toISOString().split('T')[0],
  stock_amount: '',
  low_stock_threshold: 5,
  notes: '',
};

export default function InventoryAddForm({ mode = 'add', item, onSuccess, onCancel }) {
  const user = useAuthStore((s) => s.user);
  const isEdit = mode === 'edit';

  const [form, setForm] = useState(() => {
    if (isEdit && item) {
      return {
        name: item.name ?? '',
        category: item.category ?? 'Chemicals',
        stock_type: item.stock_type ?? 'quantity',
        current_stock: item.current_stock ?? 0,
        low_stock_threshold: item.low_stock_threshold ?? 5,
        unit_label: item.unit_label ?? 'pcs',
      };
    }
    return { ...emptyAddForm };
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const categories =
    form.stock_type === 'meter' ? METER_CATEGORIES : QUANTITY_CATEGORIES;

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleTypeChange(stock_type) {
    setForm((prev) => ({
      ...prev,
      stock_type,
      category: stock_type === 'meter' ? 'PPF' : 'Chemicals',
      ...(isEdit ? { unit_label: stock_type === 'meter' ? 'm' : 'pcs' } : {}),
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage('');
    setSaving(true);

    try {
      if (isEdit) {
        await saveEdit();
      } else {
        await saveNew();
      }
    } catch (err) {
      setMessage(err.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    const payload = {
      name: form.name.trim(),
      category: form.category,
      stock_type: form.stock_type,
      current_stock: Number(form.current_stock) || 0,
      low_stock_threshold: Number(form.low_stock_threshold) || 0,
      unit_label: form.stock_type === 'meter' ? 'm' : form.unit_label || 'pcs',
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('inventory_items')
      .update(payload)
      .eq('id', item.id);

    if (error) throw error;
    onSuccess?.('Item updated');
  }

  async function saveNew() {
    const name = form.name.trim();
    if (!name) {
      throw new Error('Product name is required');
    }

    const stockAmount = Number(form.stock_amount) || 0;
    const supplier = form.supplier_name.trim();

    if (stockAmount > 0 && !supplier) {
      throw new Error('Supplier name is required when adding stock');
    }

    const itemPayload = {
      name,
      category: form.category,
      stock_type: form.stock_type,
      current_stock: stockAmount > 0 ? 0 : stockAmount,
      low_stock_threshold: Number(form.low_stock_threshold) || 5,
      unit_label: form.stock_type === 'meter' ? 'm' : 'pcs',
    };

    const { data: newItem, error: itemError } = await supabase
      .from('inventory_items')
      .insert(itemPayload)
      .select('id')
      .single();

    if (itemError) throw itemError;

    if (stockAmount > 0) {
      const purchasePayload = {
        bill_number: form.bill_number.trim() || null,
        supplier_name: supplier,
        purchase_date: form.purchase_date,
        inventory_item_id: newItem.id,
        quantity_added: form.stock_type === 'quantity' ? stockAmount : 0,
        meters_added: form.stock_type === 'meter' ? stockAmount : 0,
        unit_cost: 0,
        total_cost: 0,
        notes: form.notes.trim() || null,
        created_by: user?.id ?? null,
      };

      const { error: purchaseError } = await supabase
        .from('inventory_purchases')
        .insert(purchasePayload);

      if (purchaseError) {
        await supabase.from('inventory_items').delete().eq('id', newItem.id);
        throw purchaseError;
      }
    }

    onSuccess?.('Inventory item added');
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-8 overflow-hidden rounded-2xl border border-gold-600/25 bg-gradient-to-b from-luxury-charcoal to-luxury-black shadow-gold"
    >
      <header className="border-b border-gold-600/20 bg-luxury-slate/40 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-600/20 border border-gold-500/30">
            <Package className="text-gold-400" size={22} />
          </div>
          <div>
            <h2 className="text-xl font-display text-gold-400">
              {isEdit ? 'Edit Inventory Item' : 'Add Inventory Item'}
            </h2>
            <p className="text-sm text-luxury-muted">
              {isEdit
                ? 'Update product details and stock levels'
                : 'Product info saves to inventory · purchase details track supplier & stock in'}
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-8 p-6">
        {/* Product */}
        <section>
          <SectionTitle icon={Layers} label="Product Information" />
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Product Name" required>
              <input
                className="input-luxury"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="e.g. Ceramic Coating 500ml"
                required
              />
            </Field>

            <Field label="Category">
              <select
                className="input-luxury"
                value={form.category}
                onChange={(e) => setField('category', e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>

            <div className="md:col-span-2">
              <span className="label-luxury">Inventory Type</span>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <TypeOption
                  active={form.stock_type === 'meter'}
                  onClick={() => handleTypeChange('meter')}
                  icon={Ruler}
                  title="Meter"
                  subtitle="PPF & tint rolls"
                  disabled={isEdit}
                />
                <TypeOption
                  active={form.stock_type === 'quantity'}
                  onClick={() => handleTypeChange('quantity')}
                  icon={Boxes}
                  title="Quantity"
                  subtitle="Bottles, chemicals, pcs"
                  disabled={isEdit}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Purchase — add only */}
        {!isEdit && (
          <section>
            <SectionTitle icon={Truck} label="Purchase Details" />
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="Supplier" hint={Number(form.stock_amount) > 0 ? 'Required when adding stock' : ''}>
                <input
                  className="input-luxury"
                  value={form.supplier_name}
                  onChange={(e) => setField('supplier_name', e.target.value)}
                  placeholder="Supplier company name"
                />
              </Field>
              <Field label="Bill Number">
                <input
                  className="input-luxury"
                  value={form.bill_number}
                  onChange={(e) => setField('bill_number', e.target.value)}
                  placeholder="INV-2026-001"
                />
              </Field>
              <Field label="Purchase Date">
                <input
                  type="date"
                  className="input-luxury"
                  value={form.purchase_date}
                  onChange={(e) => setField('purchase_date', e.target.value)}
                />
              </Field>
            </div>
          </section>
        )}

        {/* Stock */}
        <section>
          <SectionTitle icon={form.stock_type === 'meter' ? Ruler : Boxes} label="Stock Settings" />
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field
              label={form.stock_type === 'meter' ? 'Meters in Stock' : 'Quantity in Stock'}
            >
              <input
                type="number"
                min="0"
                step={form.stock_type === 'meter' ? '0.1' : '1'}
                className="input-luxury"
                value={isEdit ? form.current_stock : form.stock_amount}
                onChange={(e) =>
                  setField(isEdit ? 'current_stock' : 'stock_amount', e.target.value)
                }
                placeholder={form.stock_type === 'meter' ? '0.0' : '0'}
              />
            </Field>
            <Field label="Low Stock Alert">
              <input
                type="number"
                min="0"
                step={form.stock_type === 'meter' ? '0.1' : '1'}
                className="input-luxury"
                value={form.low_stock_threshold}
                onChange={(e) => setField('low_stock_threshold', e.target.value)}
              />
              <p className="mt-1 text-xs text-luxury-muted">
                Alert when stock falls to or below this{' '}
                {form.stock_type === 'meter' ? 'meter' : 'piece'} count
              </p>
            </Field>
          </div>
        </section>

        {/* Notes */}
        {!isEdit && (
          <section>
            <SectionTitle icon={FileText} label="Notes" />
            <textarea
              className="input-luxury mt-4 min-h-[100px] resize-y"
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
              placeholder="Optional notes about this purchase or product…"
            />
          </section>
        )}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-luxury-border bg-luxury-slate/30 px-6 py-4">
        {message && (
          <p
            className={`text-sm ${
              message.includes('added') || message.includes('updated')
                ? 'text-green-400'
                : 'text-red-400'
            }`}
          >
            {message}
          </p>
        )}
        <div className={`flex gap-3 ${message ? '' : 'ml-auto'}`}>
          <button type="button" className="btn-outline" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn-gold flex items-center gap-2" disabled={saving}>
            {saving ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Saving…
              </>
            ) : (
              <>{isEdit ? 'Update Item' : 'Save to Inventory'}</>
            )}
          </button>
        </div>
      </footer>
    </form>
  );
}

function SectionTitle({ icon: Icon, label }) {
  return (
    <div className="flex items-center gap-2 border-b border-gold-600/15 pb-2">
      <Icon size={18} className="text-gold-500" />
      <h3 className="text-sm font-semibold uppercase tracking-wider text-gold-400/90">
        {label}
      </h3>
    </div>
  );
}

function Field({ label, required, hint, children }) {
  return (
    <div>
      <label className="label-luxury">
        {label}
        {required && <span className="text-gold-500"> *</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-amber-400/80">{hint}</p>}
    </div>
  );
}

function TypeOption({ active, onClick, icon: Icon, title, subtitle, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
        active
          ? 'border-gold-500 bg-gold-600/15 text-gold-300 shadow-gold'
          : 'border-luxury-border bg-luxury-slate text-gray-400 hover:border-gold-600/40'
      } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      <Icon size={20} className={active ? 'text-gold-400' : 'text-luxury-muted'} />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-xs opacity-80">{subtitle}</p>
      </div>
    </button>
  );
}

import { useState, useEffect, useMemo } from 'react';
import { RotateCcw, X } from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { processRefund } from '@/lib/refund';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';

export default function RefundDialog({ sale, onClose, onRefunded }) {
  const { user } = useAuthStore();
  const [reason, setReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [saleItems, setSaleItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState({});
  const [customAmounts, setCustomAmounts] = useState({});

  useEffect(() => {
    if (!sale) return;
    setItemsLoading(true);
    supabase
      .from('sale_items')
      .select('id, service_name, quantity, unit_price, line_total, inventory_deducted')
      .eq('sale_id', sale.id)
      .order('id')
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message);
        } else {
          setSaleItems(data || []);
          const initial = {};
          const amounts = {};
          (data || []).forEach((it) => {
            initial[it.id] = true;
            amounts[it.id] = Number(it.line_total);
          });
          setSelectedItems(initial);
          setCustomAmounts(amounts);
        }
        setItemsLoading(false);
      });
  }, [sale]);

  const totalSelected = useMemo(() => {
    return Object.entries(selectedItems).reduce((sum, [id, selected]) => {
      if (!selected) return sum;
      return sum + (Number(customAmounts[id]) || 0);
    }, 0);
  }, [selectedItems, customAmounts]);

  const remainingBalance = useMemo(() => {
    if (!sale) return 0;
    const alreadyRefunded = Number(sale.refunded_amount) || 0;
    return Number(sale.total_amount) - alreadyRefunded;
  }, [sale]);

  function toggleItem(id) {
    setSelectedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function updateAmount(id, val) {
    const num = Math.max(0, Math.min(Number(val) || 0, Number(saleItems.find((i) => i.id === id)?.line_total || 0)));
    setCustomAmounts((prev) => ({ ...prev, [id]: num }));
  }

  const selectedCount = Object.values(selectedItems).filter(Boolean).length;

  if (!sale) return null;

  async function handleConfirm() {
    if (!reason.trim()) {
      setError('Please provide a refund reason.');
      return;
    }
    if (selectedCount === 0) {
      setError('Select at least one item to refund.');
      return;
    }
    if (totalSelected <= 0) {
      setError('Refund amount must be greater than 0.');
      return;
    }
    if (totalSelected > remainingBalance) {
      setError('Refund amount exceeds remaining balance.');
      return;
    }
    setProcessing(true);
    setError('');
    try {
      const items = saleItems
        .filter((it) => selectedItems[it.id])
        .map((it) => ({
          sale_item_id: it.id,
          service_name: it.service_name,
          quantity: it.quantity,
          line_total: customAmounts[it.id] || it.line_total,
          inventory_deducted: it.inventory_deducted || 0,
        }));
      await processRefund(sale.id, reason.trim(), user?.id, items);
      onRefunded?.();
    } catch (e) {
      setError(e.message || 'Refund failed');
    } finally {
      setProcessing(false);
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
              <p className="text-xs uppercase tracking-wider text-red-400">Refund</p>
              <h3 className="text-xl font-display text-gold-400 font-bold">{sale.invoice_number}</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-luxury-muted hover:text-gold-300 p-1"
          >
            <X size={20} />
          </button>
        </div>

        <div className="bg-luxury-slate/50 rounded-xl p-4 mb-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-luxury-muted">Customer</span>
            <span>{sale.customer_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-luxury-muted">Date</span>
            <span>{formatDateTime(sale.sale_date || sale.created_at)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-luxury-muted">Original Total</span>
            <span className="font-bold">{formatCurrency(sale.total_amount)}</span>
          </div>
          {Number(sale.refunded_amount) > 0 && (
            <div className="flex justify-between">
              <span className="text-luxury-muted">Already Refunded</span>
              <span className="text-red-400">{formatCurrency(sale.refunded_amount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-luxury-muted">Remaining</span>
            <span className="text-green-400 font-bold">{formatCurrency(remainingBalance)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-luxury-muted">Payment</span>
            <span className="capitalize">{sale.payment_method?.replace('_', ' ')}</span>
          </div>
        </div>

        {/* Items selection */}
        <p className="text-sm text-luxury-muted mb-2">Select items to refund:</p>
        {itemsLoading ? (
          <div className="text-sm text-luxury-muted py-4 text-center">Loading items...</div>
        ) : (
          <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
            {saleItems.map((it) => (
              <div
                key={it.id}
                className={`flex items-center gap-3 p-3 rounded-xl border transition cursor-pointer ${
                  selectedItems[it.id]
                    ? 'border-red-500/40 bg-red-950/10'
                    : 'border-luxury-border bg-luxury-slate/30'
                }`}
                onClick={() => toggleItem(it.id)}
              >
                <input
                  type="checkbox"
                  checked={!!selectedItems[it.id]}
                  onChange={() => toggleItem(it.id)}
                  className="accent-red-500 w-4 h-4"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{it.service_name}</p>
                  <p className="text-xs text-luxury-muted">
                    Qty: {it.quantity} × {formatCurrency(it.unit_price)}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  {selectedItems[it.id] ? (
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={it.line_total}
                      value={customAmounts[it.id] ?? it.line_total}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => updateAmount(it.id, e.target.value)}
                      className="w-24 text-right bg-luxury-card border border-luxury-border rounded-lg px-2 py-1 text-sm"
                    />
                  ) : (
                    <span className="text-sm text-luxury-muted">{formatCurrency(it.line_total)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <label className="label-luxury block mb-1">Refund Reason *</label>
        <textarea
          className="input-luxury w-full mb-4"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Customer complaint, wrong service, duplicate charge..."
        />

        {error && (
          <p className="text-red-400 text-sm mb-3">{error}</p>
        )}

        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-sm text-luxury-muted">
            {selectedCount} of {saleItems.length} items selected
          </span>
          <span className="text-lg font-bold text-red-400">{formatCurrency(totalSelected)}</span>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={processing || itemsLoading}
            className="btn-outline flex-1 flex items-center justify-center gap-2 py-2 border-red-500/40 text-red-300 hover:bg-red-950/20"
          >
            {processing ? 'Processing...' : `Refund ${formatCurrency(totalSelected)}`}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="btn-outline flex-1"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

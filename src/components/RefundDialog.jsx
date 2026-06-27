import { useState } from 'react';
import { RotateCcw, X } from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { processRefund } from '@/lib/refund';
import { useAuthStore } from '@/store/authStore';

export default function RefundDialog({ sale, onClose, onRefunded }) {
  const { user } = useAuthStore();
  const [reason, setReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  if (!sale) return null;

  async function handleConfirm() {
    if (!reason.trim()) {
      setError('Please provide a refund reason.');
      return;
    }
    setProcessing(true);
    setError('');
    try {
      await processRefund(sale.id, reason.trim(), user?.id);
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
        className="card-luxury w-full max-w-md"
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
            <span className="text-luxury-muted">Total</span>
            <span className="text-red-400 font-bold">{formatCurrency(sale.total_amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-luxury-muted">Payment</span>
            <span className="capitalize">{sale.payment_method?.replace('_', ' ')}</span>
          </div>
        </div>

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

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={processing}
            className="btn-outline flex-1 flex items-center justify-center gap-2 py-2 border-red-500/40 text-red-300 hover:bg-red-950/20"
          >
            {processing ? 'Processing...' : `Refund ${formatCurrency(sale.total_amount)}`}
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

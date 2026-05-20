import { companyInfo } from '@/lib/supabase';
import { formatCurrency, formatDateTime } from '@/lib/format';
import Logo from '@/components/Logo';

export default function InvoicePreviewPanel({
  customer,
  cart,
  subtotal,
  discount,
  taxAmount,
  taxRate,
  total,
  paymentMethod,
  invoiceNumber,
  inventoryUsage,
  compact = false,
}) {
  const hasCustomer = customer.customer_name?.trim();

  return (
    <div
      className={`rounded-2xl border border-gold-600/25 bg-gradient-to-b from-luxury-charcoal to-luxury-black shadow-gold ${
        compact ? 'p-4' : 'p-6'
      }`}
    >
      <div className="flex items-start justify-between gap-4 border-b border-gold-600/20 pb-4 mb-4">
        <Logo size="sm" showText={!compact} />
        <div className="text-right text-xs text-luxury-muted">
          <p className="text-gold-400 font-semibold uppercase tracking-wider">Invoice</p>
          <p className="text-white font-mono">{invoiceNumber || '— pending —'}</p>
          <p className="mt-1">{formatDateTime(new Date())}</p>
        </div>
      </div>

      <div className="text-xs text-luxury-muted space-y-0.5 mb-4">
        <p>{companyInfo.address}</p>
        {companyInfo.phone && <p>Tel: {companyInfo.phone}</p>}
        {companyInfo.whatsapp && (
          <p className="text-gold-400/90">WhatsApp: {companyInfo.whatsapp}</p>
        )}
      </div>

      {hasCustomer ? (
        <div className="rounded-lg bg-luxury-slate/60 border border-luxury-border p-3 mb-4 text-sm">
          <p className="font-medium text-white">{customer.customer_name}</p>
          {customer.customer_phone && (
            <p className="text-luxury-muted">{customer.customer_phone}</p>
          )}
          {(customer.car_model || customer.car_plate) && (
            <p className="text-gold-400/90 mt-1">
              {[customer.car_model, customer.car_plate].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      ) : (
        <p className="text-luxury-muted text-sm italic mb-4">Customer details not entered</p>
      )}

      {cart.length === 0 ? (
        <p className="text-center text-luxury-muted py-6 text-sm">Add services to build invoice</p>
      ) : (
        <ul className="space-y-2 mb-4 max-h-40 overflow-y-auto">
          {cart.map((line) => (
            <li
              key={line._key}
              className="flex justify-between gap-2 text-sm border-b border-luxury-border/50 pb-2"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{line.service_name}</p>
                {line.inventory_deducted > 0 && (
                  <p className="text-[10px] text-amber-400/90">
                    Stock −{line.inventory_deducted}
                    {line.stock_type === 'meter' ? 'm' : ' pcs'}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-luxury-muted text-xs">×{line.quantity}</p>
                {line.line_total > 0 && (
                  <p className="text-gold-400">{formatCurrency(line.line_total)}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {inventoryUsage?.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-600/20 bg-amber-950/20 p-3">
          <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-2">
            Inventory to deduct
          </p>
          <ul className="space-y-1 text-xs text-luxury-muted">
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

      <div className="space-y-1 border-t border-luxury-border pt-3 text-sm">
        <div className="flex justify-between text-luxury-muted">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        {Number(discount) > 0 && (
          <div className="flex justify-between text-luxury-muted">
            <span>Discount</span>
            <span className="text-red-400">−{formatCurrency(discount)}</span>
          </div>
        )}
        {Number(taxAmount) > 0 && (
          <div className="flex justify-between text-luxury-muted">
            <span>Tax ({taxRate}%)</span>
            <span>{formatCurrency(taxAmount)}</span>
          </div>
        )}
        <div className="flex justify-between text-lg font-bold text-gold-400 pt-1">
          <span>Grand Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
        {paymentMethod && (
          <p className="text-xs text-luxury-muted pt-1 capitalize">
            Payment: {paymentMethod.replace('_', ' ')}
          </p>
        )}
      </div>
    </div>
  );
}

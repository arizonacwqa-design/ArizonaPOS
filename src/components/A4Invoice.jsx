import { forwardRef } from 'react';
import { companyInfo } from '@/lib/supabase';
import { formatCurrency, formatDateTime } from '@/lib/format';
import Logo from '@/components/Logo';
import InvoiceQr from '@/components/InvoiceQr';

const A4Invoice = forwardRef(function A4Invoice(
  { sale, items, inventoryUsage = [] },
  ref
) {
  if (!sale) return null;

  return (
    <div
      id="a4-invoice"
      ref={ref}
      className="hidden print:block bg-white text-gray-900 p-10 max-w-[210mm] mx-auto invoice-luxury"
    >
      <header className="flex justify-between items-center border-b-4 border-amber-600 pb-6 mb-6 bg-white -mx-10 -mt-10 px-10 pt-8 text-gray-900 rounded-b-lg">
        <Logo size="xl" />
        <div className="text-right text-sm flex flex-col items-end gap-2">
          <InvoiceQr sale={sale} size={80} />
          <p className="text-2xl font-bold text-amber-700 font-display">INVOICE</p>
          <p className="font-mono text-lg mt-1 text-gray-900">{sale.invoice_number}</p>
          <p className="text-gray-500 mt-1">{formatDateTime(sale.sale_date || sale.created_at)}</p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
        <div>
          <p className="text-xs uppercase tracking-wider text-amber-700 font-semibold mb-2">
            Bill To
          </p>
          <p className="font-semibold text-lg">{sale.customer_name}</p>
          {sale.customer_phone && <p>{sale.customer_phone}</p>}
          {(sale.car_model || sale.car_plate) && (
            <p className="text-gray-600 mt-1">
              Vehicle: {[sale.car_model, sale.car_plate].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wider text-amber-700 font-semibold mb-2">
            Arizona Car World
          </p>
          <p>{companyInfo.address}</p>
          {companyInfo.phone && <p>Tel: {companyInfo.phone}</p>}
          {companyInfo.whatsapp && (
            <p className="font-medium text-amber-800">WhatsApp: {companyInfo.whatsapp}</p>
          )}
        </div>
      </div>

      <table className="w-full text-sm mb-6">
        <thead>
          <tr className="bg-amber-50 border-y border-amber-200">
            <th className="text-left py-3 px-2">Description</th>
            <th className="text-center py-3 px-2 w-16">Qty</th>
            <th className="text-right py-3 px-2 w-24">Unit</th>
            <th className="text-right py-3 px-2 w-28">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items?.map((item) => (
            <tr key={item.id} className={`border-b border-gray-100 ${!item.service_id ? 'no-print' : ''}`}>
              <td className="py-3 px-2">{item.service_name}</td>
              <td className="text-center py-3 px-2">{item.quantity}</td>
              <td className="text-right py-3 px-2">{formatCurrency(item.unit_price)}</td>
              <td className="text-right py-3 px-2 font-medium">
                {Number(item.line_total) > 0 ? formatCurrency(item.line_total) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="no-print">
        {inventoryUsage.length > 0 && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs uppercase tracking-wider text-amber-700 font-semibold mb-2">
              Inventory Used (deducted from stock)
            </p>
            <ul className="text-sm grid grid-cols-2 gap-2">
              {inventoryUsage.map((u) => (
                <li key={u.id} className="flex justify-between">
                  <span>{u.name}</span>
                  <span>
                    −{u.total}
                    {u.stock_type === 'meter' ? ' m' : ' pcs'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <div className="w-64 space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
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
              <span>Tax ({sale.tax_rate}%)</span>
              <span>{formatCurrency(sale.tax_amount)}</span>
            </div>
          )}
          <div className="flex justify-between text-xl font-bold text-amber-800 border-t-2 border-amber-700 pt-2">
            <span>Grand Total</span>
            <span>{formatCurrency(sale.total_amount)}</span>
          </div>
          <p className="text-xs text-gray-500 capitalize pt-1">
            Payment: {sale.payment_method?.replace('_', ' ')}
          </p>
        </div>
      </div>

      {sale.notes && (
        <p className="mt-6 text-sm text-gray-600">
          <strong>Notes:</strong> {sale.notes}
        </p>
      )}

      <footer className="mt-12 pt-6 border-t text-center text-xs text-gray-500">
        <p>Thank you for choosing {companyInfo.name}</p>
        {companyInfo.whatsapp && <p className="mt-1">WhatsApp: {companyInfo.whatsapp}</p>}
        <p className="mt-3 text-[10px] text-gray-400">Powered by Friend's &amp; Co Software</p>
        <p className="text-[10px] text-gray-400">&copy; 2025 Arizona Car World</p>
      </footer>
    </div>
  );
});

export default A4Invoice;

import { forwardRef } from 'react';
import { companyInfo } from '@/lib/supabase';
import { formatCurrency, formatDateTime } from '@/lib/format';
import InvoiceQr from '@/components/InvoiceQr';

const ThermalInvoice = forwardRef(function ThermalInvoice(
  { sale, items, inventoryUsage = [] },
  ref
) {
  if (!sale) return null;

  return (
    <div
      id="thermal-invoice"
      ref={ref}
      className="hidden print:block bg-white text-black p-4 font-mono text-xs invoice-luxury"
      style={{ width: '80mm' }}
    >
      <div className="text-center mb-3 bg-white -mx-4 -mt-4 px-4 pt-4 pb-3 border-b border-black">
        <img
          src="/logo.png"
          alt={companyInfo.name}
          className="w-20 h-20 mx-auto mb-2 object-contain"
        />
        <p className="font-bold text-sm uppercase tracking-wide text-black">{companyInfo.name}</p>
        <p className="text-[10px] leading-tight mt-1">{companyInfo.address}</p>
        {companyInfo.phone && <p className="text-[10px]">Tel: {companyInfo.phone}</p>}
        {companyInfo.whatsapp && (
          <p className="text-[10px] font-semibold">WhatsApp: {companyInfo.whatsapp}</p>
        )}
        {companyInfo.instagram && <p className="text-[10px]">IG: {companyInfo.instagram}</p>}
      </div>

      <hr className="border-dashed border-black my-2" />

      <p>
        <strong>Invoice #</strong> {sale.invoice_number}
      </p>
      <p>
        <strong>Date:</strong> {formatDateTime(sale.sale_date || sale.created_at)}
      </p>

      <hr className="border-dashed border-black my-2" />

      <p>
        <strong>Customer:</strong> {sale.customer_name}
      </p>
      {sale.customer_phone && (
        <p>
          <strong>Phone:</strong> {sale.customer_phone}
        </p>
      )}
      {sale.car_model && (
        <p>
          <strong>Vehicle:</strong> {sale.car_model}
        </p>
      )}
      {sale.car_plate && (
        <p>
          <strong>Plate:</strong> {sale.car_plate}
        </p>
      )}

      <hr className="border-dashed border-black my-2" />

      <table className="w-full text-[10px]">
        <thead>
          <tr className="border-b border-black">
            <th className="text-left py-1">Service / Item</th>
            <th className="text-center py-1">Qty</th>
            <th className="text-right py-1">Amt</th>
          </tr>
        </thead>
        <tbody>
          {items?.map((item) => (
            <tr key={item.id}>
              <td className="py-1 pr-1 align-top">{item.service_name}</td>
              <td className="text-center py-1 align-top">{item.quantity}</td>
              <td className="text-right py-1 align-top">
                {Number(item.line_total) > 0 ? formatCurrency(item.line_total) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {inventoryUsage.length > 0 && (
        <>
          <hr className="border-dashed border-black my-2" />
          <p className="font-bold text-[10px] mb-1">Inventory Used</p>
          <ul className="text-[10px] space-y-0.5">
            {inventoryUsage.map((u) => (
              <li key={u.id} className="flex justify-between">
                <span>{u.name}</span>
                <span>
                  −{u.total}
                  {u.stock_type === 'meter' ? 'm' : ' pcs'}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <hr className="border-dashed border-black my-2" />

      <div className="space-y-0.5 text-[11px]">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatCurrency(sale.subtotal)}</span>
        </div>
        {Number(sale.discount) > 0 && (
          <div className="flex justify-between">
            <span>Discount</span>
            <span>-{formatCurrency(sale.discount)}</span>
          </div>
        )}
        {Number(sale.tax_amount) > 0 && (
          <div className="flex justify-between">
            <span>Tax ({sale.tax_rate}%)</span>
            <span>{formatCurrency(sale.tax_amount)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-sm border-t border-black pt-1 mt-1">
          <span>GRAND TOTAL</span>
          <span>{formatCurrency(sale.total_amount)}</span>
        </div>
        <p className="text-[10px] mt-2 capitalize">
          Payment: {sale.payment_method?.replace('_', ' ')}
        </p>
      </div>

      {sale.notes && (
        <>
          <hr className="border-dashed border-black my-2" />
          <p className="text-[10px]">
            <strong>Notes:</strong> {sale.notes}
          </p>
        </>
      )}

      <hr className="border-dashed border-black my-2" />
      <div className="flex flex-col items-center gap-2">
        <InvoiceQr sale={sale} size={64} />
        <p className="text-center text-[10px] font-medium">Thank you — {companyInfo.name}</p>
        {companyInfo.whatsapp && (
          <p className="text-center text-[10px]">WhatsApp: {companyInfo.whatsapp}</p>
        )}
      </div>
    </div>
  );
});

export default ThermalInvoice;

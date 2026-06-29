import { forwardRef } from 'react';
import { companyInfo } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/format';

const PurchasePrint = forwardRef(function PurchasePrint({ purchase, items }, ref) {
  if (!purchase) return null;

  const billItems = items || [];
  const grandTotal = billItems.reduce((s, i) => s + Number(i.total_cost || 0), 0) || Number(purchase.total_cost || 0);

  return (
    <div className="hidden print:block bg-white text-gray-900 p-10 max-w-[210mm] mx-auto" ref={ref}>
      <header className="border-b-4 border-amber-600 pb-6 mb-6">
        <h1 className="text-2xl font-bold text-amber-700 text-center font-display">{companyInfo.name}</h1>
        {companyInfo.address && <p className="text-center text-sm text-gray-600 mt-1">{companyInfo.address}</p>}
      </header>

      <h2 className="text-lg font-semibold text-gray-800 mb-4">Purchase Bill</h2>

      <div className="grid grid-cols-3 gap-4 text-sm mb-6">
        <div>
          <p className="text-gray-500">Bill Number</p>
          <p className="font-medium">{purchase.bill_number || '—'}</p>
        </div>
        <div>
          <p className="text-gray-500">Supplier</p>
          <p className="font-medium">{purchase.supplier_name}</p>
        </div>
        <div>
          <p className="text-gray-500">Date</p>
          <p className="font-medium">{formatDate(purchase.purchase_date)}</p>
        </div>
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b-2 border-gray-300">
            <th className="text-left py-2 px-1 text-gray-600 font-semibold">#</th>
            <th className="text-left py-2 px-1 text-gray-600 font-semibold">Item Name</th>
            <th className="text-center py-2 px-1 text-gray-600 font-semibold">Quantity</th>
            <th className="text-right py-2 px-1 text-gray-600 font-semibold">Unit Cost</th>
            <th className="text-right py-2 px-1 text-gray-600 font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {billItems.map((i, idx) => (
            <tr key={i.id || idx} className="border-b border-gray-200">
              <td className="py-1.5 px-1 text-gray-500">{idx + 1}</td>
              <td className="py-1.5 px-1">{i.item_name}</td>
              <td className="py-1.5 px-1 text-center">{Number(i.quantity)}</td>
              <td className="py-1.5 px-1 text-right">{formatCurrency(i.unit_cost)}</td>
              <td className="py-1.5 px-1 text-right font-medium">{formatCurrency(i.total_cost)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-400 font-bold text-base">
            <td colSpan={4} className="py-2 px-1 text-right">Grand Total</td>
            <td className="py-2 px-1 text-right">{formatCurrency(grandTotal)}</td>
          </tr>
        </tfoot>
      </table>

      {purchase.notes && (
        <p className="mt-4 text-sm text-gray-600 italic">Notes: {purchase.notes}</p>
      )}

      <footer className="mt-8 pt-4 border-t text-center text-[10px] text-gray-400">
        Powered by Friend's &amp; Co Software
      </footer>
    </div>
  );
});

export default PurchasePrint;

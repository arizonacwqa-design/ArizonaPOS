import { useEffect, useState } from 'react';
import { companyInfo } from '@/lib/supabase';
import { formatCurrency } from '@/lib/format';
import QRCode from 'qrcode';

export default function InvoiceQr({ sale, size = 72, className = '' }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    if (!sale) {
      setSrc('');
      return;
    }
    const payload = [
      companyInfo.name,
      sale.invoice_number,
      formatCurrency(sale.total_amount),
      sale.customer_phone || '',
    ].join(' | ');

    QRCode.toDataURL(payload, {
      width: size * 2,
      margin: 1,
      color: { dark: '#0a0a0a', light: '#ffffff' },
    }).then(setSrc).catch(() => setSrc(''));
  }, [sale, size]);

  if (!src) return null;

  return (
    <img
      src={src}
      alt="Invoice QR"
      width={size}
      height={size}
      className={`rounded border border-amber-200/80 ${className}`}
    />
  );
}

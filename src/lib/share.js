import { formatCurrency, formatDateTime } from '@/lib/format';
import { companyInfo } from '@/lib/supabase';

/** Strip phone to digits for wa.me (Qatar default country code 974 if local). */
export function sanitizePhone(phone, defaultCountryCode = '974') {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('0')) digits = defaultCountryCode + digits.slice(1);
  if (digits.length <= 8 && defaultCountryCode) {
    digits = defaultCountryCode + digits;
  }
  return digits;
}

export function buildInvoiceWhatsAppMessage(sale, items = []) {
  if (!sale) return '';
  const lines = items
    .map((i) => `• ${i.service_name} ×${i.quantity} — ${formatCurrency(i.line_total)}`)
    .join('\n');
  return [
    `*${companyInfo.name}*`,
    `Invoice: *${sale.invoice_number}*`,
    `Date: ${formatDateTime(sale.sale_date || sale.created_at)}`,
    '',
    `Customer: ${sale.customer_name}`,
    sale.customer_phone ? `Phone: ${sale.customer_phone}` : null,
    sale.car_model ? `Vehicle: ${sale.car_model}` : null,
    sale.car_plate ? `Plate: ${sale.car_plate}` : null,
    '',
    lines || '—',
    '',
    `*Total: ${formatCurrency(sale.total_amount)}*`,
    `Payment: ${(sale.payment_method || 'cash').replace('_', ' ')}`,
    '',
    'Thank you for choosing Arizona Car World!',
    companyInfo.whatsapp ? `Shop WhatsApp: ${companyInfo.whatsapp}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export function whatsAppUrl(phone, message) {
  const digits = sanitizePhone(phone);
  const base = digits ? `https://wa.me/${digits}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(message)}`;
}

export function buildRefundWhatsAppMessage(sale, refunds, totalRefunded, allItems = []) {
  if (!sale) return '';
  const lines = allItems
    .map((i) => `• ${i.service_name} ×${i.quantity} — ${formatCurrency(i.line_total)}`)
    .join('\n');
  return [
    `*${companyInfo.name}*`,
    `REFUND — Invoice: *${sale.invoice_number}*`,
    `Date: ${formatDateTime(refunds[0]?.refunded_at)}`,
    '',
    `Customer: ${sale.customer_name}`,
    sale.customer_phone ? `Phone: ${sale.customer_phone}` : null,
    '',
    lines || '—',
    '',
    `*Total Refunded: ${formatCurrency(totalRefunded)}*`,
    `Payment: ${(sale.payment_method || 'cash').replace('_', ' ')}`,
    refunds[0]?.refund_reason ? `Reason: ${refunds[0].refund_reason}` : null,
    '',
    'Thank you for choosing Arizona Car World!',
    companyInfo.whatsapp ? `Shop WhatsApp: ${companyInfo.whatsapp}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export function openWhatsApp(phone, message) {
  const url = whatsAppUrl(phone, message);
  if (window.electronAPI?.openExternal) {
    window.electronAPI.openExternal(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

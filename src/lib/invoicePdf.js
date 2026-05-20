import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { companyInfo } from '@/lib/supabase';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { buildInvoiceWhatsAppMessage } from '@/lib/share';

const GOLD = [201, 162, 39];
const BLACK = [10, 10, 10];

async function qrDataUrl(text) {
  return QRCode.toDataURL(text, { width: 120, margin: 1, color: { dark: '#0a0a0a', light: '#ffffff' } });
}

function invoiceQrPayload(sale) {
  return buildInvoiceWhatsAppMessage(sale, []);
}

export async function downloadLuxuryInvoicePdf(sale, items, { format = 'a4' } = {}) {
  const isThermal = format === 'thermal';
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: isThermal ? [80, 200] : 'a4',
  });

  const pageW = doc.internal.pageSize.getWidth();
  const qrText = [
    companyInfo.name,
    sale.invoice_number,
    formatCurrency(sale.total_amount),
    sale.customer_phone || '',
  ].join(' | ');
  const qr = await qrDataUrl(qrText);

  let y = 8;

  if (isThermal) {
    doc.setFillColor(...BLACK);
    doc.rect(0, 0, pageW, 28, 'F');
    doc.setTextColor(...GOLD);
    doc.setFontSize(11);
    doc.text(companyInfo.name, pageW / 2, 10, { align: 'center' });
    doc.setFontSize(7);
    doc.setTextColor(220, 220, 220);
    doc.text(companyInfo.address, pageW / 2, 15, { align: 'center' });
    if (companyInfo.phone) doc.text(companyInfo.phone, pageW / 2, 19, { align: 'center' });
    y = 32;
  } else {
    doc.setFillColor(...BLACK);
    doc.rect(0, 0, pageW, 45, 'F');
    doc.setTextColor(...GOLD);
    doc.setFontSize(22);
    doc.text(companyInfo.name, 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(200, 200, 200);
    doc.text(companyInfo.address, 14, 26);
    if (companyInfo.phone) doc.text(`Tel: ${companyInfo.phone}`, 14, 32);
    if (companyInfo.whatsapp) doc.text(`WhatsApp: ${companyInfo.whatsapp}`, 14, 38);
    doc.setTextColor(...GOLD);
    doc.setFontSize(18);
    doc.text('INVOICE', pageW - 14, 18, { align: 'right' });
    doc.setFontSize(11);
    doc.text(sale.invoice_number, pageW - 14, 26, { align: 'right' });
    doc.setTextColor(180, 180, 180);
    doc.text(formatDateTime(sale.sale_date || sale.created_at), pageW - 14, 32, { align: 'right' });
    doc.addImage(qr, 'PNG', pageW - 42, 8, 28, 28);
    y = 52;
  }

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(isThermal ? 8 : 10);
  doc.text(`Customer: ${sale.customer_name}`, 4, y);
  y += isThermal ? 4 : 6;
  if (sale.customer_phone) {
    doc.text(`Phone: ${sale.customer_phone}`, 4, y);
    y += isThermal ? 4 : 6;
  }
  if (sale.car_model || sale.car_plate) {
    doc.text(`Vehicle: ${[sale.car_model, sale.car_plate].filter(Boolean).join(' · ')}`, 4, y);
    y += isThermal ? 4 : 6;
  }

  y += 2;
  doc.setDrawColor(...GOLD);
  doc.line(4, y, pageW - 4, y);
  y += 5;

  doc.setFontSize(isThermal ? 7 : 9);
  items.forEach((item) => {
    const name = String(item.service_name).slice(0, isThermal ? 22 : 50);
    const line = `${name}  ×${item.quantity}  ${formatCurrency(item.line_total)}`;
    doc.text(line, 4, y);
    y += isThermal ? 4 : 6;
    if (y > doc.internal.pageSize.getHeight() - 30) {
      doc.addPage();
      y = 10;
    }
  });

  y += 3;
  doc.line(4, y, pageW - 4, y);
  y += 6;

  doc.setFontSize(isThermal ? 8 : 10);
  const totals = [
    ['Subtotal', formatCurrency(sale.subtotal)],
    Number(sale.discount) > 0 ? ['Discount', `-${formatCurrency(sale.discount)}`] : null,
    Number(sale.tax_amount) > 0 ? [`Tax (${sale.tax_rate}%)`, formatCurrency(sale.tax_amount)] : null,
  ].filter(Boolean);

  totals.forEach(([label, val]) => {
    doc.text(label, 4, y);
    doc.text(val, pageW - 4, y, { align: 'right' });
    y += isThermal ? 4 : 6;
  });

  doc.setFontSize(isThermal ? 10 : 14);
  doc.setTextColor(...GOLD);
  doc.text('GRAND TOTAL', 4, y + 2);
  doc.text(formatCurrency(sale.total_amount), pageW - 4, y + 2, { align: 'right' });

  if (isThermal) {
    doc.addImage(qr, 'PNG', pageW / 2 - 12, y + 8, 24, 24);
    y += 34;
  }

  y += isThermal ? 0 : 12;
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text('Thank you — Arizona Car World', pageW / 2, y, { align: 'center' });

  const filename = `invoice-${sale.invoice_number}-${format}.pdf`;
  doc.save(filename);
  return filename;
}

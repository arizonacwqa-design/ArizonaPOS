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

let cachedLogo = null;
async function loadLogoDataUrl() {
  if (cachedLogo !== null) return cachedLogo;
  try {
    const res = await fetch('/logo.png');
    if (!res.ok) throw new Error('logo missing');
    const blob = await res.blob();
    cachedLogo = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return cachedLogo;
  } catch {
    cachedLogo = '';
    return '';
  }
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
  const [qr, logo] = await Promise.all([qrDataUrl(qrText), loadLogoDataUrl()]);

  let y = 8;

  if (isThermal) {
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageW, 32, 'F');
    if (logo) {
      doc.addImage(logo, 'PNG', pageW / 2 - 9, 3, 18, 18);
    }
    doc.setTextColor(...BLACK);
    doc.setFontSize(9);
    doc.text(companyInfo.name, pageW / 2, 24, { align: 'center' });
    doc.setFontSize(6);
    doc.setTextColor(80, 80, 80);
    doc.text(companyInfo.address, pageW / 2, 28, { align: 'center' });
    if (companyInfo.phone) doc.text(companyInfo.phone, pageW / 2, 31, { align: 'center' });
    y = 36;
  } else {
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageW, 50, 'F');
    if (logo) {
      doc.addImage(logo, 'PNG', 14, 8, 34, 34);
    }
    doc.setTextColor(...BLACK);
    doc.setFontSize(20);
    doc.text(companyInfo.name, 54, 20);
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text(companyInfo.address, 54, 27);
    if (companyInfo.phone) doc.text(`Tel: ${companyInfo.phone}`, 54, 32);
    if (companyInfo.whatsapp) doc.text(`WhatsApp: ${companyInfo.whatsapp}`, 54, 37);
    doc.setFontSize(18);
    doc.setTextColor(...GOLD);
    doc.text('INVOICE', pageW - 40, 14, { align: 'right' });
    doc.setFontSize(11);
    doc.setTextColor(...BLACK);
    doc.text(sale.invoice_number, pageW - 40, 22, { align: 'right' });
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(8);
    doc.text(formatDateTime(sale.sale_date || sale.created_at), pageW - 40, 28, { align: 'right' });
    doc.addImage(qr, 'PNG', pageW - 36, 10, 22, 22);
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.6);
    doc.line(0, 50, pageW, 50);
    y = 60;
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

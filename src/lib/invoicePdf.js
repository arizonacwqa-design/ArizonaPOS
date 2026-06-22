import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { companyInfo } from '@/lib/supabase';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { buildInvoiceWhatsAppMessage } from '@/lib/share';

// Matches the preview swatches (tailwind amber-700 + gray neutrals)
const AMBER = [180, 83, 9]; // amber-700-ish for "INVOICE", totals
const AMBER_BG = [254, 243, 199]; // amber-100 for table header
const AMBER_BORDER = [217, 119, 6]; // amber-600
const GOLD = [201, 162, 39];
const TEXT = [17, 24, 39]; // gray-900
const SUBTLE = [107, 114, 128]; // gray-500

async function qrDataUrl(text) {
  return QRCode.toDataURL(text, {
    width: 140,
    margin: 1,
    color: { dark: '#0a0a0a', light: '#ffffff' },
  });
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
  if (isThermal) return renderThermalPdf(sale, items);
  return renderA4Pdf(sale, items);
}

async function renderA4Pdf(sale, items) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const innerW = pageW - margin * 2;

  const qrText = [
    companyInfo.name,
    sale.invoice_number,
    formatCurrency(sale.total_amount),
    sale.customer_phone || '',
  ].join(' | ');
  const [qr, logo] = await Promise.all([qrDataUrl(qrText), loadLogoDataUrl()]);

  // ---------- Header ----------
  let y = margin;

  if (logo) {
    doc.addImage(logo, 'PNG', margin, y, 24, 24);
  }

  // Company name + tagline
  doc.setTextColor(...TEXT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(companyInfo.name, margin + 28, y + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...SUBTLE);
  doc.text('Detailing · PPF · Tint', margin + 28, y + 15);
  if (companyInfo.address) doc.text(companyInfo.address, margin + 28, y + 20);

  // Right side — INVOICE label, number, date, QR
  const qrSize = 24;
  const qrX = pageW - margin - qrSize;
  doc.addImage(qr, 'PNG', qrX, y, qrSize, qrSize);

  const rightTextX = qrX - 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...AMBER);
  doc.text('INVOICE', rightTextX, y + 7, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...TEXT);
  doc.text(sale.invoice_number, rightTextX, y + 14, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...SUBTLE);
  doc.text(formatDateTime(sale.sale_date || sale.created_at), rightTextX, y + 20, { align: 'right' });

  y += 30;

  // Divider
  doc.setDrawColor(...AMBER_BORDER);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // ---------- Bill To + Payment ----------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...AMBER);
  doc.text('BILL TO', margin, y);
  doc.text('PAYMENT', pageW - margin, y, { align: 'right' });
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...TEXT);
  doc.text(sale.customer_name || '—', margin, y);
  doc.text(capitalize(sale.payment_method?.replace('_', ' ')) || '—', pageW - margin, y, { align: 'right' });
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...SUBTLE);
  if (sale.customer_phone) {
    doc.text(sale.customer_phone, margin, y);
    y += 4.5;
  }
  if (sale.car_model || sale.car_plate) {
    const vehicle = `Vehicle: ${[sale.car_model, sale.car_plate].filter(Boolean).join(' · ')}`;
    doc.text(vehicle, margin, y);
    y += 4.5;
  }
  y += 6;

  // ---------- Items table ----------
  const tableLeft = margin;
  const colDescW = innerW * 0.55;
  const colQtyX = tableLeft + colDescW + innerW * 0.07;
  const colUnitX = tableLeft + colDescW + innerW * 0.22;
  const colAmtX = pageW - margin;
  const headerH = 8;

  // Header background
  doc.setFillColor(...AMBER_BG);
  doc.rect(tableLeft, y, innerW, headerH, 'F');
  doc.setDrawColor(...AMBER_BORDER);
  doc.setLineWidth(0.3);
  doc.line(tableLeft, y, pageW - margin, y);
  doc.line(tableLeft, y + headerH, pageW - margin, y + headerH);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);
  doc.text('Description', tableLeft + 2, y + 5.5);
  doc.text('Qty', colQtyX, y + 5.5, { align: 'center' });
  doc.text('Unit', colUnitX, y + 5.5, { align: 'right' });
  doc.text('Amount', colAmtX, y + 5.5, { align: 'right' });

  y += headerH + 2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);

  items.forEach((item) => {
    const rowH = 7;
    const nameLines = doc.splitTextToSize(String(item.service_name || ''), colDescW - 4);
    const linesH = nameLines.length * 5;
    const usedH = Math.max(rowH, linesH);

    // Page break guard
    if (y + usedH + 50 > pageH) {
      doc.addPage();
      y = margin;
    }

    doc.text(nameLines, tableLeft + 2, y + 5);
    doc.text(String(item.quantity), colQtyX, y + 5, { align: 'center' });
    doc.text(formatCurrency(item.unit_price), colUnitX, y + 5, { align: 'right' });
    const amt = Number(item.line_total) > 0 ? formatCurrency(item.line_total) : '—';
    doc.text(amt, colAmtX, y + 5, { align: 'right' });

    y += usedH;
    // light separator
    doc.setDrawColor(229, 231, 235); // gray-200
    doc.setLineWidth(0.1);
    doc.line(tableLeft, y, pageW - margin, y);
    y += 1.5;
  });

  y += 4;

  // ---------- Totals block (right-aligned) ----------
  const totalsLeft = pageW / 2 + 10;
  const labelX = totalsLeft;
  const valueX = pageW - margin;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);

  const drawTotalRow = (label, value, opts = {}) => {
    if (opts.muted) doc.setTextColor(...SUBTLE);
    else doc.setTextColor(...TEXT);
    if (opts.red) doc.setTextColor(180, 30, 30);
    doc.text(label, labelX, y);
    doc.text(value, valueX, y, { align: 'right' });
    y += 5.5;
  };

  drawTotalRow('Subtotal', formatCurrency(sale.subtotal), { muted: true });
  if (Number(sale.discount) > 0) {
    drawTotalRow('Discount', `−${formatCurrency(sale.discount)}`, { red: true });
  }
  if (Number(sale.tax_amount) > 0) {
    drawTotalRow(`Tax (${sale.tax_rate}%)`, formatCurrency(sale.tax_amount), { muted: true });
  }

  // Grand total bar
  doc.setDrawColor(...AMBER_BORDER);
  doc.setLineWidth(0.7);
  doc.line(totalsLeft, y, pageW - margin, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...AMBER);
  doc.text('GRAND TOTAL', labelX, y);
  doc.text(formatCurrency(sale.total_amount), valueX, y, { align: 'right' });
  y += 8;

  // Notes
  if (sale.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...TEXT);
    doc.text('Notes:', margin, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...SUBTLE);
    const notesLines = doc.splitTextToSize(sale.notes, innerW - 16);
    doc.text(notesLines, margin + 14, y + 4);
    y += 4 + notesLines.length * 4.5;
  }

  // ---------- Footer ----------
  const footerY = pageH - 14;
  doc.setDrawColor(...AMBER_BORDER);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY - 6, pageW - margin, footerY - 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...SUBTLE);
  doc.text(`Thank you for choosing ${companyInfo.name}`, pageW / 2, footerY - 1, { align: 'center' });
  const contactLine = [
    companyInfo.phone && `Tel: ${companyInfo.phone}`,
    companyInfo.whatsapp && `WhatsApp: ${companyInfo.whatsapp}`,
    companyInfo.instagram && `IG: ${companyInfo.instagram}`,
  ]
    .filter(Boolean)
    .join('   ·   ');
  if (contactLine) doc.text(contactLine, pageW / 2, footerY + 3, { align: 'center' });

  const filename = `invoice-${sale.invoice_number}-a4.pdf`;
  doc.save(filename);
  return filename;
}

async function renderThermalPdf(sale, items) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [80, 220] });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const left = 4;
  const right = pageW - 4;

  const qrText = [
    companyInfo.name,
    sale.invoice_number,
    formatCurrency(sale.total_amount),
    sale.customer_phone || '',
  ].join(' | ');
  const [qr, logo] = await Promise.all([qrDataUrl(qrText), loadLogoDataUrl()]);

  let y = 4;

  if (logo) {
    doc.addImage(logo, 'PNG', pageW / 2 - 10, y, 20, 20);
    y += 22;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  doc.text(companyInfo.name, pageW / 2, y, { align: 'center' });
  y += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...SUBTLE);
  if (companyInfo.address) {
    doc.text(companyInfo.address, pageW / 2, y, { align: 'center' });
    y += 3.2;
  }
  if (companyInfo.phone) {
    doc.text(`Tel: ${companyInfo.phone}`, pageW / 2, y, { align: 'center' });
    y += 3.2;
  }
  y += 2;

  // separator
  doc.setDrawColor(...AMBER_BORDER);
  doc.setLineWidth(0.4);
  doc.line(left, y, right, y);
  y += 4;

  // Invoice meta
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...TEXT);
  doc.text(`Invoice ${sale.invoice_number}`, left, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...SUBTLE);
  doc.text(formatDateTime(sale.sale_date || sale.created_at), right, y, { align: 'right' });
  y += 4;

  // Customer
  doc.setTextColor(...TEXT);
  doc.setFontSize(8);
  doc.text(`Customer: ${sale.customer_name}`, left, y);
  y += 3.5;
  if (sale.customer_phone) {
    doc.text(`Phone: ${sale.customer_phone}`, left, y);
    y += 3.5;
  }
  if (sale.car_model || sale.car_plate) {
    doc.text(`Vehicle: ${[sale.car_model, sale.car_plate].filter(Boolean).join(' · ')}`, left, y);
    y += 3.5;
  }
  y += 1;

  // Items header
  doc.setDrawColor(...AMBER_BORDER);
  doc.setLineWidth(0.3);
  doc.line(left, y, right, y);
  y += 3.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('Item', left, y);
  doc.text('Qty', pageW - 22, y, { align: 'right' });
  doc.text('Amount', right, y, { align: 'right' });
  y += 2.5;
  doc.line(left, y, right, y);
  y += 3;

  // Items
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT);
  items.forEach((item) => {
    const nameLines = doc.splitTextToSize(String(item.service_name || ''), pageW - 30);
    nameLines.forEach((line, idx) => {
      doc.text(line, left, y);
      if (idx === 0) {
        doc.text(String(item.quantity), pageW - 22, y, { align: 'right' });
        const amt = Number(item.line_total) > 0 ? formatCurrency(item.line_total) : '—';
        doc.text(amt, right, y, { align: 'right' });
      }
      y += 3.5;
    });
  });
  y += 1;

  doc.setDrawColor(...AMBER_BORDER);
  doc.setLineWidth(0.3);
  doc.line(left, y, right, y);
  y += 4;

  // Totals
  const drawRow = (label, value, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 9 : 7.5);
    doc.setTextColor(...(bold ? AMBER : TEXT));
    doc.text(label, left, y);
    doc.text(value, right, y, { align: 'right' });
    y += bold ? 5 : 3.8;
  };
  drawRow('Subtotal', formatCurrency(sale.subtotal));
  if (Number(sale.discount) > 0) drawRow('Discount', `−${formatCurrency(sale.discount)}`);
  if (Number(sale.tax_amount) > 0) drawRow(`Tax (${sale.tax_rate}%)`, formatCurrency(sale.tax_amount));
  doc.setDrawColor(...AMBER_BORDER);
  doc.setLineWidth(0.4);
  doc.line(left, y - 1, right, y - 1);
  y += 1;
  drawRow('TOTAL', formatCurrency(sale.total_amount), true);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...SUBTLE);
  doc.text(`Payment: ${capitalize(sale.payment_method?.replace('_', ' '))}`, left, y);
  y += 5;

  // QR + thank you
  doc.addImage(qr, 'PNG', pageW / 2 - 12, y, 24, 24);
  y += 26;
  doc.setFontSize(7);
  doc.text(`Thank you — ${companyInfo.name}`, pageW / 2, y, { align: 'center' });
  if (companyInfo.whatsapp) {
    y += 3.5;
    doc.text(`WhatsApp: ${companyInfo.whatsapp}`, pageW / 2, y, { align: 'center' });
  }

  const filename = `invoice-${sale.invoice_number}-thermal.pdf`;
  doc.save(filename);
  return filename;
}

function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

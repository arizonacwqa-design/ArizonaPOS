import { jsPDF } from 'jspdf';
import { companyInfo } from '@/lib/supabase';
import { formatCurrency, formatDateTime } from '@/lib/format';

const RED = [200, 30, 30];
const TEXT = [17, 24, 39];
const SUBTLE = [107, 114, 128];

async function loadLogoDataUrl() {
  try {
    const res = await fetch('/logo.png');
    if (!res.ok) throw new Error('logo missing');
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

async function renderRefundA4Pdf(sale, refunds, totalRefunded, allItems) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const innerW = pageW - margin * 2;

  const logo = await loadLogoDataUrl();
  let y = margin;

  if (logo) {
    doc.addImage(logo, 'PNG', margin, y, 24, 24);
  }

  doc.setTextColor(...TEXT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(companyInfo.name, margin + 28, y + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...SUBTLE);
  if (companyInfo.address) doc.text(companyInfo.address, margin + 28, y + 18);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...RED);
  doc.text('REFUND SLIP', pageW - margin, y + 9, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...TEXT);
  doc.text(sale?.invoice_number || '—', pageW - margin, y + 18, { align: 'right' });

  y += 30;
  doc.setDrawColor(...RED);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...RED);
  doc.text('REFUND INFORMATION', margin, y);
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...TEXT);
  doc.text(sale?.customer_name || '—', margin, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...SUBTLE);
  if (sale?.customer_phone) {
    doc.text(sale.customer_phone, margin, y);
    y += 4.5;
  }
  if (sale?.car_model || sale?.car_plate) {
    doc.text(`Vehicle: ${[sale.car_model, sale.car_plate].filter(Boolean).join(' · ')}`, margin, y);
    y += 4.5;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);
  doc.text(`Date: ${formatDateTime(refunds[0]?.refunded_at)}`, pageW - margin, y - 12, { align: 'right' });
  doc.text(`Payment: ${capitalize((sale?.payment_method || '').replace('_', ' '))}`, pageW - margin, y - 6, { align: 'right' });

  y += 8;

  // Items table
  const tableLeft = margin;
  const colDescW = innerW * 0.55;
  const colQtyW = innerW * 0.12;
  const colAmtW = innerW * 0.25;
  const colDescRight = tableLeft + colDescW;
  const colQtyX = colDescRight + 4;
  const colAmtX = pageW - margin - colAmtW;

  doc.setDrawColor(...RED);
  doc.setLineWidth(0.4);
  doc.line(tableLeft, y, pageW - margin, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...RED);
  doc.text('Description', tableLeft, y - 2);
  doc.text('Qty', colQtyX, y - 2, { align: 'center' });
  doc.text('Amount', colAmtX + colAmtW, y - 2, { align: 'right' });
  y += 2;

  doc.setDrawColor(200, 200, 200);
  doc.line(tableLeft, y, pageW - margin, y);
  y += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);

  if (allItems.length === 0) {
    doc.text('No items', tableLeft, y);
    y += 5;
  } else {
    for (const it of allItems) {
      const name = it.service_name || '—';
      const displayName = name.length > 40 ? name.slice(0, 38) + '..' : name;
      doc.text(displayName, tableLeft, y);
      doc.text(String(it.quantity), colQtyX, y, { align: 'center' });
      doc.text(formatCurrency(it.line_total), colAmtX + colAmtW, y, { align: 'right' });
      y += 5;
      if (y > pageH - 30) {
        doc.addPage();
        y = margin;
      }
    }
  }

  y += 4;
  doc.setDrawColor(...RED);
  doc.setLineWidth(0.4);
  doc.line(tableLeft, y, pageW - margin, y);
  y += 6;

  // Total
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...RED);
  doc.text('Total Refunded', tableLeft, y);
  doc.text(formatCurrency(totalRefunded), pageW - margin, y, { align: 'right' });
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...SUBTLE);
  doc.text(`Original Total: ${formatCurrency(sale?.total_amount || 0)}`, tableLeft, y);
  y += 8;

  // Reason
  doc.setDrawColor(200, 200, 200);
  doc.line(tableLeft, y, pageW - margin, y);
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);
  doc.text(`Reason: ${refunds[0]?.refund_reason || '—'}`, tableLeft, y);
  y += 4.5;
  doc.text(`Processed By: ${refunds[0]?.profiles?.full_name || '—'}`, tableLeft, y);
  y += 8;

  if (refunds.length > 1) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...SUBTLE);
    doc.text(`This bill has ${refunds.length} refund transaction(s)`, tableLeft, y);
    y += 4;
  }

  // Footer
  const footerY = pageH - 12;
  doc.setDrawColor(...RED);
  doc.setLineWidth(0.4);
  doc.line(margin, footerY - 2, pageW - margin, footerY - 2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...SUBTLE);
  doc.text(`Thank you for choosing ${companyInfo.name}`, pageW / 2, footerY + 2, { align: 'center' });
  if (companyInfo.whatsapp) {
    doc.text(`WhatsApp: ${companyInfo.whatsapp}`, pageW / 2, footerY + 6, { align: 'center' });
  }

  return doc;
}

async function renderRefundThermalPdf(sale, refunds, totalRefunded, allItems) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [80, 200] });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 4;
  const yStart = 4;

  const logo = await loadLogoDataUrl();
  let y = yStart + 4;

  if (logo) {
    doc.addImage(logo, 'PNG', pageW / 2 - 12, y, 24, 24);
    y += 26;
  }

  doc.setFont('courier', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text(companyInfo.name || 'Arizona Car World', pageW / 2, y, { align: 'center' });
  y += 4;

  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  if (companyInfo.address) {
    doc.text(companyInfo.address, pageW / 2, y, { align: 'center' });
    y += 3;
  }
  if (companyInfo.phone) {
    doc.text(`Tel: ${companyInfo.phone}`, pageW / 2, y, { align: 'center' });
    y += 3;
  }
  if (companyInfo.whatsapp) {
    doc.text(`WhatsApp: ${companyInfo.whatsapp}`, pageW / 2, y, { align: 'center' });
    y += 3;
  }
  y += 3;

  // Dashed line
  doc.setDrawColor(0);
  for (let x = margin; x < pageW - margin; x += 3) {
    doc.line(x, y, Math.min(x + 1.5, pageW - margin), y);
  }
  y += 5;

  doc.setFont('courier', 'bold');
  doc.setFontSize(9);
  doc.text('REFUND SLIP', pageW / 2, y, { align: 'center' });
  y += 2;

  for (let x = margin; x < pageW - margin; x += 3) {
    doc.line(x, y, Math.min(x + 1.5, pageW - margin), y);
  }
  y += 5;

  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.text(`Invoice # ${sale?.invoice_number || '—'}`, margin, y);
  y += 4;
  doc.text(`Date: ${formatDateTime(refunds[0]?.refunded_at)}`, margin, y);
  y += 4;
  doc.text(`Customer: ${sale?.customer_name || '—'}`, margin, y);
  y += 4;
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  if (sale?.customer_phone) {
    doc.text(`Phone: ${sale.customer_phone}`, margin, y);
    y += 3;
  }
  if (sale?.car_model) {
    doc.text(`Vehicle: ${sale.car_model}`, margin, y);
    y += 3;
  }
  if (sale?.car_plate) {
    doc.text(`Plate: ${sale.car_plate}`, margin, y);
    y += 3;
  }
  y += 2;

  for (let x = margin; x < pageW - margin; x += 3) {
    doc.line(x, y, Math.min(x + 1.5, pageW - margin), y);
  }
  y += 5;

  // Items table header
  doc.setFont('courier', 'bold');
  doc.setFontSize(7);
  const col1X = margin;
  const col2X = pageW * 0.65;
  const col3X = pageW - margin;
  doc.text('Service / Item', col1X, y);
  doc.text('Qty', col2X + (pageW * 0.12 - 4) / 2, y, { align: 'center' });
  doc.text('Amt', col3X, y, { align: 'right' });
  y += 3;

  doc.setDrawColor(0);
  doc.line(col1X, y, col3X, y);
  y += 3;

  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  if (allItems.length === 0) {
    doc.text('No items', col1X, y);
    y += 4;
  } else {
    for (const it of allItems) {
      const name = it.service_name || '—';
      const displayName = name.length > 28 ? name.slice(0, 26) + '..' : name;
      doc.text(displayName, col1X, y);
      doc.text(String(it.quantity), col2X + (pageW * 0.12 - 4) / 2, y, { align: 'center' });
      doc.text(formatCurrency(it.line_total), col3X, y, { align: 'right' });
      y += 4;
      if (y > 185) break;
    }
  }
  y += 2;

  for (let x = margin; x < pageW - margin; x += 3) {
    doc.line(x, y, Math.min(x + 1.5, pageW - margin), y);
  }
  y += 5;

  doc.setFont('courier', 'bold');
  doc.setFontSize(9);
  doc.text('Total Refunded', col1X, y);
  doc.text(formatCurrency(totalRefunded), col3X, y, { align: 'right' });
  y += 5;

  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.text(`Original Total: ${formatCurrency(sale?.total_amount || 0)}`, col1X, y);
  y += 3;
  doc.text(`Payment: ${capitalize((sale?.payment_method || '').replace('_', ' '))}`, col1X, y);
  y += 5;

  for (let x = margin; x < pageW - margin; x += 3) {
    doc.line(x, y, Math.min(x + 1.5, pageW - margin), y);
  }
  y += 4;

  doc.setFont('courier', 'bold');
  doc.setFontSize(7);
  doc.text(`Reason: ${refunds[0]?.refund_reason || '—'}`, col1X, y);
  y += 3;
  doc.text(`Processed By: ${refunds[0]?.profiles?.full_name || '—'}`, col1X, y);
  y += 3;
  if (refunds.length > 1) {
    doc.text(`(${refunds.length} refund transactions)`, col1X, y);
    y += 3;
  }
  y += 3;

  for (let x = margin; x < pageW - margin; x += 3) {
    doc.line(x, y, Math.min(x + 1.5, pageW - margin), y);
  }
  y += 5;

  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.text(`Thank you for choosing ${companyInfo.name}`, pageW / 2, y, { align: 'center' });
  y += 3;
  if (companyInfo.whatsapp) {
    doc.text(`WhatsApp: ${companyInfo.whatsapp}`, pageW / 2, y, { align: 'center' });
  }

  return doc;
}

export async function downloadRefundPdf(sale, refunds, totalRefunded, allItems, { format = 'a4' } = {}) {
  const doc = format === 'thermal'
    ? await renderRefundThermalPdf(sale, refunds, totalRefunded, allItems)
    : await renderRefundA4Pdf(sale, refunds, totalRefunded, allItems);
  const prefix = format === 'thermal' ? 'thermal' : 'A4';
  doc.save(`refund-${sale?.invoice_number || 'slip'}-${prefix}.pdf`);
}

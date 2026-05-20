import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { formatCurrency, formatDate } from '@/lib/format';

export function exportTableToPdf({ title, subtitle, columns, rows, filename }) {
  const doc = new jsPDF({ orientation: rows.length > 20 ? 'landscape' : 'portrait' });
  doc.setFontSize(16);
  doc.text(title, 14, 18);
  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(subtitle, 14, 26);
    doc.setTextColor(0);
  }
  autoTable(doc, {
    startY: subtitle ? 32 : 24,
    head: [columns.map((c) => c.header)],
    body: rows.map((row) => columns.map((c) => String(c.accessor(row) ?? ''))),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [201, 162, 39] },
  });
  doc.save(filename || `${title.replace(/\s+/g, '_')}.pdf`);
}

export function exportTableToExcel({ sheetName, columns, rows, filename }) {
  const data = rows.map((row) => {
    const obj = {};
    columns.forEach((col) => {
      obj[col.header] = col.accessor(row);
    });
    return obj;
  });
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Report');
  XLSX.writeFile(wb, filename || 'report.xlsx');
}

export function buildSalesExportRows(sales) {
  return sales.map((s) => ({
    invoice: s.invoice_number,
    date: formatDate(s.sale_date || s.created_at),
    customer: s.customer_name,
    car: [s.car_model, s.car_plate].filter(Boolean).join(' · '),
    payment: s.payment_method,
    total: formatCurrency(s.total_amount),
    employee: s.profiles?.full_name || '—',
  }));
}

export const SALES_EXPORT_COLUMNS = [
  { header: 'Invoice', accessor: (r) => r.invoice },
  { header: 'Date', accessor: (r) => r.date },
  { header: 'Customer', accessor: (r) => r.customer },
  { header: 'Vehicle', accessor: (r) => r.car },
  { header: 'Payment', accessor: (r) => r.payment },
  { header: 'Total', accessor: (r) => r.total },
  { header: 'Employee', accessor: (r) => r.employee },
];

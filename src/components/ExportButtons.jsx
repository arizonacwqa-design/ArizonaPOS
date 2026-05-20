import { FileDown, FileSpreadsheet } from 'lucide-react';
import { exportTableToPdf, exportTableToExcel } from '@/lib/export';

export default function ExportButtons({
  title,
  subtitle,
  columns,
  rows,
  filenameBase = 'report',
  disabled = false,
}) {
  if (!rows?.length) {
    return (
      <p className="text-luxury-muted text-sm">No data to export for this period.</p>
    );
  }

  const base = `${filenameBase}_${new Date().toISOString().slice(0, 10)}`;

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() =>
          exportTableToPdf({
            title,
            subtitle,
            columns,
            rows,
            filename: `${base}.pdf`,
          })
        }
        className="btn-outline flex items-center gap-2 text-sm py-2"
      >
        <FileDown size={16} />
        Export PDF
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() =>
          exportTableToExcel({
            sheetName: title.slice(0, 31),
            columns,
            rows,
            filename: `${base}.xlsx`,
          })
        }
        className="btn-outline flex items-center gap-2 text-sm py-2"
      >
        <FileSpreadsheet size={16} />
        Export Excel
      </button>
    </div>
  );
}

export default function LuxuryTable({ columns, rows, emptyMessage = 'No data', rowKey = (r, i) => r.id ?? i }) {
  if (!rows?.length) {
    return <p className="text-luxury-muted text-sm py-8 text-center">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-luxury-border">
      <table className="table-luxury w-full text-sm">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`${col.align === 'right' ? 'text-right' : 'text-left'} ${col.className || ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={rowKey(row, i)} className="transition-colors hover:bg-gold-600/5">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`${col.align === 'right' ? 'text-right' : ''} ${col.cellClassName || ''}`}
                >
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

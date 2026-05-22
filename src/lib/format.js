export function formatCurrency(amount) {
  const locale = import.meta.env.VITE_LOCALE || 'en-QA';
  const currency = locale === 'en-QA' ? 'QAR' : locale === 'en-AE' ? 'AED' : 'QAR';
  
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
  }).format(Number(amount) || 0);
}

export function formatStock(item) {
  if (!item) return '—';
  const stock = Number(item.current_stock) || 0;
  if (item.stock_type === 'meter') {
    return `${stock.toFixed(1)}m`;
  }
  return `${Math.floor(stock)} ${item.unit_label || 'pcs'}`;
}

export function isLowStock(item) {
  if (!item) return false;
  const stock = Number(item.current_stock) || 0;
  const threshold = Number(item.low_stock_threshold ?? 0);
  return stock <= threshold;
}

export function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date) {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

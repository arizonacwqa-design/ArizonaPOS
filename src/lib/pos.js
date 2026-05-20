/** Build cart line from a service */
export function cartLineFromService(service, quantity = 1) {
  const qty = Math.max(1, Number(quantity) || 1);
  const unitPrice = Number(service.price) || 0;
  const inv = service.inventory_item;
  const consumption = Number(service.consumption_per_unit) || 0;
  const inventoryDeducted =
    service.inventory_item_id && consumption > 0 ? consumption * qty : 0;

  return {
    lineType: 'service',
    service_id: service.id,
    service_name: service.name,
    category: service.category,
    unit_price: unitPrice,
    quantity: qty,
    line_total: unitPrice * qty,
    inventory_item_id: service.inventory_item_id || null,
    inventory_name: inv?.name || null,
    stock_type: inv?.stock_type || null,
    current_stock: inv?.current_stock != null ? Number(inv.current_stock) : null,
    consumption_per_unit: consumption,
    inventory_deducted: inventoryDeducted,
  };
}

/** Build cart line from direct inventory usage (materials) */
export function cartLineFromInventory(item, amount) {
  const qty = Math.max(0.1, Number(amount) || 0);
  return {
    lineType: 'material',
    service_id: null,
    service_name: item.name,
    category: item.category,
    unit_price: 0,
    quantity: qty,
    line_total: 0,
    inventory_item_id: item.id,
    inventory_name: item.name,
    stock_type: item.stock_type,
    current_stock: Number(item.current_stock) || 0,
    consumption_per_unit: qty,
    inventory_deducted: qty,
  };
}

export function updateCartLineQuantity(line, quantity) {
  const qty = Math.max(line.lineType === 'material' ? 0.1 : 1, Number(quantity) || 1);
  const consumption = Number(line.consumption_per_unit) || 0;
  const inventoryDeducted =
    line.inventory_item_id && line.lineType === 'service' && consumption > 0
      ? consumption * qty
      : line.lineType === 'material'
        ? qty
        : line.inventory_deducted;

  return {
    ...line,
    quantity: qty,
    line_total: line.unit_price * qty,
    inventory_deducted: inventoryDeducted,
  };
}

/** Aggregate inventory deductions by item id */
export function aggregateInventoryUsage(cart) {
  const map = new Map();
  for (const line of cart) {
    if (!line.inventory_item_id || !line.inventory_deducted) continue;
    const key = line.inventory_item_id;
    const prev = map.get(key) || {
      id: key,
      name: line.inventory_name,
      stock_type: line.stock_type,
      total: 0,
    };
    prev.total += Number(line.inventory_deducted) || 0;
    map.set(key, prev);
  }
  return [...map.values()];
}

export function validateCartStock(cart) {
  const needed = aggregateInventoryUsage(cart);
  const errors = [];

  for (const row of needed) {
    const lines = cart.filter((l) => l.inventory_item_id === row.id);
    const available = lines[0]?.current_stock;
    if (available != null && row.total > available) {
      const unit = row.stock_type === 'meter' ? 'm' : 'pcs';
      errors.push(
        `${row.name}: need ${row.total}${unit}, only ${available}${unit} in stock`
      );
    }
  }

  return errors;
}

export function cartLineKey(line) {
  return line.lineType === 'service'
    ? `svc-${line.service_id}`
    : `mat-${line.inventory_item_id}`;
}

/** Subtotal → discount → tax → grand total. Caps discount at subtotal and reports the cap. */
export function calcBillingTotals(subtotal, discount, taxRate, taxEnabled) {
  const base = Math.max(0, Number(subtotal) || 0);
  const rawDiscount = Math.max(0, Number(discount) || 0);
  const disc = Math.min(rawDiscount, base);
  const discountCapped = rawDiscount > base && base > 0;
  const afterDiscount = Math.max(0, base - disc);
  const rate = taxEnabled ? Math.max(0, Math.min(100, Number(taxRate) || 0)) : 0;
  const taxAmount = Math.round(afterDiscount * (rate / 100) * 100) / 100;
  const total = Math.round((afterDiscount + taxAmount) * 100) / 100;
  return {
    subtotal: base,
    discount: disc,
    rawDiscount,
    discountCapped,
    taxRate: rate,
    taxAmount,
    total,
  };
}

export function groupInventoryByType(items) {
  const meter = [];
  const quantity = [];
  for (const item of items || []) {
    if (item.stock_type === 'meter') meter.push(item);
    else quantity.push(item);
  }
  return { meter, quantity };
}

export function saleItemsPayload(cart, saleId) {
  return cart.map((item) => ({
    sale_id: saleId,
    service_id: item.service_id,
    service_name: item.service_name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    line_total: item.line_total,
    inventory_item_id: item.inventory_item_id || null,
    inventory_deducted:
      item.inventory_item_id && item.inventory_deducted > 0
        ? item.inventory_deducted
        : 0,
  }));
}

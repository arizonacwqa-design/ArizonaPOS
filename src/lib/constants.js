/** Inventory categories by stock type */
export const METER_CATEGORIES = ['PPF', 'Tint'];

export const QUANTITY_CATEGORIES = [
  'Shampoo',
  'Polish',
  'Detergents',
  'Bottles',
  'Lighters',
  'Chemicals',
  'Supplies',
  'Other',
];

export const ALL_CATEGORIES = [...METER_CATEGORIES, ...QUANTITY_CATEGORIES];

export const SERVICE_CATEGORIES = [
  'PPF',
  'Tint',
  'Coating',
  'Detailing',
  'Polish',
  'Other',
];

/** Quick filters on POS — maps to service.category */
export const POS_SERVICE_GROUPS = [
  { id: 'all', label: 'All Services' },
  { id: 'PPF', label: 'PPF' },
  { id: 'Tint', label: 'Window Tint' },
  { id: 'Coating', label: 'Ceramic Coating' },
  { id: 'Detailing', label: 'Detailing' },
  { id: 'Polish', label: 'Polish' },
];

export const DEFAULT_TAX_RATE = Number(import.meta.env.VITE_DEFAULT_TAX_RATE) || 0;

/** Scanner buffer timeout in ms */
export const SCAN_TIMEOUT = 100;

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'other', label: 'Other' },
];

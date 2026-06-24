import { supabase } from '@/lib/supabase';

export async function getProductByBarcode(barcode) {
  if (!barcode || typeof barcode !== 'string' || !barcode.trim()) return null;

  const { data, error } = await supabase
    .from('inventory_items')
    .select('id, name, category, stock_type, current_stock, unit_label, barcode, selling_price')
    .eq('barcode', barcode.trim())
    .maybeSingle();

  if (error) {
    console.error('getProductByBarcode error:', error.message);
    return null;
  }

  return data;
}

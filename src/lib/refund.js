import { supabase } from '@/lib/supabase';

export async function processRefund(saleId, reason, userId, items = null) {
  if (items) {
    const { data, error } = await supabase.rpc('process_partial_refund', {
      p_sale_id: saleId,
      p_reason: reason,
      p_refunded_by: userId,
      p_items: JSON.stringify(items),
    });
    if (error) throw error;
    return data;
  }
  // Full refund via partial RPC with all items
  const { data: saleItems, error: fetchError } = await supabase
    .from('sale_items')
    .select('id, service_name, quantity, line_total, inventory_deducted')
    .eq('sale_id', saleId);
  if (fetchError) throw fetchError;
  if (!saleItems || saleItems.length === 0) {
    throw new Error('No items found for this sale');
  }
  const allItems = saleItems.map((it) => ({
    sale_item_id: it.id,
    service_name: it.service_name,
    quantity: it.quantity,
    line_total: it.line_total,
    inventory_deducted: it.inventory_deducted || 0,
  }));
  return processRefund(saleId, reason, userId, allItems);
}

export async function getRefundLog(limit = 50) {
  const { data, error } = await supabase
    .from('refund_log')
    .select('*, items_refunded, sales!inner(invoice_number, customer_name, total_amount, refunded_amount), profiles!inner(full_name)')
    .order('refunded_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

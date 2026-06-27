import { supabase } from '@/lib/supabase';

export async function processRefund(saleId, reason, userId) {
  const { data, error } = await supabase.rpc('process_refund', {
    p_sale_id: saleId,
    p_reason: reason,
    p_refunded_by: userId,
  });
  if (error) throw error;
  return data;
}

export async function getRefundLog(limit = 50) {
  const { data, error } = await supabase
    .from('refund_log')
    .select('*, sales!inner(invoice_number, customer_name, total_amount), profiles!inner(full_name)')
    .order('refunded_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

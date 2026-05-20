import { supabase } from '@/lib/supabase';

/** Upsert customer after a sale and return customer id. */
export async function upsertCustomerFromSale({ customer_name, customer_phone, total_amount }) {
  const name = customer_name?.trim();
  if (!name) return null;

  const phone = customer_phone?.trim() || null;

  if (phone) {
    const { data: existing } = await supabase
      .from('customers')
      .select('id, total_spent, visit_count')
      .eq('phone', phone)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('customers')
        .update({
          full_name: name,
          total_spent: Number(existing.total_spent) + Number(total_amount),
          visit_count: (existing.visit_count || 0) + 1,
          last_visit_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      return existing.id;
    }
  }

  const { data: created, error } = await supabase
    .from('customers')
    .insert({
      full_name: name,
      phone,
      total_spent: Number(total_amount) || 0,
      visit_count: 1,
      last_visit_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.warn('Customer upsert skipped:', error.message);
    return null;
  }
  return created?.id ?? null;
}

/**
 * PostgREST .or() uses commas and parens as separators. Strip them from user
 * input so a name like "Khan, Ali)" can't break the filter. Also escape ilike
 * wildcards so '%' / '_' in the query match literally.
 */
function sanitizeOrIlike(s) {
  return s
    .replace(/[,()]/g, ' ')
    .replace(/[\\%_]/g, (m) => `\\${m}`)
    .replace(/\s+/g, ' ')
    .trim();
}

export async function searchCustomers(query, limit = 8) {
  const q = query?.trim();
  if (!q || q.length < 2) return [];

  const safe = sanitizeOrIlike(q);
  if (!safe) return [];

  const { data } = await supabase
    .from('customers')
    .select('id, full_name, phone, total_spent, visit_count')
    .or(`full_name.ilike.%${safe}%,phone.ilike.%${safe}%`)
    .order('last_visit_at', { ascending: false })
    .limit(limit);

  return data || [];
}

export async function getCustomerHistory(phoneOrId) {
  let customer = null;

  if (String(phoneOrId).includes('-')) {
    const { data } = await supabase.from('customers').select('*').eq('id', phoneOrId).maybeSingle();
    customer = data;
  } else if (phoneOrId) {
    const { data } = await supabase.from('customers').select('*').eq('phone', phoneOrId).maybeSingle();
    customer = data;
  }

  let salesQuery = supabase
    .from('sales')
    .select('*, sale_items(service_name, quantity, line_total)')
    .order('created_at', { ascending: false })
    .limit(50);

  if (customer?.id) {
    salesQuery.eq('customer_id', customer.id);
  } else if (customer?.phone) {
    salesQuery.eq('customer_phone', customer.phone);
  } else if (phoneOrId) {
    salesQuery.eq('customer_phone', phoneOrId);
  } else {
    return { customer: null, sales: [] };
  }

  const { data: sales } = await salesQuery;
  return { customer, sales: sales || [] };
}

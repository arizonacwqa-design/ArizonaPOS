-- Multi-item bill-based expense entry system
-- Adds invoice_number + supplier_name to operating_expenses
-- Creates expense_items table for line items

ALTER TABLE operating_expenses ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE operating_expenses ADD COLUMN IF NOT EXISTS supplier_name TEXT;

CREATE TABLE IF NOT EXISTS expense_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id UUID REFERENCES operating_expenses(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC DEFAULT 1,
  unit_cost NUMERIC NOT NULL,
  total_cost NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE expense_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expense_items_select" ON expense_items;
CREATE POLICY "expense_items_select"
  ON expense_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "expense_items_insert" ON expense_items;
CREATE POLICY "expense_items_insert"
  ON expense_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "expense_items_delete" ON expense_items;
CREATE POLICY "expense_items_delete"
  ON expense_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

GRANT SELECT, INSERT, DELETE ON expense_items TO authenticated;

-- ============================================================
-- Migration 009: Enforce unique bill_number at DB level
-- Replaces client-side uniqueness validation with a DB constraint
-- ============================================================

-- Partial unique index: only non-null bill_numbers must be unique
-- This allows multiple purchases with NULL bill_number (blank/unknown)
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_purchases_bill_number_unique
  ON public.inventory_purchases (bill_number)
  WHERE bill_number IS NOT NULL;

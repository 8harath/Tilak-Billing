-- Phase update script: atomic transaction creation + sequential receipt numbers
-- Run this on existing environments after scripts/01-init-schema.sql

CREATE TABLE IF NOT EXISTS receipt_sequences (
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  fiscal_year INTEGER NOT NULL,
  last_value INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (school_id, fiscal_year)
);

ALTER TABLE receipt_sequences ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION next_receipt_number(
  p_school_id UUID,
  p_payment_date DATE DEFAULT CURRENT_DATE
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INTEGER := EXTRACT(YEAR FROM COALESCE(p_payment_date, CURRENT_DATE))::INTEGER;
  v_next_value INTEGER;
  v_school_token TEXT := UPPER(SUBSTRING(REPLACE(p_school_id::TEXT, '-', '') FROM 1 FOR 6));
BEGIN
  INSERT INTO receipt_sequences (school_id, fiscal_year, last_value, updated_at)
  VALUES (p_school_id, v_year, 1, now())
  ON CONFLICT (school_id, fiscal_year)
  DO UPDATE SET
    last_value = receipt_sequences.last_value + 1,
    updated_at = now()
  RETURNING last_value INTO v_next_value;

  RETURN FORMAT('RCP-%s-%s-%s', v_year, v_school_token, LPAD(v_next_value::TEXT, 6, '0'));
END;
$$;

CREATE OR REPLACE FUNCTION create_fee_transaction(
  p_student_id UUID,
  p_payment_date DATE,
  p_notes TEXT DEFAULT NULL,
  p_items JSONB DEFAULT '[]'::JSONB
)
RETURNS TABLE(id UUID, receipt_number TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_school_id UUID;
  v_role TEXT;
  v_is_active BOOLEAN;
  v_receipt_number TEXT;
  v_total_amount NUMERIC(12, 2);
  v_fee_type_summary TEXT;
  v_item_count INTEGER;
  v_inserted_item_count INTEGER;
  v_transaction_id UUID;
  v_student_exists BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT school_id, role, is_active
  INTO v_school_id, v_role, v_is_active
  FROM users
  WHERE id = v_user_id;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  IF NOT v_is_active THEN
    RAISE EXCEPTION 'User account is inactive';
  END IF;

  IF v_role NOT IN ('admin', 'accountant', 'fee_operator') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF p_payment_date IS NULL THEN
    RAISE EXCEPTION 'payment_date is required';
  END IF;

  IF JSONB_TYPEOF(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'items must be an array';
  END IF;

  v_item_count := JSONB_ARRAY_LENGTH(p_items);
  IF v_item_count < 1 THEN
    RAISE EXCEPTION 'At least one fee item is required';
  END IF;

  SELECT EXISTS(
    SELECT 1
    FROM students
    WHERE id = p_student_id
      AND school_id = v_school_id
      AND status = 'active'
  )
  INTO v_student_exists;

  IF NOT v_student_exists THEN
    RAISE EXCEPTION 'Student not found in this school';
  END IF;

  SELECT COALESCE(SUM((item->>'amount')::NUMERIC), 0)
  INTO v_total_amount
  FROM JSONB_ARRAY_ELEMENTS(p_items) item;

  IF v_total_amount <= 0 THEN
    RAISE EXCEPTION 'Total amount must be greater than zero';
  END IF;

  v_fee_type_summary := CASE
    WHEN v_item_count = 1 THEN COALESCE(NULLIF(TRIM(p_items->0->>'description'), ''), 'Fee')
    ELSE v_item_count::TEXT || ' fee items'
  END;

  v_receipt_number := next_receipt_number(v_school_id, p_payment_date);

  INSERT INTO transactions (
    school_id,
    student_id,
    amount_paid,
    fee_type,
    payment_date,
    receipt_number,
    notes,
    created_by
  )
  VALUES (
    v_school_id,
    p_student_id,
    v_total_amount,
    v_fee_type_summary,
    p_payment_date,
    v_receipt_number,
    COALESCE(p_notes, ''),
    v_user_id
  )
  RETURNING transactions.id INTO v_transaction_id;

  INSERT INTO transaction_items (
    transaction_id,
    fee_structure_id,
    description,
    amount
  )
  SELECT
    v_transaction_id,
    NULLIF(item->>'feeStructureId', '')::UUID,
    TRIM(COALESCE(item->>'description', '')),
    (item->>'amount')::NUMERIC
  FROM JSONB_ARRAY_ELEMENTS(p_items) item
  WHERE TRIM(COALESCE(item->>'description', '')) <> ''
    AND (item->>'amount') IS NOT NULL
    AND (item->>'amount')::NUMERIC > 0;

  GET DIAGNOSTICS v_inserted_item_count = ROW_COUNT;
  IF v_inserted_item_count <> v_item_count THEN
    RAISE EXCEPTION 'One or more fee items are invalid';
  END IF;

  RETURN QUERY SELECT v_transaction_id, v_receipt_number;
END;
$$;

REVOKE ALL ON FUNCTION next_receipt_number(UUID, DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION create_fee_transaction(UUID, DATE, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_fee_transaction(UUID, DATE, TEXT, JSONB) TO authenticated;

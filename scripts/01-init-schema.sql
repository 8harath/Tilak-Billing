-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create schools table
CREATE TABLE schools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create students table
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  roll_number TEXT NOT NULL,
  name TEXT NOT NULL,
  class TEXT,
  section TEXT,
  parent_email TEXT,
  parent_phone TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(school_id, roll_number)
);

-- Create fee_structures table
CREATE TABLE fee_structures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year TEXT NOT NULL,
  class TEXT,
  name TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  due_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(school_id, academic_year, class, name)
);

-- Create users table (extends auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'fee_operator' CHECK (role IN ('admin', 'fee_operator', 'accountant')),
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create receipt sequence tracking table (per school per year)
CREATE TABLE receipt_sequences (
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  fiscal_year INTEGER NOT NULL,
  last_value INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (school_id, fiscal_year)
);

-- Create transactions table
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  amount_paid NUMERIC(12, 2) NOT NULL,
  fee_type TEXT,
  payment_date DATE NOT NULL,
  receipt_number TEXT NOT NULL UNIQUE,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create transaction_items table
CREATE TABLE transaction_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  fee_structure_id UUID REFERENCES fee_structures(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_students_school_id ON students(school_id);
CREATE INDEX idx_students_school_roll ON students(school_id, roll_number);
CREATE INDEX idx_fee_structures_school_id ON fee_structures(school_id);
CREATE INDEX idx_fee_structures_school_year_class ON fee_structures(school_id, academic_year, class);
CREATE INDEX idx_transactions_school_id ON transactions(school_id);
CREATE INDEX idx_transactions_school_created ON transactions(school_id, created_at DESC);
CREATE INDEX idx_transactions_receipt_number ON transactions(receipt_number);
CREATE INDEX idx_transaction_items_transaction_id ON transaction_items(transaction_id);
CREATE INDEX idx_users_school_id ON users(school_id);
CREATE INDEX idx_users_school_role ON users(school_id, role);

-- Enable Row Level Security
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_sequences ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for students
CREATE POLICY "students_select_own_school" ON students
  FOR SELECT USING (school_id IN (
    SELECT school_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "students_insert_own_school" ON students
  FOR INSERT WITH CHECK (school_id IN (
    SELECT school_id FROM users WHERE id = auth.uid()
  ));

-- Create RLS policies for fee_structures
CREATE POLICY "fee_structures_select_own_school" ON fee_structures
  FOR SELECT USING (school_id IN (
    SELECT school_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "fee_structures_insert_admin" ON fee_structures
  FOR INSERT WITH CHECK (school_id IN (
    SELECT school_id FROM users WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "fee_structures_update_admin" ON fee_structures
  FOR UPDATE USING (school_id IN (
    SELECT school_id FROM users WHERE id = auth.uid() AND role = 'admin'
  ));

-- Create RLS policies for transactions
CREATE POLICY "transactions_insert_own_school" ON transactions
  FOR INSERT WITH CHECK (school_id IN (
    SELECT school_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "transactions_select_own_school" ON transactions
  FOR SELECT USING (school_id IN (
    SELECT school_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "transactions_delete_admin" ON transactions
  FOR DELETE USING (school_id IN (
    SELECT school_id FROM users WHERE id = auth.uid() AND role = 'admin'
  ));

-- Create RLS policies for transaction_items
CREATE POLICY "transaction_items_select" ON transaction_items
  FOR SELECT USING (transaction_id IN (
    SELECT id FROM transactions WHERE school_id IN (
      SELECT school_id FROM users WHERE id = auth.uid()
    )
  ));

CREATE POLICY "transaction_items_insert" ON transaction_items
  FOR INSERT WITH CHECK (transaction_id IN (
    SELECT id FROM transactions WHERE school_id IN (
      SELECT school_id FROM users WHERE id = auth.uid()
    )
  ));

-- Create RLS policies for users
-- App APIs need every authenticated user to read their own profile row.
CREATE POLICY "users_select_self" ON users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "users_update_self" ON users
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Create RLS policies for schools (users can read their own school)
CREATE POLICY "schools_select_own" ON schools
  FOR SELECT USING (id IN (
    SELECT school_id FROM users WHERE id = auth.uid()
  ));

-- Generate next sequential receipt number per school per year
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

-- Create transaction + line-items atomically with sequential receipt numbering
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

-- Insert demo data for testing
-- School
INSERT INTO schools (name, email, phone, address) 
VALUES ('Tilak School', 'admin@tilak.edu', '+91-9876543210', 'Mumbai, India')
ON CONFLICT (name) DO NOTHING;

-- Get school_id for reference
-- Note: In actual implementation, this would be parameterized

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_schools_updated_at BEFORE UPDATE ON schools
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fee_structures_updated_at BEFORE UPDATE ON fee_structures
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

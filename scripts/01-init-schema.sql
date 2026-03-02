-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create schools table
CREATE TABLE schools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
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
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
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

-- Create RLS policies for users (admin only)
CREATE POLICY "users_select_own_school" ON users
  FOR SELECT USING (school_id IN (
    SELECT school_id FROM users WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "users_insert_admin" ON users
  FOR INSERT WITH CHECK (school_id IN (
    SELECT school_id FROM users WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "users_update_admin" ON users
  FOR UPDATE USING (school_id IN (
    SELECT school_id FROM users WHERE id = auth.uid() AND role = 'admin'
  ));

-- Create RLS policies for schools (users can read their own school)
CREATE POLICY "schools_select_own" ON schools
  FOR SELECT USING (id IN (
    SELECT school_id FROM users WHERE id = auth.uid()
  ));

-- Insert demo data for testing
-- School
INSERT INTO schools (name, email, phone, address) 
VALUES ('Tilak School', 'admin@tilak.edu', '+91-9876543210', 'Mumbai, India')
ON CONFLICT DO NOTHING;

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

-- First, insert a demo school with actual Tilak School details
INSERT INTO schools (name, email, phone, address) 
VALUES (
  'Tilak School',
  'info@tilakschools.com',
  '+91 98458 03977',
  '1st Main 10th Cross, Mangammanapalya, Bengaluru - 560068 | Head Office: Swagath Main Road Tilaknagar, Jayanagar, Bengaluru - 560041'
)
ON CONFLICT DO NOTHING;

-- Get the school ID for subsequent inserts and insert demo students
WITH school AS (
  SELECT id FROM schools WHERE name = 'Tilak School' LIMIT 1
)
INSERT INTO students (school_id, roll_number, name, class, section, parent_email, parent_phone, status)
SELECT 
  school.id,
  '101',
  'Aarav Kumar',
  '10',
  'A',
  'parent1@example.com',
  '+91-9876543211',
  'active'
FROM school
ON CONFLICT DO NOTHING;

WITH school AS (
  SELECT id FROM schools WHERE name = 'Tilak School' LIMIT 1
)
INSERT INTO students (school_id, roll_number, name, class, section, parent_email, parent_phone, status)
SELECT 
  school.id,
  '102',
  'Bhavna Singh',
  '10',
  'A',
  'parent2@example.com',
  '+91-9876543212',
  'active'
FROM school
ON CONFLICT DO NOTHING;

WITH school AS (
  SELECT id FROM schools WHERE name = 'Tilak School' LIMIT 1
)
INSERT INTO students (school_id, roll_number, name, class, section, parent_email, parent_phone, status)
SELECT 
  school.id,
  '103',
  'Chirag Patel',
  '9',
  'B',
  'parent3@example.com',
  '+91-9876543213',
  'active'
FROM school
ON CONFLICT DO NOTHING;

-- Insert demo fee structures
WITH school AS (
  SELECT id FROM schools WHERE name = 'Tilak School' LIMIT 1
)
INSERT INTO fee_structures (school_id, academic_year, class, name, amount, due_date)
SELECT 
  school.id,
  '2024-2025',
  '10',
  'Quarterly Fee',
  50000.00,
  '2024-04-30'
FROM school
ON CONFLICT DO NOTHING;

WITH school AS (
  SELECT id FROM schools WHERE name = 'Tilak School' LIMIT 1
)
INSERT INTO fee_structures (school_id, academic_year, class, name, amount, due_date)
SELECT 
  school.id,
  '2024-2025',
  '10',
  'Annual Fee',
  150000.00,
  '2024-06-30'
FROM school
ON CONFLICT DO NOTHING;

WITH school AS (
  SELECT id FROM schools WHERE name = 'Tilak School' LIMIT 1
)
INSERT INTO fee_structures (school_id, academic_year, class, name, amount, due_date)
SELECT 
  school.id,
  '2024-2025',
  '9',
  'Quarterly Fee',
  45000.00,
  '2024-04-30'
FROM school
ON CONFLICT DO NOTHING;

-- =====================================================
-- SEED DATA AFTER CREATING SALON VIA API
-- =====================================================
-- Run this AFTER creating a salon through the API
-- Replace SALON_ID_HERE with your actual salon_id

USE salon_platform;

-- Get your salon_id (run this first to find it):
-- SELECT salon_id FROM salons ORDER BY salon_id DESC LIMIT 1;

-- Set your salon_id here (replace SALON_ID_HERE with your actual salon_id):
-- Example: SET @salon_id = 1;
SET @salon_id = SALON_ID_HERE;  -- ⚠️ REPLACE THIS with your actual salon_id

-- =====================================================
-- 1. CREATE BARBER USER
-- =====================================================

INSERT INTO users (full_name, phone, email, user_role) 
VALUES ('Test Barber', '5551234567', 'barber@test.com', 'staff')
ON DUPLICATE KEY UPDATE full_name=full_name;

SET @barber_user_id = (SELECT user_id FROM users WHERE email = 'barber@test.com' LIMIT 1);

-- =====================================================
-- 2. CREATE STAFF/BARBER
-- =====================================================
-- Note: The trigger will automatically create staff_availability records

INSERT INTO staff (user_id, salon_id, role, specialization, is_active) 
VALUES (@barber_user_id, @salon_id, 'barber', 'Haircuts', TRUE)
ON DUPLICATE KEY UPDATE is_active=TRUE;

-- =====================================================
-- 3. ADD SERVICE
-- =====================================================
-- First ensure categories exist (run seed-test-data.sql first)

INSERT INTO services (salon_id, category_id, custom_name, duration, price, is_active) 
VALUES (
    @salon_id,
    (SELECT category_id FROM service_categories WHERE name='Haircuts' LIMIT 1),
    'Haircut',
    30,
    25.00,
    TRUE
)
ON DUPLICATE KEY UPDATE custom_name=custom_name;

-- =====================================================
-- 4. MAKE SALON ACTIVE
-- =====================================================

UPDATE salons SET status = 'active' WHERE salon_id = @salon_id;

-- =====================================================
-- VERIFY DATA
-- =====================================================

-- Check if everything is set up:
SELECT 'Salon Status' as check_type, salon_id, status FROM salons WHERE salon_id = @salon_id
UNION ALL
SELECT 'Staff Count', @salon_id, COUNT(*) FROM staff WHERE salon_id = @salon_id AND role='barber' AND is_active=TRUE
UNION ALL
SELECT 'Service Count', @salon_id, COUNT(*) FROM services WHERE salon_id = @salon_id AND is_active=TRUE
UNION ALL
SELECT 'Availability Count', @salon_id, COUNT(*) FROM staff_availability sa
    JOIN staff s ON sa.staff_id = s.staff_id 
    WHERE s.salon_id = @salon_id AND sa.is_available=TRUE;


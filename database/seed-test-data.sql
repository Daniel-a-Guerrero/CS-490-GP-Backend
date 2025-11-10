-- =====================================================
-- SEED TEST DATA FOR API TESTING
-- =====================================================
-- Run this AFTER running schema.sql, index.sql, and triggers.sql
-- This provides minimum data needed for tests to pass

USE salon_platform;

-- =====================================================
-- 1. ADD MISSING TABLES (if not in schema)
-- =====================================================

-- Add firebase_uid column to users if missing
-- Run this manually if you get an error that the column already exists:
-- ALTER TABLE users ADD COLUMN firebase_uid VARCHAR(255) UNIQUE;

-- Create user_2fa_settings table if missing
CREATE TABLE IF NOT EXISTS user_2fa_settings (
    setting_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    method ENUM('sms', 'email', 'app') DEFAULT 'sms',
    is_enabled BOOLEAN DEFAULT FALSE,
    phone_number VARCHAR(20),
    email VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_2fa (user_id, method)
) ENGINE=InnoDB;

-- Create two_factor_codes table if missing
CREATE TABLE IF NOT EXISTS two_factor_codes (
    code_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    code VARCHAR(6) NOT NULL,
    method ENUM('sms', 'email', 'app') DEFAULT 'sms',
    expires_at DATETIME NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_2fa_user_code (user_id, code),
    INDEX idx_2fa_expires (expires_at)
) ENGINE=InnoDB;

-- =====================================================
-- 2. SEED CATEGORIES (Required for services)
-- =====================================================

-- Add main category
INSERT INTO main_categories (name, description) 
VALUES ('Hair Services', 'Hair cutting, styling, and treatments')
ON DUPLICATE KEY UPDATE name=name;

-- Add service category (global)
INSERT INTO service_categories (main_category_id, salon_id, name, description, is_global) 
VALUES (1, NULL, 'Haircuts', 'Basic haircut services', TRUE)
ON DUPLICATE KEY UPDATE name=name;

-- =====================================================
-- 3. SEED DATA FOR TESTING
-- =====================================================

-- Note: Services will be created AFTER you create a salon via API
-- Run database/seed-after-salon.sql after creating a salon
-- This file only sets up categories and missing tables

-- =====================================================
-- 4. INSTRUCTIONS FOR MANUAL SEEDING
-- =====================================================

-- After running the tests and creating a salon, you need to:

-- A. Create a barber user (or use existing user)
--    INSERT INTO users (user_id, full_name, phone, email, user_role) 
--    VALUES ('barber1', 'Test Barber', '5551234567', 'barber@test.com', 'staff')
--    ON DUPLICATE KEY UPDATE full_name=full_name;

-- B. Create staff/barber (replace salon_id with your actual salon_id)
--    INSERT INTO staff (user_id, salon_id, role, specialization, is_active) 
--    VALUES ('barber1', @salon_id, 'barber', 'Haircuts', TRUE)
--    ON DUPLICATE KEY UPDATE is_active=TRUE;
--    Note: The trigger will automatically create staff_availability records

-- C. Make salon active
--    UPDATE salons SET status = 'active' WHERE salon_id = @salon_id;

-- =====================================================
-- 5. QUICK SEED SCRIPT (Run after creating salon via API)
-- =====================================================

-- Run this SQL after you've created a salon through the API:
-- Replace SALON_ID_HERE with your actual salon_id

/*
-- Step 1: Create barber user
INSERT INTO users (user_id, full_name, phone, email, user_role) 
VALUES ('barber1', 'Test Barber', '5551234567', 'barber@test.com', 'staff')
ON DUPLICATE KEY UPDATE full_name=full_name;

-- Step 2: Create staff/barber (replace SALON_ID_HERE)
INSERT INTO staff (user_id, salon_id, role, specialization, is_active) 
VALUES ('barber1', SALON_ID_HERE, 'barber', 'Haircuts', TRUE)
ON DUPLICATE KEY UPDATE is_active=TRUE;

-- Step 3: Add service (replace SALON_ID_HERE and get category_id)
INSERT INTO services (salon_id, category_id, custom_name, duration, price, is_active) 
VALUES (
    SALON_ID_HERE,
    (SELECT category_id FROM service_categories WHERE name='Haircuts' LIMIT 1),
    'Haircut',
    30,
    25.00,
    TRUE
)
ON DUPLICATE KEY UPDATE custom_name=custom_name;

-- Step 4: Make salon active (replace SALON_ID_HERE)
UPDATE salons SET status = 'active' WHERE salon_id = SALON_ID_HERE;
*/


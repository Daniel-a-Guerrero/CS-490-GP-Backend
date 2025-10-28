USE salon_platform;

-- ============================================
-- INSERT DATA INTO MAIN_CATEGORIES
-- ============================================
INSERT INTO main_categories (name, description) VALUES
('Hair Services', 'Professional hair cutting, styling, and coloring services'),
('Beauty & Skincare', 'Facial treatments, makeup application, and skincare services'),
('Spa & Wellness', 'Massage therapy, body treatments, and relaxation services');

-- ============================================
-- INSERT DATA INTO SERVICE_CATEGORIES
-- ============================================

-- Global Categories (is_global = TRUE, salon_id = NULL)
INSERT INTO service_categories (main_category_id, salon_id, name, description, is_global) VALUES
-- Hair Services (main_category_id = 1)
(1, NULL, 'Haircuts', 'Classic and modern haircuts for all hair types', TRUE),
(1, NULL, 'Hair Coloring', 'Professional hair coloring, highlights, and balayage', TRUE),
(1, NULL, 'Hair Treatments', 'Deep conditioning, keratin, and hair repair treatments', TRUE),

-- Beauty & Skincare (main_category_id = 2)
(2, NULL, 'Facials', 'Deep cleansing and rejuvenating facial treatments', TRUE),
(2, NULL, 'Makeup', 'Professional makeup application for events and daily wear', TRUE),
(2, NULL, 'Nail Services', 'Manicure, pedicure, and nail art services', TRUE),

-- Spa & Wellness (main_category_id = 3)
(3, NULL, 'Massage', 'Swedish, deep tissue, and aromatherapy massage', TRUE),
(3, NULL, 'Body Treatments', 'Body scrubs, wraps, and spa treatments', TRUE),
(3, NULL, 'Waxing', 'Full body and facial hair removal services', TRUE);

-- Salon-Specific Categories (is_global = FALSE, salon_id = 1)
-- Note: Replace salon_id = 1 with your actual salon ID
INSERT INTO service_categories (main_category_id, salon_id, name, description, is_global) VALUES
(1, 1, 'Beard Grooming', 'Specialized beard trimming and styling services', FALSE),
(2, 1, 'Bridal Packages', 'Complete bridal beauty and makeup packages', FALSE),
(3, 1, 'Premium Spa', 'Luxury spa treatments exclusive to this salon', FALSE);

-- ==========================================================
-- ================== NOTIFICATIONS ==========================
-- ==========================================================

-- Insert sample notifications
INSERT INTO notifications (user_id, type, message, read_status, created_at) VALUES
(1, 'status_update', 'Your appointment has been confirmed for October 28, 2025 at 10:00 AM', FALSE, NOW()),
(1, 'promotion', 'Special offer: 20% off on all hair services this week!', FALSE, NOW()),
(2, 'status_update', 'Your appointment has been completed. Thank you for visiting!', TRUE, NOW() - INTERVAL 2 DAY),
(3, 'reminder', 'Reminder: Your appointment is tomorrow at 2:00 PM', FALSE, NOW()),
(1, 'status_update', 'Your order #101 has been confirmed', TRUE, NOW() - INTERVAL 1 DAY);

-- Insert notification preferences
INSERT INTO notification_preferences (user_id, email_enabled, sms_enabled, push_enabled, quiet_hours_start, quiet_hours_end) VALUES
(1, TRUE, TRUE, TRUE, '22:00:00', '08:00:00'),
(2, TRUE, FALSE, TRUE, '23:00:00', '07:00:00'),
(3, TRUE, TRUE, FALSE, NULL, NULL),
(4, FALSE, TRUE, TRUE, '21:00:00', '09:00:00');

-- Insert notification tracking
INSERT INTO notification_tracking (notification_id, delivery_method, delivered, opened, bounced, delivered_at) VALUES
(1, 'email', TRUE, FALSE, FALSE, NOW()),
(1, 'push', TRUE, TRUE, FALSE, NOW()),
(2, 'email', TRUE, TRUE, FALSE, NOW()),
(3, 'email', TRUE, FALSE, FALSE, NOW() - INTERVAL 2 DAY),
(3, 'sms', TRUE, TRUE, FALSE, NOW() - INTERVAL 2 DAY);

-- Insert notification queue (scheduled notifications)
INSERT INTO notification_queue (user_id, message, delivery_method, scheduled_for, sent) VALUES
(1, 'Reminder: Your appointment is in 24 hours', 'email', NOW() + INTERVAL 1 DAY, FALSE),
(2, 'Your loyalty points will expire in 30 days', 'email', NOW() + INTERVAL 3 DAY, FALSE),
(3, 'Special birthday discount available!', 'email', NOW() + INTERVAL 7 DAY, FALSE);

-- ==========================================================
-- ================== PRODUCTS & INVENTORY ===================
-- ==========================================================

-- Insert sample products
INSERT INTO products (salon_id, name, category, description, price, stock, reorder_level, sku, supplier_name, is_active) VALUES
(1, 'Hair Shampoo Premium', 'Hair', 'Professional salon-grade shampoo', 25.00, 50, 10, 'SHMP-001', 'Beauty Supply Co', TRUE),
(1, 'Hair Conditioner', 'Hair', 'Moisturizing conditioner for all hair types', 22.00, 45, 10, 'COND-001', 'Beauty Supply Co', TRUE),
(1, 'Hair Serum', 'Hair', 'Anti-frizz hair serum', 35.00, 30, 5, 'SRM-001', 'Beauty Supply Co', TRUE),
(1, 'Face Cream', 'Skin', 'Anti-aging face cream', 45.00, 20, 5, 'FC-001', 'SkinCare Inc', TRUE),
(1, 'Nail Polish Red', 'Nails', 'Long-lasting red nail polish', 12.00, 60, 15, 'NP-RED-001', 'Nail Pro', TRUE),
(1, 'Nail Polish Clear', 'Nails', 'Clear top coat', 10.00, 55, 15, 'NP-CLR-001', 'Nail Pro', TRUE),
(1, 'Hair Gel', 'Hair', 'Strong hold styling gel', 18.00, 40, 10, 'GEL-001', 'Beauty Supply Co', TRUE),
(1, 'Hair Spray', 'Hair', 'Flexible hold hair spray', 20.00, 35, 10, 'SPY-001', 'Beauty Supply Co', TRUE);

-- Insert product sales
INSERT INTO product_sales (product_id, user_id, salon_id, quantity, total_amount, sold_at) VALUES
(1, 1, 1, 2, 50.00, NOW() - INTERVAL 5 DAY),
(2, 1, 1, 1, 22.00, NOW() - INTERVAL 5 DAY),
(3, 2, 1, 1, 35.00, NOW() - INTERVAL 3 DAY),
(5, 3, 1, 3, 36.00, NOW() - INTERVAL 2 DAY),
(7, 1, 1, 1, 18.00, NOW() - INTERVAL 1 DAY);

-- Insert product usage (products used during appointments)
INSERT INTO product_usage (appointment_id, product_id, quantity_used) VALUES
(1, 1, 1),
(1, 2, 1),
(2, 7, 1);

-- Insert inventory changes
INSERT INTO inventory (product_id, salon_id, staff_id, change_type, quantity_change, previous_stock, new_stock, notes) VALUES
(1, 1, 1, 'restock', 50, 0, 50, 'Initial stock'),
(2, 1, 1, 'restock', 50, 0, 50, 'Initial stock'),
(3, 1, 1, 'restock', 30, 0, 30, 'Initial stock'),
(1, 1, 1, 'sale', -2, 50, 48, 'Sold to customer'),
(7, 1, 1, 'usage', -1, 40, 39, 'Used in appointment #1');

-- ==========================================================
-- ================== CARTS & ORDERS =========================
-- ==========================================================

-- Insert sample carts
INSERT INTO carts (user_id, salon_id, status, created_at) VALUES
(1, 1, 'active', NOW()),
(2, 1, 'checked_out', NOW() - INTERVAL 2 DAY),
(3, 1, 'abandoned', NOW() - INTERVAL 5 DAY);

-- Insert cart items
INSERT INTO cart_items (cart_id, product_id, service_id, quantity, price, type, notes) VALUES
(1, 1, 1, 2, 50.00, 'product', NULL),
(1, NULL, 2, 1, 300.00, 'service', 'Haircut booking'),
(2, 3, NULL, 1, 35.00, 'product', NULL);

-- Insert saved cards
INSERT INTO saved_cards (user_id, cardholder_name, card_brand, last4, expiry_month, expiry_year, is_default, token_reference) VALUES
(1, 'John Doe', 'Visa', '4242', 12, 2026, TRUE, 'tok_visa_4242_abc123'),
(2, 'Jane Smith', 'Mastercard', '5555', 6, 2027, TRUE, 'tok_mc_5555_def456'),
(3, 'Mike Johnson', 'Amex', '3782', 3, 2025, FALSE, 'tok_amex_3782_ghi789');

-- Insert payments
INSERT INTO payments (user_id, amount, payment_method, payment_status, transaction_ref, card_id, appointment_id, created_at) VALUES
(1, 300.00, 'card', 'completed', 'TXN-2025102501', 1, 1, NOW() - INTERVAL 3 DAY),
(2, 450.00, 'card', 'completed', 'TXN-2025102502', 2, 2, NOW() - INTERVAL 2 DAY),
(3, 200.00, 'paypal', 'completed', 'TXN-2025102503', NULL, 3, NOW() - INTERVAL 1 DAY),
(1, 72.00, 'card', 'completed', 'TXN-2025102504', 1, NULL, NOW());

-- Insert orders
INSERT INTO orders (user_id, salon_id, total_amount, payment_id, payment_status, order_status) VALUES
(1, 1, 300.00, 1, 'paid', 'completed'),
(2, 1, 450.00, 2, 'paid', 'completed'),
(3, 1, 200.00, 3, 'paid', 'processing'),
(1, 1, 72.00, 4, 'paid', 'completed');

-- Insert order items
INSERT INTO order_items (order_id, product_id, service_id, quantity, price, type) VALUES
(1, NULL, 2, 1, 300.00, 'service'),
(2, NULL, 2, 1, 300.00, 'service'),
(2, 1, NULL, 2, 50.00, 'product'),
(2, 3, NULL, 1, 35.00, 'product'),
(3, NULL, 2, 1, 200.00, 'service'),
(4, 1, NULL, 2, 50.00, 'product'),
(4, 5, NULL, 2, 24.00, 'product');

-- ==========================================================
-- ================== OTHER TABLES ==========================
-- ==========================================================

-- Insert loyalty points
INSERT INTO loyalty (user_id, salon_id, points, last_earned, last_redeemed) VALUES
(1, 1, 1500, NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 10 DAY),
(2, 1, 2200, NOW() - INTERVAL 2 DAY, NULL),
(3, 1, 800, NOW() - INTERVAL 3 DAY, NOW() - INTERVAL 15 DAY),
(4, 1, 500, NOW() - INTERVAL 5 DAY, NULL);

-- Insert payouts
INSERT INTO payouts (salon_id, total_sales, platform_fee, amount, payment_method, transaction_ref, payout_status, payout_date) VALUES
(1, 5000.00, 250.00, 4750.00, 'stripe', 'PO-2025100101', 'processed', NOW() - INTERVAL 10 DAY),
(1, 3200.00, 160.00, 3040.00, 'stripe', 'PO-2025101501', 'processed', NOW() - INTERVAL 3 DAY),
(1, 1800.00, 90.00, 1710.00, 'stripe', 'PO-2025102001', 'pending', NOW());

-- Insert history
INSERT INTO history (user_id, salon_id, staff_id, appointment_id, service_id, visit_date, service_name, price, rating, notes) VALUES
(1, 1, 1, 1, 2, '2025-10-20', 'Haircut', 300.00, 5, 'Excellent service'),
(2, 1, 1, 2, 2, '2025-10-18', 'Haircut', 300.00, 4, 'Good haircut'),
(3, 1, 1, 3, 2, '2025-10-15', 'Haircut', 300.00, 5, 'Very professional'),
(1, 1, 1, 4, 2, '2025-09-25', 'Haircut', 300.00, 5, 'Always great');

-- Insert reviews
INSERT INTO reviews (appointment_id, user_id, salon_id, staff_id, rating, comment, response, is_visible, is_flagged) VALUES
(1, 1, 1, 1, 5, 'Amazing haircut! Jack is very skilled and professional.', 'Thank you for your kind words!', TRUE, FALSE),
(2, 2, 1, 1, 4, 'Good service, but had to wait a bit longer than expected.', 'We apologize for the wait. We will work on improving our scheduling.', TRUE, FALSE),
(3, 3, 1, 1, 5, 'Best salon experience ever! Highly recommend.', 'We appreciate your recommendation!', TRUE, FALSE),
(4, 1, 1, 1, 5, 'Consistent quality every time. My go-to salon.', 'Good' , TRUE, FALSE);

-- ==========================================================
-- ================== ADDITIONAL UPDATES =====================
-- ==========================================================

-- Update product stock after sales
UPDATE products SET stock = 48 WHERE product_id = 1;  -- After selling 2 units
UPDATE products SET stock = 44 WHERE product_id = 2;  -- After usage
UPDATE products SET stock = 29 WHERE product_id = 3;  -- After selling 1 unit
UPDATE products SET stock = 54 WHERE product_id = 5;  -- After selling 6 units
UPDATE products SET stock = 39 WHERE product_id = 7;  -- After usage

-- Update loyalty lifetime_points (if column exists)
-- UPDATE loyalty SET lifetime_points = points + 500 WHERE user_id = 1;
-- UPDATE loyalty SET lifetime_points = points + 800 WHERE user_id = 2;
-- UPDATE loyalty SET lifetime_points = points + 300 WHERE user_id = 3;

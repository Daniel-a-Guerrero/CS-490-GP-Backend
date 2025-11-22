-- =====================================================
-- PAYMENTS TABLE
-- =====================================================

USE salon_platform;

CREATE TABLE IF NOT EXISTS payments (
  payment_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  appointment_id INT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  payment_method VARCHAR(50) DEFAULT 'stripe',
  payment_status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
  stripe_checkout_session_id VARCHAR(255),
  stripe_payment_intent_id VARCHAR(255),
  payment_link TEXT,
  failure_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id) ON DELETE CASCADE,

  INDEX idx_user_id (user_id),
  INDEX idx_appointment_id (appointment_id),
  INDEX idx_payment_status (payment_status),
  INDEX idx_stripe_session (stripe_checkout_session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verify table was created
SELECT 'Payments table created successfully!' AS status;
DESCRIBE payments;

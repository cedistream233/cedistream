-- Add fee split and payment-related columns to purchases table (idempotent)
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'GHS';
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS paystack_fee DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS creator_amount DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS platform_net DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS gateway VARCHAR(50) DEFAULT 'paystack';
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS gateway_data JSONB DEFAULT '{}'::jsonb;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_purchases_payment_reference ON purchases(payment_reference);
-- Unique index to support idempotency by (user_id, item, reference)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_purchase_by_ref_user_item
  ON purchases(user_id, item_type, item_id, payment_reference);

-- Add indexes to speed analytics queries on purchases
-- Creates indexes on created_at, payment_status, and item_type+item_id
CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON purchases (created_at);
CREATE INDEX IF NOT EXISTS idx_purchases_payment_status ON purchases (payment_status);
CREATE INDEX IF NOT EXISTS idx_purchases_item_type_id ON purchases (item_type, item_id);

-- Optional: composite index for queries that filter by created_at and payment_status
CREATE INDEX IF NOT EXISTS idx_purchases_status_created_at ON purchases (payment_status, created_at);

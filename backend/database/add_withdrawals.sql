-- Create withdrawals table for manual payouts
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS withdrawals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL, -- total deducted from balance
  transfer_fee DECIMAL(10,2) NOT NULL DEFAULT 1.00,
  amount_to_receive DECIMAL(10,2) NOT NULL,
  destination_type VARCHAR(20) DEFAULT 'mobile_money',
  destination_account VARCHAR(32) NOT NULL, -- phone number
  status VARCHAR(20) NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','processing','paid','rejected','cancelled')),
  reference VARCHAR(64),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_created_at ON withdrawals(created_at DESC);

-- updated_at trigger
DROP TRIGGER IF EXISTS update_withdrawals_updated_at ON withdrawals;
CREATE TRIGGER update_withdrawals_updated_at BEFORE UPDATE ON withdrawals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

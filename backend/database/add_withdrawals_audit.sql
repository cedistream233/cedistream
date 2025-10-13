-- Create audit table for withdrawals status changes
CREATE TABLE IF NOT EXISTS withdrawals_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  withdrawal_id UUID NOT NULL REFERENCES withdrawals(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  previous_status VARCHAR(20) NOT NULL,
  new_status VARCHAR(20) NOT NULL,
  notes TEXT,
  reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_audit_withdrawal_id ON withdrawals_audit(withdrawal_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_audit_created_at ON withdrawals_audit(created_at DESC);

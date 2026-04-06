-- Campaign rotations: tracks when a campaign is reassigned from one user to another
CREATE TABLE IF NOT EXISTS campaign_rotations (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
  previous_user_id INTEGER REFERENCES users(id),
  new_user_id INTEGER NOT NULL REFERENCES users(id),
  rotated_by INTEGER NOT NULL REFERENCES users(id),
  reason TEXT,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_rotations_campaign ON campaign_rotations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_rotations_date ON campaign_rotations(effective_date);
CREATE INDEX IF NOT EXISTS idx_campaign_rotations_new_user ON campaign_rotations(new_user_id);

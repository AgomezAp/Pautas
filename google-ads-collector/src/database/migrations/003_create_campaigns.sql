CREATE TABLE IF NOT EXISTS campaigns (
    id                      SERIAL PRIMARY KEY,
    google_ads_campaign_id  VARCHAR(50),
    name                    VARCHAR(255) NOT NULL,
    country_id              INTEGER NOT NULL REFERENCES countries(id),
    campaign_url            VARCHAR(500),
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(google_ads_campaign_id, country_id)
);

CREATE INDEX IF NOT EXISTS idx_campaigns_country_id ON campaigns(country_id);

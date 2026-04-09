-- Assets (sitelinks, callouts, images, videos, calls)
CREATE TABLE IF NOT EXISTS assets (
    id                  SERIAL PRIMARY KEY,
    account_id          VARCHAR(50) NOT NULL,
    asset_id            VARCHAR(50) NOT NULL,
    name                VARCHAR(500) DEFAULT '',
    type                VARCHAR(50) DEFAULT '',
    source              VARCHAR(50) DEFAULT '',
    final_urls          TEXT DEFAULT '[]',
    final_mobile_urls   TEXT DEFAULT '[]',
    -- sitelink
    sitelink_text       VARCHAR(255) DEFAULT '',
    sitelink_desc1      VARCHAR(255) DEFAULT '',
    sitelink_desc2      VARCHAR(255) DEFAULT '',
    -- callout
    callout_text        VARCHAR(255) DEFAULT '',
    -- structured snippet
    snippet_header      VARCHAR(100) DEFAULT '',
    snippet_values      TEXT DEFAULT '[]',
    -- call
    call_phone_number   VARCHAR(50) DEFAULT '',
    call_country_code   VARCHAR(10) DEFAULT '',
    -- image
    image_url           VARCHAR(2000) DEFAULT '',
    image_file_size     INTEGER DEFAULT 0,
    -- youtube
    youtube_video_id    VARCHAR(50) DEFAULT '',
    youtube_video_title VARCHAR(500) DEFAULT '',
    last_synced_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, asset_id)
);

-- Shared sets (negative keyword lists etc.)
CREATE TABLE IF NOT EXISTS shared_sets (
    id                  SERIAL PRIMARY KEY,
    account_id          VARCHAR(50) NOT NULL,
    shared_set_id       VARCHAR(50) NOT NULL,
    name                VARCHAR(255) DEFAULT '',
    type                VARCHAR(50) DEFAULT '',
    status              VARCHAR(30) DEFAULT '',
    member_count        INTEGER DEFAULT 0,
    reference_count     INTEGER DEFAULT 0,
    last_synced_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, shared_set_id)
);

-- Campaign targeting criteria
CREATE TABLE IF NOT EXISTS campaign_targeting (
    id                  SERIAL PRIMARY KEY,
    account_id          VARCHAR(50) NOT NULL,
    campaign_id         VARCHAR(50) NOT NULL,
    criterion_id        VARCHAR(50) NOT NULL,
    type                VARCHAR(50) DEFAULT '',
    status              VARCHAR(30) DEFAULT '',
    bid_modifier        DECIMAL(10,4) DEFAULT 0,
    is_negative         BOOLEAN DEFAULT FALSE,
    location_constant   VARCHAR(200),
    language_constant   VARCHAR(200),
    keyword_text        VARCHAR(500) DEFAULT '',
    keyword_match_type  VARCHAR(30) DEFAULT '',
    last_synced_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, campaign_id, criterion_id)
);

CREATE INDEX IF NOT EXISTS idx_asset_account ON assets(account_id);
CREATE INDEX IF NOT EXISTS idx_ss_account ON shared_sets(account_id);
CREATE INDEX IF NOT EXISTS idx_ct_account ON campaign_targeting(account_id);
CREATE INDEX IF NOT EXISTS idx_ct_campaign ON campaign_targeting(campaign_id);

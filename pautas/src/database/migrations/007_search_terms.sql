-- Search terms
CREATE TABLE IF NOT EXISTS search_terms (
    id                  SERIAL PRIMARY KEY,
    account_id          VARCHAR(50) NOT NULL,
    campaign_id         VARCHAR(50) NOT NULL,
    ad_group_id         VARCHAR(50) NOT NULL,
    search_term         VARCHAR(1000) NOT NULL,
    match_type          VARCHAR(30) DEFAULT '',
    status              VARCHAR(30) DEFAULT '',
    term_date           DATE NOT NULL,
    conversions         DECIMAL(12,2) DEFAULT 0,
    cost                DECIMAL(14,2) DEFAULT 0,
    clicks              INTEGER DEFAULT 0,
    impressions         INTEGER DEFAULT 0,
    ctr                 DECIMAL(8,6) DEFAULT 0,
    average_cpc         DECIMAL(14,2) DEFAULT 0,
    cost_per_conversion DECIMAL(14,2) DEFAULT 0,
    fetched_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, ad_group_id, search_term, term_date)
);

CREATE INDEX IF NOT EXISTS idx_st_account ON search_terms(account_id);
CREATE INDEX IF NOT EXISTS idx_st_date ON search_terms(term_date);
CREATE INDEX IF NOT EXISTS idx_st_term ON search_terms(search_term);

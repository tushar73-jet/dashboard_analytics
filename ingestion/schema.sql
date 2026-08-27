-- ──────────────────────────────────────────────────────────────────────
-- Instagram Analytics Dashboard — Database Schema
-- Run this against your Neon Postgres database to create all tables.
--
-- Usage:
--   psql $DATABASE_URL -f ingestion/schema.sql
-- ──────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════
-- Posts table
-- Stores metadata for each Instagram post
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS posts (
    post_id         TEXT PRIMARY KEY,              -- Instagram media ID (e.g. "17841405...")
    ig_id           TEXT,                          -- Short numeric ID
    caption         TEXT,
    media_type      TEXT NOT NULL,                 -- IMAGE, VIDEO, CAROUSEL_ALBUM
    media_url       TEXT,
    permalink       TEXT,
    posted_at       TIMESTAMPTZ NOT NULL,
    hashtags        TEXT[],                        -- Extracted from caption
    posting_hour    SMALLINT GENERATED ALWAYS AS (
                        EXTRACT(HOUR FROM posted_at AT TIME ZONE 'Asia/Kolkata')::SMALLINT
                    ) STORED,
    day_of_week     SMALLINT GENERATED ALWAYS AS (
                        EXTRACT(DOW FROM posted_at AT TIME ZONE 'Asia/Kolkata')::SMALLINT
                    ) STORED,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE posts IS 'Instagram media objects (posts, reels, carousels)';
COMMENT ON COLUMN posts.posting_hour IS 'Hour of day in IST (0-23), auto-computed';
COMMENT ON COLUMN posts.day_of_week IS 'Day of week in IST (0=Sun, 6=Sat), auto-computed';

-- ═══════════════════════════════════════════════════════════════════════
-- Post metrics table
-- Daily snapshots of per-post engagement metrics
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS post_metrics (
    post_id         TEXT NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
    snapshot_date   DATE NOT NULL DEFAULT CURRENT_DATE,
    reach           INTEGER DEFAULT 0,
    views           INTEGER DEFAULT 0,             -- Replaces deprecated "impressions" (Apr 2025)
    likes           INTEGER DEFAULT 0,
    comments        INTEGER DEFAULT 0,
    saves           INTEGER DEFAULT 0,
    shares          INTEGER DEFAULT 0,
    engagement_rate NUMERIC(8,6) GENERATED ALWAYS AS (
        CASE WHEN reach > 0
             THEN (likes + comments + saves + shares)::NUMERIC / reach
             ELSE 0
        END
    ) STORED,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (post_id, snapshot_date)
);

COMMENT ON TABLE post_metrics IS 'Daily metric snapshots per post';
COMMENT ON COLUMN post_metrics.views IS 'Total views — replaces deprecated impressions metric';
COMMENT ON COLUMN post_metrics.engagement_rate IS 'Auto-computed: (likes+comments+saves+shares)/reach';

-- ═══════════════════════════════════════════════════════════════════════
-- Account metrics table
-- Daily snapshots of account-level metrics
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS account_metrics (
    snapshot_date   DATE PRIMARY KEY DEFAULT CURRENT_DATE,
    followers       INTEGER,
    follows         INTEGER,
    profile_views   INTEGER,
    reach           INTEGER,
    views           INTEGER,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE account_metrics IS 'Daily account-level metric snapshots';

-- ═══════════════════════════════════════════════════════════════════════
-- API tokens table
-- Stores long-lived access tokens with expiry tracking
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS api_tokens (
    id              SERIAL PRIMARY KEY,
    access_token    TEXT NOT NULL,
    token_type      TEXT DEFAULT 'long_lived',
    expires_at      TIMESTAMPTZ,
    ig_account_id   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    is_active       BOOLEAN DEFAULT TRUE
);

COMMENT ON TABLE api_tokens IS 'Instagram API token storage with expiry tracking';

-- ═══════════════════════════════════════════════════════════════════════
-- Indexes for dashboard query performance
-- ═══════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_posts_media_type    ON posts(media_type);
CREATE INDEX IF NOT EXISTS idx_posts_posted_at     ON posts(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_posting_hour  ON posts(posting_hour);
CREATE INDEX IF NOT EXISTS idx_posts_day_of_week   ON posts(day_of_week);
CREATE INDEX IF NOT EXISTS idx_post_metrics_date   ON post_metrics(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_post_metrics_er     ON post_metrics(engagement_rate DESC);
CREATE INDEX IF NOT EXISTS idx_account_metrics_dt  ON account_metrics(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_api_tokens_active   ON api_tokens(is_active) WHERE is_active = TRUE;

-- ═══════════════════════════════════════════════════════════════════════
-- Useful views for the API layer
-- ═══════════════════════════════════════════════════════════════════════

-- Latest metrics per post (most recent snapshot)
CREATE OR REPLACE VIEW v_latest_post_metrics AS
SELECT DISTINCT ON (pm.post_id)
    p.post_id,
    p.caption,
    p.media_type,
    p.permalink,
    p.posted_at,
    p.hashtags,
    p.posting_hour,
    p.day_of_week,
    pm.reach,
    pm.views,
    pm.likes,
    pm.comments,
    pm.saves,
    pm.shares,
    pm.engagement_rate,
    pm.snapshot_date
FROM post_metrics pm
JOIN posts p ON p.post_id = pm.post_id
ORDER BY pm.post_id, pm.snapshot_date DESC;

-- Engagement by media type (aggregated)
CREATE OR REPLACE VIEW v_engagement_by_type AS
SELECT
    p.media_type,
    COUNT(DISTINCT p.post_id) AS post_count,
    ROUND(AVG(pm.engagement_rate), 6) AS avg_engagement_rate,
    ROUND(AVG(pm.reach), 1) AS avg_reach,
    ROUND(AVG(pm.likes), 1) AS avg_likes,
    ROUND(AVG(pm.comments), 1) AS avg_comments,
    ROUND(AVG(pm.saves), 1) AS avg_saves,
    ROUND(AVG(pm.shares), 1) AS avg_shares
FROM posts p
JOIN post_metrics pm ON p.post_id = pm.post_id
WHERE pm.snapshot_date = (
    SELECT MAX(snapshot_date) FROM post_metrics WHERE post_id = p.post_id
)
GROUP BY p.media_type;

-- Engagement by posting hour (IST)
CREATE OR REPLACE VIEW v_engagement_by_hour AS
SELECT
    p.posting_hour,
    COUNT(DISTINCT p.post_id) AS post_count,
    ROUND(AVG(pm.engagement_rate), 6) AS avg_engagement_rate,
    ROUND(AVG(pm.reach), 1) AS avg_reach
FROM posts p
JOIN post_metrics pm ON p.post_id = pm.post_id
WHERE pm.snapshot_date = (
    SELECT MAX(snapshot_date) FROM post_metrics WHERE post_id = p.post_id
)
GROUP BY p.posting_hour
ORDER BY p.posting_hour;

-- Engagement by day of week
CREATE OR REPLACE VIEW v_engagement_by_day AS
SELECT
    p.day_of_week,
    COUNT(DISTINCT p.post_id) AS post_count,
    ROUND(AVG(pm.engagement_rate), 6) AS avg_engagement_rate,
    ROUND(AVG(pm.reach), 1) AS avg_reach
FROM posts p
JOIN post_metrics pm ON p.post_id = pm.post_id
WHERE pm.snapshot_date = (
    SELECT MAX(snapshot_date) FROM post_metrics WHERE post_id = p.post_id
)
GROUP BY p.day_of_week
ORDER BY p.day_of_week;

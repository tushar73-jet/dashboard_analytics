"""
Instagram Graph API — Data Ingestion Script
=============================================

Pulls posts + insights from the Instagram Graph API and writes them
into the Postgres database. Designed to run daily via GitHub Actions.

Usage:
    python ingestion/ingest.py

Required environment variables:
    DATABASE_URL      — Postgres connection string (Neon)
    IG_ACCESS_TOKEN   — Long-lived Instagram/Facebook access token
    IG_ACCOUNT_ID     — Instagram Business Account ID (numeric)
"""

import os
import re
import sys
import time
import logging
from datetime import datetime, timezone

import psycopg2
import psycopg2.extras
import requests
from dotenv import load_dotenv

# ── Load .env for local development ──
load_dotenv()

# ── Configuration ──
DATABASE_URL = os.environ.get("DATABASE_URL")
ACCESS_TOKEN = os.environ.get("IG_ACCESS_TOKEN")
IG_ACCOUNT_ID = os.environ.get("IG_ACCOUNT_ID")
GRAPH_API_VERSION = "v21.0"
BASE_URL = f"https://graph.facebook.com/{GRAPH_API_VERSION}"

# Rate limiting config
MAX_RETRIES = 3
RETRY_DELAY_BASE = 2  # seconds, exponential backoff
CALLS_PER_BATCH = 45  # pause after this many calls (stay well under 200/hr)
BATCH_PAUSE = 30       # seconds to pause between batches

# ── Logging ──
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("ingest")


# ═══════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════

def api_get(endpoint: str, params: dict = None) -> dict:
    """Make a GET request to the Graph API with retry + backoff."""
    if params is None:
        params = {}
    params["access_token"] = ACCESS_TOKEN

    url = f"{BASE_URL}/{endpoint}" if not endpoint.startswith("http") else endpoint

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = requests.get(url, params=params if not endpoint.startswith("http") else None, timeout=30)

            if resp.status_code == 429:
                wait = RETRY_DELAY_BASE ** attempt * 10
                log.warning(f"Rate limited (429). Waiting {wait}s before retry {attempt}/{MAX_RETRIES}")
                time.sleep(wait)
                continue

            resp.raise_for_status()
            return resp.json()

        except requests.exceptions.RequestException as e:
            if attempt == MAX_RETRIES:
                log.error(f"API call failed after {MAX_RETRIES} retries: {e}")
                raise
            wait = RETRY_DELAY_BASE ** attempt
            log.warning(f"Request error: {e}. Retrying in {wait}s ({attempt}/{MAX_RETRIES})")
            time.sleep(wait)

    return {}


def extract_hashtags(caption: str) -> list[str]:
    """Extract hashtags from a caption string."""
    if not caption:
        return []
    return re.findall(r"#(\w+)", caption)


def get_db_connection():
    """Create a database connection."""
    if not DATABASE_URL:
        log.error("DATABASE_URL not set")
        sys.exit(1)
    return psycopg2.connect(DATABASE_URL)


# ═══════════════════════════════════════════════════════════════════════
# Fetch Functions
# ═══════════════════════════════════════════════════════════════════════

def fetch_all_media() -> list[dict]:
    """Fetch all media objects for the account, handling pagination."""
    log.info("Fetching media list...")
    all_media = []
    call_count = 0

    fields = "id,caption,media_type,media_url,permalink,timestamp,thumbnail_url"
    data = api_get(f"{IG_ACCOUNT_ID}/media", {"fields": fields, "limit": 50})
    call_count += 1

    while True:
        media_list = data.get("data", [])
        all_media.extend(media_list)
        log.info(f"  Fetched {len(all_media)} posts so far...")

        # Pagination
        paging = data.get("paging", {})
        next_url = paging.get("next")
        if not next_url:
            break

        # Rate limiting
        call_count += 1
        if call_count % CALLS_PER_BATCH == 0:
            log.info(f"  Pausing {BATCH_PAUSE}s for rate limiting ({call_count} calls made)...")
            time.sleep(BATCH_PAUSE)

        data = api_get(next_url)

    log.info(f"Total posts fetched: {len(all_media)}")
    return all_media


def fetch_media_insights(media_id: str, media_type: str) -> dict:
    """
    Fetch insights for a single media object.

    Available metrics depend on media type:
    - IMAGE/CAROUSEL_ALBUM: reach, likes, comments, saves, shares, views
    - VIDEO (Reels): reach, likes, comments, saves, shares, views
    """
    # Use the current valid metric names (post-April 2025)
    metrics = "reach,likes,comments,saved,shares,views"

    try:
        data = api_get(f"{media_id}/insights", {"metric": metrics})
        result = {}
        for item in data.get("data", []):
            name = item["name"]
            # "saved" comes back as the metric name, but we store it as "saves"
            if name == "saved":
                name = "saves"
            value = item.get("values", [{}])[0].get("value", 0)
            result[name] = value
        return result

    except Exception as e:
        # Some older posts or stories may not have insights available
        log.warning(f"  Could not fetch insights for {media_id}: {e}")
        return {}


def fetch_account_info() -> dict:
    """Fetch current account-level info (followers, follows, media count)."""
    log.info("Fetching account info...")
    fields = "id,username,followers_count,follows_count,media_count"
    return api_get(IG_ACCOUNT_ID, {"fields": fields})


def fetch_account_insights() -> dict:
    """
    Fetch account-level insights for the last day.

    Note: Account insights require a 'period' parameter and only return
    data for periods that have ended.
    """
    log.info("Fetching account insights...")
    try:
        metrics = "reach,profile_views"
        data = api_get(
            f"{IG_ACCOUNT_ID}/insights",
            {"metric": metrics, "period": "day", "metric_type": "total_value"},
        )
        result = {}
        for item in data.get("data", []):
            name = item["name"]
            # total_value structure
            total = item.get("total_value", {}).get("value", 0)
            result[name] = total
        return result

    except Exception as e:
        log.warning(f"Could not fetch account insights: {e}")
        return {}


# ═══════════════════════════════════════════════════════════════════════
# Upsert Functions
# ═══════════════════════════════════════════════════════════════════════

def upsert_posts(conn, media_list: list[dict]):
    """Insert or update posts in the database."""
    log.info(f"Upserting {len(media_list)} posts...")

    with conn.cursor() as cur:
        for media in media_list:
            caption = media.get("caption", "")
            hashtags = extract_hashtags(caption)

            cur.execute(
                """
                INSERT INTO posts (post_id, ig_id, caption, media_type, media_url, permalink, posted_at, hashtags, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
                ON CONFLICT (post_id) DO UPDATE SET
                    caption = EXCLUDED.caption,
                    media_url = EXCLUDED.media_url,
                    permalink = EXCLUDED.permalink,
                    hashtags = EXCLUDED.hashtags,
                    updated_at = NOW()
                """,
                (
                    media["id"],
                    media.get("ig_id"),
                    caption,
                    media["media_type"],
                    media.get("media_url") or media.get("thumbnail_url"),
                    media.get("permalink"),
                    media["timestamp"],
                    hashtags,
                ),
            )

    conn.commit()
    log.info("Posts upserted successfully")


def upsert_post_metrics(conn, post_id: str, metrics: dict):
    """Insert or update daily metrics for a post."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO post_metrics (post_id, snapshot_date, reach, views, likes, comments, saves, shares)
            VALUES (%s, CURRENT_DATE, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (post_id, snapshot_date) DO UPDATE SET
                reach = EXCLUDED.reach,
                views = EXCLUDED.views,
                likes = EXCLUDED.likes,
                comments = EXCLUDED.comments,
                saves = EXCLUDED.saves,
                shares = EXCLUDED.shares
            """,
            (
                post_id,
                metrics.get("reach", 0),
                metrics.get("views", 0),
                metrics.get("likes", 0),
                metrics.get("comments", 0),
                metrics.get("saves", 0),
                metrics.get("shares", 0),
            ),
        )


def upsert_account_metrics(conn, account_info: dict, account_insights: dict):
    """Insert or update daily account metrics."""
    log.info("Upserting account metrics...")

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO account_metrics (snapshot_date, followers, follows, profile_views, reach)
            VALUES (CURRENT_DATE, %s, %s, %s, %s)
            ON CONFLICT (snapshot_date) DO UPDATE SET
                followers = EXCLUDED.followers,
                follows = EXCLUDED.follows,
                profile_views = EXCLUDED.profile_views,
                reach = EXCLUDED.reach
            """,
            (
                account_info.get("followers_count", 0),
                account_info.get("follows_count", 0),
                account_insights.get("profile_views", 0),
                account_insights.get("reach", 0),
            ),
        )

    conn.commit()
    log.info("Account metrics upserted successfully")


# ═══════════════════════════════════════════════════════════════════════
# Token Health Check
# ═══════════════════════════════════════════════════════════════════════

def check_token_health():
    """Check if the access token is valid and warn if expiring soon."""
    log.info("Checking token health...")

    try:
        data = api_get("debug_token", {"input_token": ACCESS_TOKEN})
        token_data = data.get("data", {})

        is_valid = token_data.get("is_valid", False)
        expires_at = token_data.get("expires_at", 0)

        if not is_valid:
            log.error("❌ Access token is INVALID. Please generate a new one.")
            sys.exit(1)

        if expires_at > 0:
            expiry = datetime.fromtimestamp(expires_at, tz=timezone.utc)
            days_left = (expiry - datetime.now(timezone.utc)).days

            if days_left < 7:
                log.warning(f"⚠️  Token expires in {days_left} days! Run refresh_token.py ASAP.")
            elif days_left < 14:
                log.warning(f"⚠️  Token expires in {days_left} days. Consider refreshing soon.")
            else:
                log.info(f"Token valid — expires in {days_left} days ({expiry.strftime('%Y-%m-%d')})")
        else:
            log.info("Token has no expiry (never-expiring token)")

    except Exception as e:
        log.warning(f"Could not check token health: {e}")


# ═══════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════

def main():
    log.info("=" * 60)
    log.info("Instagram Analytics — Daily Ingestion")
    log.info("=" * 60)

    # Validate config
    if not ACCESS_TOKEN:
        log.error("IG_ACCESS_TOKEN not set")
        sys.exit(1)
    if not IG_ACCOUNT_ID:
        log.error("IG_ACCOUNT_ID not set")
        sys.exit(1)
    if not DATABASE_URL:
        log.error("DATABASE_URL not set")
        sys.exit(1)

    # Check token health
    check_token_health()

    # Connect to database
    conn = get_db_connection()
    log.info("Connected to database")

    try:
        # 1. Fetch & upsert account info
        account_info = fetch_account_info()
        log.info(f"Account: @{account_info.get('username')} — "
                 f"{account_info.get('followers_count')} followers, "
                 f"{account_info.get('media_count')} posts")

        account_insights = fetch_account_insights()
        upsert_account_metrics(conn, account_info, account_insights)

        # 2. Fetch all media
        media_list = fetch_all_media()
        upsert_posts(conn, media_list)

        # 3. Fetch insights for each post
        log.info("Fetching insights for each post...")
        call_count = 0
        success_count = 0
        skip_count = 0

        for i, media in enumerate(media_list):
            media_id = media["id"]
            media_type = media["media_type"]

            # Fetch insights
            metrics = fetch_media_insights(media_id, media_type)

            if metrics:
                upsert_post_metrics(conn, media_id, metrics)
                success_count += 1
            else:
                skip_count += 1

            # Progress logging
            if (i + 1) % 50 == 0:
                conn.commit()
                log.info(f"  Progress: {i + 1}/{len(media_list)} posts processed "
                         f"({success_count} with insights, {skip_count} skipped)")

            # Rate limiting
            call_count += 1
            if call_count % CALLS_PER_BATCH == 0:
                log.info(f"  Pausing {BATCH_PAUSE}s for rate limiting...")
                time.sleep(BATCH_PAUSE)

        # Final commit
        conn.commit()

        log.info("=" * 60)
        log.info(f"Ingestion complete!")
        log.info(f"  Posts processed:     {len(media_list)}")
        log.info(f"  Insights collected:  {success_count}")
        log.info(f"  Insights skipped:    {skip_count}")
        log.info("=" * 60)

    except Exception as e:
        log.error(f"Ingestion failed: {e}")
        conn.rollback()
        raise

    finally:
        conn.close()


if __name__ == "__main__":
    main()

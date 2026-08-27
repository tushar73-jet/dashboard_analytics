"""
Instagram Graph API — Token Refresh Script
============================================

Refreshes the long-lived access token before it expires.
Long-lived tokens last ~60 days; this script should be called
daily and will only refresh if expiry is <14 days away.

Usage:
    python ingestion/refresh_token.py

Required environment variables:
    IG_ACCESS_TOKEN   — Current long-lived token
    META_APP_ID       — Meta App ID
    META_APP_SECRET   — Meta App Secret
    DATABASE_URL      — Postgres connection string (to store new token)
"""

import os
import sys
import logging
from datetime import datetime, timezone

import psycopg2
import requests
from dotenv import load_dotenv

load_dotenv()

# ── Config ──
ACCESS_TOKEN = os.environ.get("IG_ACCESS_TOKEN")
APP_ID = os.environ.get("META_APP_ID")
APP_SECRET = os.environ.get("META_APP_SECRET")
DATABASE_URL = os.environ.get("DATABASE_URL")
GRAPH_API_VERSION = "v21.0"
BASE_URL = f"https://graph.facebook.com/{GRAPH_API_VERSION}"

# Refresh if token expires within this many days
REFRESH_THRESHOLD_DAYS = 14

# ── Logging ──
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("refresh_token")


def check_token_expiry() -> int | None:
    """Check when the current token expires. Returns days until expiry, or None."""
    try:
        resp = requests.get(
            f"{BASE_URL}/debug_token",
            params={"input_token": ACCESS_TOKEN, "access_token": ACCESS_TOKEN},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json().get("data", {})

        if not data.get("is_valid"):
            log.error("Token is no longer valid!")
            return -1

        expires_at = data.get("expires_at", 0)
        if expires_at == 0:
            log.info("Token has no expiry (never-expiring)")
            return None

        expiry = datetime.fromtimestamp(expires_at, tz=timezone.utc)
        days_left = (expiry - datetime.now(timezone.utc)).days
        log.info(f"Token expires in {days_left} days ({expiry.strftime('%Y-%m-%d %H:%M UTC')})")
        return days_left

    except Exception as e:
        log.error(f"Failed to check token expiry: {e}")
        return None


def refresh_token() -> str | None:
    """
    Exchange the current long-lived token for a new long-lived token.
    
    This extends the expiry by another ~60 days.
    The token must NOT have already expired.
    """
    log.info("Refreshing long-lived token...")

    try:
        resp = requests.get(
            f"{BASE_URL}/oauth/access_token",
            params={
                "grant_type": "fb_exchange_token",
                "client_id": APP_ID,
                "client_secret": APP_SECRET,
                "fb_exchange_token": ACCESS_TOKEN,
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()

        new_token = data.get("access_token")
        expires_in = data.get("expires_in", 0)  # seconds

        if not new_token:
            log.error(f"No access_token in response: {data}")
            return None

        days = expires_in // 86400
        log.info(f"✅ New token obtained! Expires in {days} days ({expires_in}s)")
        return new_token

    except Exception as e:
        log.error(f"Token refresh failed: {e}")
        return None


def store_token(token: str, expires_in_days: int = 60):
    """Store the new token in the database and deactivate the old one."""
    if not DATABASE_URL:
        log.warning("DATABASE_URL not set — cannot store token in DB")
        return

    try:
        conn = psycopg2.connect(DATABASE_URL)
        with conn.cursor() as cur:
            # Deactivate old tokens
            cur.execute("UPDATE api_tokens SET is_active = FALSE WHERE is_active = TRUE")

            # Insert new token
            cur.execute(
                """
                INSERT INTO api_tokens (access_token, token_type, expires_at, is_active)
                VALUES (%s, 'long_lived', NOW() + INTERVAL '%s days', TRUE)
                """,
                (token, expires_in_days),
            )

        conn.commit()
        conn.close()
        log.info("Token stored in database")

    except Exception as e:
        log.error(f"Failed to store token in DB: {e}")


def main():
    log.info("=" * 60)
    log.info("Instagram Analytics — Token Refresh")
    log.info("=" * 60)

    # Validate config
    missing = []
    if not ACCESS_TOKEN:
        missing.append("IG_ACCESS_TOKEN")
    if not APP_ID:
        missing.append("META_APP_ID")
    if not APP_SECRET:
        missing.append("META_APP_SECRET")

    if missing:
        log.error(f"Missing environment variables: {', '.join(missing)}")
        sys.exit(1)

    # Check expiry
    days_left = check_token_expiry()

    if days_left is None:
        log.info("Token doesn't expire or couldn't check — skipping refresh")
        return

    if days_left < 0:
        log.error("Token is expired! You need to generate a new one manually.")
        log.error("Go to: https://developers.facebook.com/tools/explorer/")
        sys.exit(1)

    if days_left >= REFRESH_THRESHOLD_DAYS:
        log.info(f"Token still has {days_left} days — no refresh needed (threshold: {REFRESH_THRESHOLD_DAYS} days)")
        return

    # Refresh needed
    log.warning(f"Token expires in {days_left} days — refreshing now!")
    new_token = refresh_token()

    if new_token:
        store_token(new_token)

        # Print the new token so GitHub Actions can capture it if needed
        print(f"\n{'='*60}")
        print(f"NEW TOKEN (update your IG_ACCESS_TOKEN secret):")
        print(f"  {new_token[:20]}...{new_token[-10:]}")
        print(f"{'='*60}\n")

        log.info("⚠️  IMPORTANT: Update the IG_ACCESS_TOKEN GitHub Secret with the new token!")
        log.info("   Go to: GitHub repo → Settings → Secrets → IG_ACCESS_TOKEN")
    else:
        log.error("Token refresh failed. Manual intervention needed.")
        sys.exit(1)


if __name__ == "__main__":
    main()

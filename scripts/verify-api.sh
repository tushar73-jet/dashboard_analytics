#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────
# verify-api.sh — Verify Instagram Graph API access
#
# Usage:
#   ./scripts/verify-api.sh <ACCESS_TOKEN>
#
# This script:
#   1. Fetches your Facebook Pages
#   2. Finds the Instagram Business Account linked to each Page
#   3. Fetches basic account info (username, followers, media count)
#
# Prerequisites:
#   - A long-lived access token with permissions:
#     instagram_basic, instagram_manage_insights,
#     pages_show_list, pages_read_engagement
#   - jq installed (brew install jq)
# ──────────────────────────────────────────────────────────────────────

set -euo pipefail

GRAPH_API_VERSION="v21.0"
BASE_URL="https://graph.facebook.com/${GRAPH_API_VERSION}"

# ── Colors ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

print_header() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}  $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
    echo -e "${GREEN}  ✓ $1${NC}"
}

print_error() {
    echo -e "${RED}  ✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}  ℹ $1${NC}"
}

# ── Check dependencies ──
if ! command -v jq &> /dev/null; then
    print_error "jq is required but not installed. Install it with: brew install jq"
    exit 1
fi

if ! command -v curl &> /dev/null; then
    print_error "curl is required but not installed."
    exit 1
fi

# ── Check arguments ──
if [ $# -lt 1 ]; then
    echo ""
    echo -e "${BOLD}Usage:${NC} ./scripts/verify-api.sh <ACCESS_TOKEN>"
    echo ""
    echo "  Get your token from the Graph API Explorer:"
    echo "  https://developers.facebook.com/tools/explorer/"
    echo ""
    exit 1
fi

TOKEN="$1"

# ══════════════════════════════════════════════════════════════════════
# Step 1: Fetch Facebook Pages
# ══════════════════════════════════════════════════════════════════════
print_header "Step 1/3 — Fetching your Facebook Pages"

PAGES_RESPONSE=$(curl -s "${BASE_URL}/me/accounts?access_token=${TOKEN}")

# Check for errors
if echo "$PAGES_RESPONSE" | jq -e '.error' &> /dev/null; then
    ERROR_MSG=$(echo "$PAGES_RESPONSE" | jq -r '.error.message')
    print_error "API Error: ${ERROR_MSG}"
    echo ""
    print_info "Common fixes:"
    print_info "  - Token may have expired. Generate a new one at:"
    print_info "    https://developers.facebook.com/tools/explorer/"
    print_info "  - Make sure you granted pages_show_list permission"
    exit 1
fi

PAGE_COUNT=$(echo "$PAGES_RESPONSE" | jq '.data | length')

if [ "$PAGE_COUNT" -eq 0 ]; then
    print_error "No Facebook Pages found!"
    print_info "Your Instagram Business account must be linked to a Facebook Page."
    print_info "Go to Instagram → Settings → Account → Linked Accounts → Facebook"
    exit 1
fi

print_success "Found ${PAGE_COUNT} Facebook Page(s):"
echo ""
echo "$PAGES_RESPONSE" | jq -r '.data[] | "    📄 \(.name) (ID: \(.id))"'

# ══════════════════════════════════════════════════════════════════════
# Step 2: Find Instagram Business Account for each Page
# ══════════════════════════════════════════════════════════════════════
print_header "Step 2/3 — Finding linked Instagram Business Account(s)"

IG_ACCOUNT_ID=""
IG_FOUND=false

for PAGE_ID in $(echo "$PAGES_RESPONSE" | jq -r '.data[].id'); do
    PAGE_NAME=$(echo "$PAGES_RESPONSE" | jq -r ".data[] | select(.id==\"${PAGE_ID}\") | .name")

    IG_RESPONSE=$(curl -s "${BASE_URL}/${PAGE_ID}?fields=instagram_business_account&access_token=${TOKEN}")

    if echo "$IG_RESPONSE" | jq -e '.instagram_business_account' &> /dev/null; then
        IG_ACCOUNT_ID=$(echo "$IG_RESPONSE" | jq -r '.instagram_business_account.id')
        print_success "Page \"${PAGE_NAME}\" → Instagram Account ID: ${IG_ACCOUNT_ID}"
        IG_FOUND=true
    else
        print_info "Page \"${PAGE_NAME}\" has no linked Instagram account"
    fi
done

if [ "$IG_FOUND" = false ]; then
    echo ""
    print_error "No Instagram Business Account found linked to any of your Pages!"
    print_info "Steps to fix:"
    print_info "  1. Open Instagram app → Settings → Account"
    print_info "  2. Switch to Professional Account (Business or Creator)"
    print_info "  3. Link to your Facebook Page"
    exit 1
fi

# ══════════════════════════════════════════════════════════════════════
# Step 3: Fetch Instagram Account Info
# ══════════════════════════════════════════════════════════════════════
print_header "Step 3/3 — Fetching Instagram Account Info"

ACCOUNT_RESPONSE=$(curl -s "${BASE_URL}/${IG_ACCOUNT_ID}?fields=id,name,username,followers_count,follows_count,media_count,profile_picture_url,biography&access_token=${TOKEN}")

if echo "$ACCOUNT_RESPONSE" | jq -e '.error' &> /dev/null; then
    ERROR_MSG=$(echo "$ACCOUNT_RESPONSE" | jq -r '.error.message')
    print_error "API Error: ${ERROR_MSG}"
    exit 1
fi

USERNAME=$(echo "$ACCOUNT_RESPONSE" | jq -r '.username // "unknown"')
FOLLOWERS=$(echo "$ACCOUNT_RESPONSE" | jq -r '.followers_count // "N/A"')
FOLLOWS=$(echo "$ACCOUNT_RESPONSE" | jq -r '.follows_count // "N/A"')
MEDIA_COUNT=$(echo "$ACCOUNT_RESPONSE" | jq -r '.media_count // "N/A"')
BIO=$(echo "$ACCOUNT_RESPONSE" | jq -r '.biography // "N/A"')

print_success "Connected to @${USERNAME}"
echo ""
echo -e "    ${BOLD}Followers:${NC}   ${FOLLOWERS}"
echo -e "    ${BOLD}Following:${NC}   ${FOLLOWS}"
echo -e "    ${BOLD}Posts:${NC}       ${MEDIA_COUNT}"
echo -e "    ${BOLD}Bio:${NC}        ${BIO}"

# ══════════════════════════════════════════════════════════════════════
# Summary
# ══════════════════════════════════════════════════════════════════════
print_header "✅ API Access Verified!"

echo ""
echo -e "    ${BOLD}Save these values — you'll need them for setup:${NC}"
echo ""
echo -e "    ${CYAN}IG_ACCOUNT_ID${NC}  = ${IG_ACCOUNT_ID}"
echo -e "    ${CYAN}IG_ACCESS_TOKEN${NC} = ${TOKEN:0:20}...${TOKEN: -10}"
echo ""
echo -e "    ${YELLOW}Next step:${NC} Run the ingestion script to pull your posts into the database."
echo ""

# ── Quick test: Fetch one recent post to confirm media access ──
echo -e "${BOLD}  Bonus: Fetching your most recent post...${NC}"
echo ""

MEDIA_RESPONSE=$(curl -s "${BASE_URL}/${IG_ACCOUNT_ID}/media?fields=id,caption,media_type,timestamp,permalink&limit=1&access_token=${TOKEN}")

if echo "$MEDIA_RESPONSE" | jq -e '.data[0]' &> /dev/null; then
    POST_TYPE=$(echo "$MEDIA_RESPONSE" | jq -r '.data[0].media_type')
    POST_TIME=$(echo "$MEDIA_RESPONSE" | jq -r '.data[0].timestamp')
    POST_CAPTION=$(echo "$MEDIA_RESPONSE" | jq -r '.data[0].caption // "No caption"' | head -c 80)
    POST_LINK=$(echo "$MEDIA_RESPONSE" | jq -r '.data[0].permalink')

    echo -e "    ${BOLD}Type:${NC}     ${POST_TYPE}"
    echo -e "    ${BOLD}Posted:${NC}   ${POST_TIME}"
    echo -e "    ${BOLD}Caption:${NC}  ${POST_CAPTION}..."
    echo -e "    ${BOLD}Link:${NC}     ${POST_LINK}"
    echo ""
    print_success "Media endpoint is working — ready to ingest!"
else
    print_info "Could not fetch recent media. Check instagram_basic permission."
fi

echo ""

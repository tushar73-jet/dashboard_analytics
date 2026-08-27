# Instagram Analytics Dashboard

Analytics dashboard for **@fashionpurindia** — an Indian women's fashion brand.

Reads data from the Instagram Graph API, stores metrics in Postgres, and displays actionable insights through a visual dashboard.

## Architecture

```
GitHub Actions (daily cron)  →  Neon Postgres  ←  Vercel Serverless API
                                                        ↓
                                                  React Dashboard
```

## Prerequisites

1. **Instagram Business/Creator account** linked to a Facebook Page
2. **Meta Developer App** with Instagram Graph API product added
3. **Neon** free-tier Postgres database
4. **Vercel** account for hosting
5. **GitHub** account for the cron job

## Quick Setup

### 1. Meta API Access

```bash
# After creating your Meta App and generating a token:
./scripts/verify-api.sh YOUR_ACCESS_TOKEN
```

See the [Implementation Plan](docs/setup-guide.md) for detailed Meta setup steps.

### 2. Database

```bash
# Run the schema against your Neon database
psql $DATABASE_URL -f ingestion/schema.sql
```

### 3. First Ingestion (Manual Test)

```bash
cd ingestion
pip install -r requirements.txt

# Set environment variables
export DATABASE_URL="postgresql://..."
export IG_ACCESS_TOKEN="your-long-lived-token"
export IG_ACCOUNT_ID="your-ig-business-account-id"

python ingest.py
```

### 4. Dashboard (Local Development)

```bash
cd web
npm install
npm run dev
# Open http://localhost:3000
```

### 5. GitHub Actions

Add these secrets to your GitHub repo (Settings → Secrets → Actions):

| Secret | Description |
|--------|-------------|
| `DATABASE_URL` | Neon Postgres connection string |
| `IG_ACCESS_TOKEN` | Long-lived Facebook/Instagram token |
| `IG_ACCOUNT_ID` | Instagram Business Account ID |
| `META_APP_ID` | Meta App ID (for token refresh) |
| `META_APP_SECRET` | Meta App Secret (for token refresh) |

### 6. Deploy to Vercel

1. Connect this GitHub repo to Vercel
2. Set the root directory to `web/`
3. Add `DATABASE_URL` as an environment variable
4. Deploy!

## Project Structure

```
├── ingestion/                 # Python ingestion scripts
│   ├── ingest.py              # Daily data pull from Instagram API
│   ├── refresh_token.py       # Token refresh logic
│   ├── schema.sql             # Database schema
│   └── requirements.txt       # Python dependencies
├── web/                       # Next.js dashboard app
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/           # Serverless API routes
│   │   │   ├── page.tsx       # Dashboard page
│   │   │   └── layout.tsx     # Root layout
│   │   ├── components/        # React components
│   │   └── lib/               # Database client, helpers
│   └── package.json
├── .github/workflows/
│   └── daily-ingest.yml       # Daily cron job
└── scripts/
    └── verify-api.sh          # API access verification
```

## Token Management

Long-lived tokens expire every ~60 days. The daily cron job checks token health and auto-refreshes when expiry is <14 days away. If refresh fails, check the GitHub Actions logs and manually generate a new token from the [Graph API Explorer](https://developers.facebook.com/tools/explorer/).

## License

Private — internal analytics tool for Fashion Pur India.

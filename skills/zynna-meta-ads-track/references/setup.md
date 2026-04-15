# Setup: zynna-meta-ads-track

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `META_ACCESS_TOKEN` | Yes | Meta Marketing API access token |
| `META_AD_ACCOUNT_ID` | Yes | Format: `act_<number>` |

## Getting Your Credentials

### META_ACCESS_TOKEN
1. Go to [Meta Business Suite](https://business.facebook.com)
2. → Settings → Integrations → Marketing API
3. Create or select an app with `ads_read` permission
4. Generate a never-expiring (or long-lived) access token

### META_AD_ACCOUNT_ID
1. Meta Business Suite → Settings → Account information
2. Copy the Ad Account ID in format `act_XXXXXXXXXX`

## Quick Setup

```bash
export META_ACCESS_TOKEN="your-marketing-api-token"
export META_AD_ACCOUNT_ID="act_1234567890"
```

## Meta API Permissions Required

- `ads_read` — read ad performance data
- For purchase/conversion events: `ads_management` + pixel configured

## Rate Limits

- Default: 600 calls/hour per app
- Insights queries: respect the 90-day window
- On rate limit: skill retries once after 60s

## Testing

```bash
META_ACCESS_TOKEN="your-token" META_AD_ACCOUNT_ID="act_1234567890" \
  node skills/zynna-meta-ads-track/scripts/run.js \
  --run_id "track-001" \
  --target_name "Summer Sale" \
  --level campaign \
  --date_since 2026-04-01 \
  --date_until 2026-04-15
```

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `(#190) token is invalid` | Token expired or revoked | Regenerate in Meta Business Suite |
| `(#100) ... permission` | Missing `ads_read` | Add permission to your app |
| `No ad data found` | Wrong date range or account | Check `META_AD_ACCOUNT_ID` and dates |

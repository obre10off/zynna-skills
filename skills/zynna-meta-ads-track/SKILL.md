---
name: zynna-meta-ads-track
version: "1.0.0"
description: "Meta Ads — Track: Pull ad performance metrics from Meta Ads Manager via the Meta Marketing API. Enter campaign/ad set/ad creative name and date range; get spend, impressions, clicks, CTR, CPM, and CPA. Instant setup — no app distribution required."
license: Internal
compatibility: "Codex, Claude Code, OpenClaw-compatible skill runners. Requires Meta Marketing API access token."
metadata:
  openclaw:
    requires:
      env:
        - META_ACCESS_TOKEN
        - META_AD_ACCOUNT_ID
      bins:
        - node
    primaryEnv: META_ACCESS_TOKEN
  author: zynna
  tags:
    - meta
    - facebook
    - ads
    - metrics
    - track
  triggers:
    - "check meta ad performance"
    - "meta ads metrics"
    - "facebook ad analytics"
    - "meta campaign stats"
    - "track meta ad spend"
---

# zynna-meta-ads-track

UI Label: Meta Ads — Track

## What this skill does

Queries the Meta Marketing API for ad performance data: impressions, spend, clicks, CTR, CPM, and CPA. User provides campaign/ad set/creative name and date range. Results written to `outputs/`.

This is **Path B** — instant setup, no app distribution, no MDM complexity.

## Prerequisites

- `META_ACCESS_TOKEN` — Meta Marketing API access token (from Meta Business Suite → Settings → Integrations → Marketing API)
- `META_AD_ACCOUNT_ID` — Ad account ID in format `act_<number>`

## Constraints

- Uses Meta Marketing API v19.0
- Date range: last 90 days max per query (Meta API limit)
- Fields fetched: `impressions`, `reach`, `spend`, `clicks`, `ctr`, `cpc`, `cpm`, `cpp`, `actions`, `action_values`
- Level: campaign → adset → ad (user specifies target level)

## Workflow

1. Validate env vars (`META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`)
2. Determine query level: campaign, adset, or ad (from user input or default to campaign)
3. Fetch campaign list to resolve user-provided name to ID
4. Query insights for specified date range and level
5. Write outputs:
   - `outputs/metrics.json` — machine-readable results
   - `outputs/metrics.md` — human-readable summary

## Output Schema (metrics.json)

```json
{
  "version": "1.0",
  "query": {
    "level": "campaign|adset|ad",
    "target_name": "<user-provided name>",
    "date_preset": "<meta preset>",
    "date_range": { "since": "<date>", "until": "<date>" }
  },
  "results": [
    {
      "id": "<meta id>",
      "name": "<string>",
      "impressions": <int>,
      "reach": <int>,
      "spend": <float>,
      "clicks": <int>,
      "ctr": <float>,
      "cpc": <float>,
      "cpm": <float>,
      "cpa": <float|null>,
      "actions": { "purchase": <int|null>, "lead": <int|null> }
    }
  ],
  "summary": {
    "total_spend": <float>,
    "total_impressions": <int>,
    "total_clicks": <int>,
    "avg_ctr": <float>,
    "avg_cpm": <float>
  },
  "fetched_at": "<ISO timestamp>"
}
```

## Error Handling

- Token invalid → print instructions for regenerating access token
- Campaign name not found → show list of available campaigns and prompt for selection
- Date range > 90 days → auto-adjust to 90 days and warn
- API rate limit → wait 60s and retry once; fail with clear message

## Recovery

Store `last_run.json` with query params. If user runs again with same params, confirm before re-fetching.

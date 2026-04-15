---
name: zynna-meta-ads-generate
version: "1.0.0"
description: "Meta Ads — Generate: Create ad creative assets (images, video scripts, copy, UTM-tagged links) packaged for manual upload to Meta Ads Manager. Zero API integration required — ship today."
license: Internal
compatibility: "Codex, Claude Code, OpenClaw-compatible skill runners. Requires network access to Zynna API."
metadata:
  openclaw:
    requires:
      env: []
      bins:
        - node
    primaryEnv: ZYNNA_SKILLS_API_KEY
  author: zynna
  tags:
    - meta
    - facebook
    - ads
    - creative
    - generate
  triggers:
    - "generate meta ad"
    - "create facebook ad creative"
    - "make ad assets for meta"
    - "meta ad package"
---

# zynna-meta-ads-generate

UI Label: Meta Ads — Generate

## What this skill does

Generates a complete Meta ad creative package: images/video, headline, body copy, CTA, and UTM-tagged destination URL. The package is written to `outputs/` as a handoff artifact — user uploads manually to Ads Manager.

This is **Path B** — ships today, no Meta API review required.

## Constraints

- Output format: ready-to-upload handoff artifact (not API publish)
- Always generate UTM parameters for manual attribution
- Image generation via Zynna image API; fall back to script + copy if image API unavailable
- Output platform target: Meta Feed (1:1 and 4:5 aspect ratios)

## Workflow

1. Collect: product name, target audience, offer/CTA, destination URL
2. Estimate credits via Zynna estimate endpoint
3. Generate: primary image + optional variation images, headline, body copy, suggested CTA
4. Build UTM-tagged URL: `utm_source=facebook&utm_medium=social&utm_campaign=<slug>`
5. Write outputs:
   - `outputs/ad_package.json` — machine-readable handoff
   - `outputs/ad_package.md` — human-readable summary for upload

## Output Schema (ad_package.json)

```json
{
  "version": "1.0",
  "platform": "meta",
  "creative": {
    "primary_image_url": "<signed Zynna URL or null>",
    "variations": [],
    "headline": "<string>",
    "body_copy": "<string>",
    "cta_label": "<string>"
  },
  "links": {
    "destination_url": "<original URL with UTMs appended>",
    "utm_params": {
      "utm_source": "facebook",
      "utm_medium": "social",
      "utm_campaign": "<slug>"
    }
  },
  "metadata": {
    "product": "<string>",
    "audience": "<string>",
    "generated_at": "<ISO timestamp>"
  }
}
```

## Recovery

If user has an existing `run_id`, resume from estimate step. Do not regenerate already-succeeded assets.

## Error Handling

- Estimate fails → print cost warning, ask user to confirm before generating
- Image generation fails → deliver script + copy only with a note that images need manual sourcing
- If Zynna API key missing → exit with auth setup instructions

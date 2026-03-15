---
name: zynna-recreate-video
version: "1.0.0"
description: Recreate a reference TikTok concept for a new product/angle by reusing analyze artifacts and producing a structured recreate handoff artifact.
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
    - tiktok
    - recreate
    - remix
  triggers:
    - "recreate this TikTok"
    - "rewrite this for my product"
    - "make a similar version"
---

# zynna-recreate-video

## Constraints
- Platform: TikTok only.
- No 1:1 copying.
- Use this as a bridge between analysis and generation.

## Workflow
1. Reuse `zynna-analyze-video` for reference extraction.
2. Write `outputs/recreate_source.json` containing:
- source TikTok URL
- constraints (`angle`, `brand`, `style`)
- linked analyze run and result payload
3. Use the artifact in conversation to produce rewritten script/storyboard.

## Handoff
If user approves the rewritten direction, hand off to `zynna-generate-video` without asking them to restate the brief.

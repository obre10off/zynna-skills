---
name: zynna-analyze-video
version: "1.0.0"
description: Analyze a TikTok video via Zynna Open Skills API and produce structured artifacts (transcript, vision scenes, machine-readable result) for follow-up recreation and generation workflows.
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
    - analysis
    - script-breakdown
    - storyboard
  triggers:
    - "analyze this TikTok"
    - "break down this video"
    - "show original script"
---

# zynna-analyze-video

## Constraints
- Platform: TikTok only.
- Source API: `POST /api/open/skills/analyze`.
- Keep user-facing responses non-technical by default.
- Write deterministic artifacts under `.artifacts/<run_id>/...`.

## Workflow
1. Create run folder and standard subdirectories.
2. Call analyze endpoint with `tiktok_url`.
3. Persist:
- `input/video_details.json`
- `transcript/transcript.json`
- `transcript/transcript.txt`
- `vision/vision.json`
- `outputs/result.json`

## Handoff
After analysis, guide users toward:
- `zynna-recreate-video` when they want an adapted version.
- `zynna-generate-video` when they want final generation.

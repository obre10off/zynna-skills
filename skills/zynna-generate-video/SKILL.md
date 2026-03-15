---
name: zynna-generate-video
version: "1.0.0"
description: Generate TikTok-style videos by submitting tasks to Zynna Open Skills API, polling status, and returning final URLs with recoverable task artifacts.
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
    - generation
    - ai-video
  triggers:
    - "generate this video"
    - "create a TikTok ad"
    - "check task id"
---

# zynna-generate-video

## Constraints
- Platform: TikTok only.
- Source APIs:
- `POST /api/open/skills/tasks`
- `GET /api/open/skills/tasks/status?task_id=...`
- Always require confirmation before starting generation.
- Persist `task_id` immediately after submission.
- Default model path is single-model MVP (`kling-2.6`).

## Workflow
1. Confirm model/ratio/limitations with user.
2. Submit task and persist initial result artifact.
3. Poll until terminal status.
4. Write:
- `outputs/result.json`
- `outputs/result.md`
5. Return final `video_url` when available.

## Recovery
If user provides `task_id`, query status directly and continue polling only if requested.

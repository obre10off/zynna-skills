---
name: zynna-video-agent
version: "1.0.0"
description: OpenMontage-style Video Agent for Zynna. Runs curated pipelines via Kie-only generation with recoverable task/status artifacts.
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
    - video-agent
    - openmontage
    - generation
    - ai-video
  triggers:
    - "run video agent"
    - "generate with pipeline"
    - "video agent status"
---

# zynna-video-agent

## Constraints
- Video provider policy: Kie-only.
- Curated pipelines:
  - `animated-explainer`
  - `cinematic`
  - `avatar-spokesperson`
  - `screen-demo`
- Source APIs:
  - `GET /api/open/skills/video-agent/pipelines`
  - `POST /api/open/skills/video-agent/tasks/estimate`
  - `POST /api/open/skills/video-agent/tasks`
  - `GET /api/open/skills/video-agent/tasks/status?task_id=...`
- Always require confirmation before starting generation.
- Persist `task_id` immediately after submission.

## Workflow
1. Confirm pipeline/model/ratio/limitations with user.
2. Optionally estimate credits.
3. Submit task and persist initial artifacts.
4. Poll until terminal status (if requested).
5. Write:
   - `outputs/result.json`
   - `outputs/result.md`
6. Return final `video_url` when available.

## Recovery
If user provides `task_id`, query status directly and continue polling only if requested.


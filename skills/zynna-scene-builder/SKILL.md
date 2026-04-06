---
name: zynna-scene-builder
version: "1.0.0"
description: "Story Scenes: build multi-scene UGC/TikTok videos by submitting scene projects to Zynna Open Skills API, optionally running full generation and returning final stitched output URL."
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
    - scene-builder
    - ugc
    - storyboard
    - multi-scene
  triggers:
    - "build scene project"
    - "generate multi scene video"
    - "scene builder"
---

# zynna-scene-builder

UI Label: Story Scenes

## Constraints
- Platform target: TikTok style output.
- Source APIs:
- `POST /api/open/skills/scene-builder/tasks/estimate`
- `POST /api/open/skills/scene-builder/tasks`
- `GET /api/open/skills/scene-builder/tasks/status?task_id=...`
- Use deterministic artifacts and persist task IDs for recovery.

## Workflow
1. Collect project name and ordered scenes.
2. Estimate credits first; stop if estimate fails.
3. Submit scene-builder task.
4. Persist `task_id` immediately.
5. Poll status until terminal state when generation is requested.
6. Write:
- `outputs/result.json`
- `outputs/result.md`

## Recovery
If user already has `task_id`, check status and continue polling only if requested.

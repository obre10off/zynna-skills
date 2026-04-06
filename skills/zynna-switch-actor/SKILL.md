---
name: zynna-switch-actor
version: "1.0.0"
description: "Character Swap: replace an actor in a source video while preserving motion/timing by submitting a switch-actor task to Zynna Open Skills API and polling for the final output URL."
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
    - switch-actor
    - face-replacement
    - video-remix
  triggers:
    - "switch actor"
    - "replace actor in this video"
    - "change person in video"
---

# zynna-switch-actor

UI Label: Character Swap

## Constraints
- Source APIs:
- `POST /api/open/skills/switch-actor/tasks/estimate`
- `POST /api/open/skills/switch-actor/tasks`
- `GET /api/open/skills/switch-actor/tasks/status?task_id=...`
- Require confirmation before launching paid/high-cost transformation tasks.

## Workflow
1. Gather source video URL + new actor image URL.
2. Estimate credits first; stop if estimate fails.
3. Submit task and persist `task_id` immediately.
4. Poll until `succeeded` or `failed`.
5. Write:
- `outputs/result.json`
- `outputs/result.md`

## Recovery
Support checking an existing `task_id` without forcing user to re-enter full input.

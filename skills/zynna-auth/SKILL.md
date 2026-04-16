---
name: zynna-auth
version: "1.0.0"
description: Authenticate Zynna Skills via device login, store local credentials, and enforce API-access plan eligibility (all paid plans by default).
license: Internal
compatibility: "Codex, Claude Code, OpenClaw-compatible skill runners. Requires network access to Zynna auth API."
metadata:
  openclaw:
    requires:
      env: []
      bins:
        - node
    primaryEnv: ZYNNA_BASE_URL
  author: zynna
  tags:
    - auth
    - oauth
    - device-flow
  triggers:
    - "login zynna"
    - "authenticate zynna"
    - "sign in zynna"
---

# zynna-auth

## Purpose
- Run device-login flow for Zynna Skills.
- Save credentials into `~/.zynna/credentials.json`.
- Enforce plan-gating for API access (all paid plans by default).

## Commands
- `node scripts/auth.js login`
- `node scripts/auth.js poll`
- `node scripts/auth.js status`
- `node scripts/auth.js logout`

## Local Dev Defaults
- API backend: `http://localhost:8080`
- Frontend URL: `http://localhost:3000`

These can be overridden via env:
- `ZYNNA_AUTH_API_BASE`
- `ZYNNA_AUTH_WEB_BASE`
- `ZYNNA_DEVICE_INIT_PATH`
- `ZYNNA_DEVICE_TOKEN_PATH`

## Plan Gating
- Accepted plans come from `ZYNNA_ALLOWED_API_PLANS` (default: any paid plan).
- Plan check can be bypassed only for dev via `ZYNNA_AUTH_SKIP_PLAN_CHECK=1`.

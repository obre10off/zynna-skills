# Zynna Skills

Production-ready skills for Zynna video workflows.

Included skills:
- `zynna-auth`
- `zynna-analyze-video`
- `zynna-recreate-video`
- `zynna-generate-video`
- `zynna-scene-builder`
- `zynna-switch-actor`

## One-command install (skills.sh)

```bash
npx skills add obre10off/zynna-skills
```

## Manual local update

```bash
node manage-skills.mjs update
```

## Required environment

```bash
export ZYNNA_BASE_URL="http://localhost:8080"
```

Security defaults:
- Non-local `http://` URLs are blocked by default.
- For explicit insecure override (non-prod only): `ZYNNA_ALLOW_INSECURE_HTTP=1`

## Authentication

You can authenticate once and reuse saved credentials across all skills:

```bash
node skills/zynna-auth/scripts/auth.js login
```

Credential lookup order used by runtime skills:
1. `ZYNNA_SKILLS_API_KEY` (explicit env override)
2. `~/.zynna/credentials.json` (`api_key`)

Credential files are stored with restrictive local permissions (`~/.zynna` and auth files).

Plan-gating defaults:
- API access requires `business` plan by default
- Override accepted plans with `ZYNNA_ALLOWED_API_PLANS` (comma-separated)
- Dev bypass only: `ZYNNA_AUTH_SKIP_PLAN_CHECK=1`

## Smoke test

```bash
node skills/tests/e2e_smoke.cjs
```

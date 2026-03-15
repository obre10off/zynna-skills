# Zynna Skills

Production-ready skills for Zynna video workflows.

Included skills:
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
export ZYNNA_SKILLS_API_KEY="..."
export ZYNNA_BASE_URL="http://localhost:8080"
```

## Smoke test

```bash
node skills/tests/e2e_smoke.cjs
```

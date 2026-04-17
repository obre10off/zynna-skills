# Setup: zynna-meta-ads-generate

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `ZYNNA_SKILLS_API_KEY` | Yes | Zynna Open Skills API key |
| `ZYNNA_BASE_URL` | No | Default: `http://localhost:8080` |

## Quick Auth

```bash
# Option 1: set env var
export ZYNNA_SKILLS_API_KEY="your-key-here"

# Option 2: use the auth skill
node skills/zynna-auth/scripts/auth.js login
```

## Zynna API Endpoints Used

- `POST /api/open/skills/image/tasks/estimate` — credit estimation
- `POST /api/open/skills/image/tasks` — submit image generation
- `GET /api/open/skills/image/tasks/status?task_id=...` — poll status

## Testing

```bash
node skills/zynna-meta-ads-generate/scripts/run.js \
  --run_id "test-001" \
  --product "Acme Protein Bar" \
  --audience "fitness enthusiasts 25-40" \
  --offer "20% off first order" \
  --destination_url "https://example.com/shop"
```

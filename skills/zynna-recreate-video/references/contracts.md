# Zynna Skills Contracts

All runs write artifacts under:

`.artifacts/<run_id>/`

Recommended structure:

```
<run_id>/
  input/
  transcript/
  vision/
  outputs/
  logs/
```

Each skill writes a machine-readable output:
- Analyze: `outputs/result.json`
- Recreate: `outputs/recreate_source.json`
- Generate: `outputs/result.json`

Common JSON fields:

```json
{
  "run_id": "...",
  "skill": "zynna-analyze-video|zynna-recreate-video|zynna-generate-video",
  "platform": "tiktok"
}
```

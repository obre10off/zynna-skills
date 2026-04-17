# Zynna Video Agent Contracts

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

Primary APIs:
- `GET /api/open/skills/video-agent/pipelines`
- `POST /api/open/skills/video-agent/tasks/estimate`
- `POST /api/open/skills/video-agent/tasks`
- `GET /api/open/skills/video-agent/tasks/status?task_id=...`

Common JSON fields:

```json
{
  "run_id": "...",
  "skill": "zynna-video-agent",
  "pipeline_id": "animated-explainer|cinematic|avatar-spokesperson|screen-demo"
}
```


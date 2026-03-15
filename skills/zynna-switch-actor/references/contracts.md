# Zynna Skills Contracts

All runs write artifacts under:

`.artifacts/<run_id>/`

Suggested structure:

```
<run_id>/
  input/
  transcript/
  vision/
  outputs/
  logs/
```

Task-style skills should always persist `task_id` in `outputs/result.json` so users can recover interrupted runs.

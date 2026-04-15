# Common Rules

Use these rules across Zynna skills unless a specific skill overrides them.

## Skill Handoff
- Infer intent from natural user requests; user does not need to name the skill.
- Carry forward confirmed context to avoid repeated input.
- Prefer flow: analyze -> recreate -> generate.

## 401 Unauthorized
- Explain the API key is missing/invalid.
- Tell user to run `node skills/zynna-auth/scripts/auth.js login` or set `ZYNNA_SKILLS_API_KEY`.
- Mention API access requires eligible plan (`business` by default).
- Keep error guidance practical and brief.

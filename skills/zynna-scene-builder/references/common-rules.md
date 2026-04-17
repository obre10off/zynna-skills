# Common Rules

Use these rules across Zynna skills unless a specific skill overrides them.

## Skill Handoff
- Infer intent from user language.
- Carry forward confirmed context to avoid repeated input.

## 401 Unauthorized
- Explain key is missing/invalid.
- Ask user to run `node skills/zynna-auth/scripts/auth.js login` or set `ZYNNA_SKILLS_API_KEY`.
- Mention API access requires an eligible paid plan by default.

# Project guideline

Keep this project small and simple. Add only what is absolutely necessary for the current agreed task.

- Do not build for hypothetical future requirements.
- Do not add speculative features, dependencies, abstractions, infrastructure, documentation, or tooling.
- Prefer the simplest implementation that meets the current requirements.
- Keep explanations and plans concise and concrete.
- Include only the security measures and verification necessary for the current work.

## Git workflow

- Keep `main` working. Use a short-lived `codex/<description>` branch for meaningful changes; small documentation fixes can go directly to `main`.
- Make focused commits with concise, imperative messages describing the change.
- Before committing, run `npm run check` and review the diff. Check UI changes in the browser too.
- Never commit `.env`, API keys, or generated build files.
- Open a pull request explaining the change, why it is needed, and how it was verified. Include a screenshot for visible UI changes and note any material limitations.
- Squash-merge after the checks pass, using a descriptive title. Delete the feature branch and update local `main` afterward.

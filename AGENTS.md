# Project guideline

Keep this project small and simple. Add only what is absolutely necessary for the current agreed task.

- Do not build for hypothetical future requirements.
- Do not add speculative features, dependencies, abstractions, infrastructure, documentation, or tooling.
- Prefer the simplest implementation that meets the current requirements.
- Reuse existing code where appropriate. Add dependencies or abstractions only when the current change has a concrete need for them.
- Keep changes focused; avoid unrelated refactoring, duplicate logic, and configuration for hypothetical use cases.
- Keep explanations and plans concise and concrete.
- Keep public documentation, comments, commit messages, and pull requests factual and focused on the software.
- Include only the security measures and verification necessary for the current work.

## Development workflow

- Agree on the scope and expected behavior before substantial implementation work.
- Keep `main` working. Make all changes through pull requests from short-lived `codex/<description>` branches, including documentation fixes.
- Make focused commits with concise, imperative messages describing the change.
- Before committing, run `npm run check` and review the diff. Check UI changes in the browser too.
- Never commit `.env`, API keys, private information, or generated build files.
- Use `.github/pull_request_template.md` to describe the change, verification, and review outcome. Include a screenshot for visible UI changes.
- Update relevant existing documentation when a change affects setup, commands, or behavior. Reviewers should verify that it remains accurate.
- For meaningful code changes, delegate a review of the proposed commit to a separate agent with fresh context. Provide the requirements, base and head commits, and repository instructions. The reviewer must not edit files. Small documentation-only changes may use self-review.
- Verify review findings, resolve blocking issues, and rerun affected checks after fixes. Request another review of significant code changes made after review.
- Before merging, confirm CI passes for the latest revision and present the verification and review results to the repository owner.
- Merge a pull request only after the repository owner explicitly approves merging the current revision. Approval to implement work or open a PR is not merge approval. New commits require renewed merge approval.
- Squash-merge with a descriptive title, delete the feature branch, and update local `main` afterward.

## Code review

- Compare the complete diff against the agreed requirements and inspect relevant surrounding code.
- Trace important behavior from input to output, including boundary conditions, external input validation, and failure handling.
- Check that each new dependency, abstraction, configuration option, and file serves a current requirement. Flag concrete duplication or unnecessary complexity, and suggest the smallest sufficient alternative.
- Check that tests verify observable behavior and meaningful failure cases. Flag unjustified changes that weaken tests, linting, or CI.
- Report actionable findings with file locations, impact, and supporting evidence or a reproducible scenario. Distinguish blocking issues from optional suggestions; avoid speculative requirements and stylistic preferences already handled by tooling.
- Record the review outcome and any remaining limitations. Passing tests or an agent review alone does not establish correctness.

# Issue tracker: GitHub

Issues and PRDs for this repository live in the GitHub Issues tracker for `SYSUMotionVerse/frontend`. Use the `gh` CLI for issue operations from this repository.

## Conventions

- Create issues with `gh issue create`.
- Read an issue and its discussion with `gh issue view <number> --comments`.
- List and filter issues with `gh issue list` and structured JSON output where appropriate.
- Add comments with `gh issue comment <number>`.
- Apply or remove labels with `gh issue edit <number> --add-label <label>` and `--remove-label <label>`.
- Close issues with `gh issue close <number>` and include a concise completion comment.
- Infer the repository from the `origin` Git remote when commands run inside this clone.

## Pull requests as a triage surface

External pull requests are not a triage request surface. Do not include them in issue triage queues or apply issue-state labels to them automatically.

## Skill terminology

When an engineering skill says to publish to the issue tracker, create a GitHub issue in `SYSUMotionVerse/frontend`. When it says to fetch a ticket, read the full GitHub issue body, labels, and comments.

GitHub shares one number space across issues and pull requests. Resolve ambiguous references before making changes.

## Dependencies and parent relationships

- Prefer GitHub sub-issues for parent-child relationships when the repository supports them.
- Prefer GitHub native issue dependencies for blocking relationships when available.
- If either feature is unavailable, reference the parent and blockers explicitly in the issue body.
- Publish blockers before blocked issues so later issues can reference real issue numbers.

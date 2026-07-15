# Domain documentation

This repository uses a single-context domain documentation layout.

## Before exploring

Read the following when they exist and are relevant:

- `CONTEXT.md` at the repository root for the domain glossary and model boundaries.
- ADRs under `docs/adr/` for architectural decisions that affect the area being changed.

If these files do not exist, proceed without treating their absence as an error. Create or expand them when domain-modeling work resolves real terms or architectural decisions; do not create empty placeholders.

## Use the glossary vocabulary

Use terms from `CONTEXT.md` consistently in issue titles, PRDs, implementation plans, tests, and code. Do not introduce synonyms for concepts the glossary already defines.

If a needed concept is absent, first determine whether existing vocabulary already covers it. Record a new term only when it represents a real domain distinction.

## Architectural decisions

Check relevant ADRs before proposing or implementing changes. If a proposal contradicts an ADR, surface the conflict explicitly rather than silently overriding the recorded decision.

## Integration boundary

This repository is the student WeChat Mini Program frontend. The backend is maintained in a separate repository and should be described as an external integration boundary rather than as another context inside this repository.

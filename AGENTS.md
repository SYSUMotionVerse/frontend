# Repository Guidelines

## Project Structure & Module Organization

This repository is a `uni-app + Vue 3 + TypeScript` frontend targeting WeChat Mini Program. Keep application code in `src/`, with shared UI in `src/components/`, reusable state and helpers in `src/composables/`, business logic in `src/domain/` and `src/features/`, and mini-program runtime pages in `src/uni-app/pages/**`. Put tests in `src/tests/*.spec.ts`. Treat `docs/` as design and planning notes, `openspec/` as change proposals and tasks, and `dist/` as generated build output.

## Build, Test, and Development Commands

Install dependencies with `pnpm install`. Run local development with `pnpm dev` or `pnpm dev:mp-weixin`; both start the WeChat Mini Program target. Create a production bundle with `pnpm build` or `pnpm build:mp-weixin`, which outputs to `dist/build/mp-weixin`. Run the automated checks with `pnpm test` (`vitest run`). There is no dedicated lint script in `package.json`, so rely on TypeScript, Vitest, and editor diagnostics before opening a PR.

## Coding Style & Naming Conventions

Match the existing codebase: use 2-space indentation, single quotes, and no semicolons. Prefer Vue 3 Composition API with `<script setup lang="ts">` for `.vue` files. Name composables as `useXxx`, component files in PascalCase such as `TrainingHomeHeader.vue`, and test files as `*.spec.ts`. Keep styling close to components when needed, and reuse UnoCSS shortcuts from `uno.config.ts` before adding new utility patterns.

## Testing Guidelines

Vitest is the test runner, with `jsdom` configured in `vite.config.ts`. Add or update spec files under `src/tests/` when routes, shared state, or page behavior changes. Follow the current naming pattern, for example `trainingFlow.spec.ts` or `registrationForm.spec.ts`. Favor behavior-focused assertions over snapshot-heavy tests.

## Commit & Pull Request Guidelines

Recent history uses Conventional Commit prefixes such as `feat:`, `refactor:`, `test:`, and `docs:`. Keep commits small and scoped to one change. PRs should explain the user-facing change, list affected pages or flows, link the relevant issue or OpenSpec change when available, and include screenshots or recordings for UI updates.

## Agent-Specific Notes

If you are working through an agent workflow, read the repository instructions first. This repo currently requires the superpowers bootstrap command and uses `openspec/` for spec-driven change management.

Before making changes, read `README.md` and `docs/agent-development.md`. Treat `docs/agent-development.md` as the operational handbook for this repository.

### Required Agent Workflow

1. Run the superpowers bootstrap command required by this repo.
2. Read `README.md` and `docs/agent-development.md`.
3. Install dependencies with `pnpm install` if they are not already present.
4. Use `pnpm dev` for local WeChat Mini Program development.
5. When validating UI in WeChat DevTools, import `dist/build/mp-weixin`, not the repository root.
6. When changing business logic, page structure, routes, or shared components, run:
   - `pnpm test`
   - `npx vue-tsc --noEmit`

### WeChat Mini Program Constraints

- Build for `mp-weixin` first. Do not optimize for generic web-only behavior when it conflicts with mini-program conventions.
- Prefer existing `uni-app` patterns already present in the repository for navigation, forms, layout, and interaction.
- Keep `pnpm dev` running while WeChat DevTools is open so the generated output stays current.
- The generated bundle lives in `dist/build/mp-weixin`.

### WeChat DevTools Notes

- Install WeChat DevTools from the official Weixin developer documentation.
- If local preview is enough, the current default `AppID` can remain in tourist mode.
- If a task requires real-device preview, upload, or restricted platform capabilities, check `src/manifest.json` first. The repository currently defaults to `touristappid`, which is not sufficient for those flows.

### Expected Agent Output

When reporting completion, include:

- The files changed.
- The verification commands run.
- Whether WeChat DevTools confirmation is still needed.
- Whether the result is limited by `touristappid`, missing DevTools, or other platform constraints.

### Reusable Prompt

If you need to hand off work to another agent, start from the prompt included in `README.md` or `docs/agent-development.md` and keep the mini-program constraints intact.

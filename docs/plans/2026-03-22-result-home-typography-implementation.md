# Result And Home Typography Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the questionnaire result page and training home page clearly more readable in the mini program and prevent the home action button from deforming.

**Architecture:** Keep the existing Vue/uni-app composition intact and limit the work to presentational components. Lock the new behavior with a regression spec that asserts the intended class names and button sizing rules.

**Tech Stack:** Vue 3, uni-app, TypeScript, Vitest, Vue Test Utils, UnoCSS utilities

### Task 1: Lock The Intended UI Contract

**Files:**
- Modify: `src/tests/uiReviewFixes.spec.ts`

**Step 1: Write the failing test**

Add an assertion that the result card no longer uses the smaller `text-12`/`text-14` contract for its key supporting copy, and that both web and uni-app training home pages include the stronger button sizing rules.

**Step 2: Run test to verify it fails**

Run: `pnpm test -- src/tests/uiReviewFixes.spec.ts -t "uses larger typography and stable action sizing for miniapp result and home surfaces"`

Expected: FAIL because the old class names and button sizing are still present.

**Step 3: Write minimal implementation**

Update the result card, reminder banner, daily progress card, and both training home view files to use larger text and explicit button sizing.

**Step 4: Run test to verify it passes**

Run: `pnpm test -- src/tests/uiReviewFixes.spec.ts -t "uses larger typography and stable action sizing for miniapp result and home surfaces"`

Expected: PASS

**Step 5: Run broader verification**

Run: `pnpm test`

Expected: PASS

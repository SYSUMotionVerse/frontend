# Training Home Feed Restyle Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the mini-program training home page into a task-driven content feed that combines daily progress, quest completion, learn content, coach notes, and a strong start-training CTA.

**Architecture:** Keep `src/uni-app/pages/training/home.vue` as a thin composition surface that maps `useStudentStore()` state into derived quest and content arrays. Move the header, quest panel, learn cards, and coach cards into focused shared components under `src/components/training/`, while preserving uni-app navigation semantics and the shared floating dock.

**Tech Stack:** Vue 3 `<script setup lang="ts">`, uni-app navigation, scoped CSS, Vitest file-content regression tests, vue-tsc.

### Task 1: Lock the new home-page structure with a failing regression test

**Files:**
- Modify: `src/tests/uiReviewFixes.spec.ts`

**Step 1: Write the failing test**

Add assertions that the training home page:
- imports `TrainingHomeHeader`, `TrainingHomeQuestPanel`, `TrainingHomeFeatureCard`, and `TrainingHomeCoachCard`
- includes the section copy `今日任务`, `边练边学`, `教练角`
- keeps a primary `开始训练` action
- continues exposing a growth navigation target

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/uiReviewFixes.spec.ts -t "rebuilds the training home page as a quest and content feed"`

Expected: FAIL because the current home page still uses `DailyProgressCard`, `ReminderBanner`, and the older two-card layout.

### Task 2: Create focused home-feed components

**Files:**
- Create: `src/components/training/TrainingHomeHeader.vue`
- Create: `src/components/training/TrainingHomeQuestPanel.vue`
- Create: `src/components/training/TrainingHomeFeatureCard.vue`
- Create: `src/components/training/TrainingHomeCoachCard.vue`
- Test: `src/tests/uiReviewFixes.spec.ts`

**Step 1: Write minimal implementation**

Create small presentational components with typed props for:
- profile header
- quest/progress list
- learn/play content cards
- coach note cards

**Step 2: Run targeted test**

Run: `npx vitest run src/tests/uiReviewFixes.spec.ts -t "rebuilds the training home page as a quest and content feed"`

Expected: still FAIL until the home page actually composes them.

### Task 3: Recompose the training home page around the new feed

**Files:**
- Modify: `src/uni-app/pages/training/home.vue`
- Test: `src/tests/uiReviewFixes.spec.ts`

**Step 1: Write minimal implementation**

Update the page to:
- derive profile display data from the student store
- build a quest list from adherence state
- define static learn/play and coach content arrays
- render the new sections in the correct order
- preserve `uni` navigation to training select and growth

**Step 2: Run targeted test**

Run: `npx vitest run src/tests/uiReviewFixes.spec.ts -t "rebuilds the training home page as a quest and content feed"`

Expected: PASS.

### Task 4: Verify regressions and types

**Files:**
- Verify: `src/tests/uiReviewFixes.spec.ts`

**Step 1: Run focused UI regression**

Run: `npx vitest run src/tests/uiReviewFixes.spec.ts`

Expected: PASS.

**Step 2: Run full suite**

Run: `npm test`

Expected: PASS.

**Step 3: Run type checking**

Run: `npx vue-tsc --noEmit`

Expected: PASS.

# Training Playground Restyle Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the mini-program training playground selection page so it matches the provided playful level-card reference while staying within uni-app and mini-program constraints.

**Architecture:** Keep the route view thin and data-driven. `src/uni-app/pages/training/select.vue` owns the page copy, card ordering, offsets, and navigation, while `src/components/training/TrainingModeCard.vue` becomes a focused presentational card that receives level metadata through typed props and emits the chosen training modality upward.

**Tech Stack:** Vue 3 SFCs with `<script setup lang="ts">`, uni-app navigation APIs, scoped CSS, Vitest file-content regression tests.

### Task 1: Lock the new page structure with a failing regression test

**Files:**
- Modify: `src/tests/uiReviewFixes.spec.ts`

**Step 1: Write the failing test**

Add assertions that the training selection page includes:
- the new hero copy `准备开练了吗？`
- the supporting copy `今天想挑战哪一种训练小零食？`
- the streak card copy `再完成 1 次训练，就能点亮 3 天连击。`
- the new level-card structure marker `training-level-card__poster`

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/tests/uiReviewFixes.spec.ts -t "restyles the training playground selection page as a level-based flow"`

Expected: FAIL because the current page and card component still use the older generic card layout.

### Task 2: Rebuild the shared training card as a level card

**Files:**
- Modify: `src/components/training/TrainingModeCard.vue`
- Test: `src/tests/uiReviewFixes.spec.ts`

**Step 1: Write minimal implementation**

Update the card component to:
- accept explicit `duration`, `difficulty`, and `cardIndex` props
- compute modality-specific copy and theme tokens
- render a right-side poster panel, compact meta chips, headline, description, and a full-width rounded CTA
- keep `choose` as the only emitted event

**Step 2: Run targeted test**

Run: `pnpm vitest run src/tests/uiReviewFixes.spec.ts -t "restyles the training playground selection page as a level-based flow"`

Expected: still FAIL until the page composes the new card and supporting streak block.

### Task 3: Recompose the training select page around the new visual flow

**Files:**
- Modify: `src/uni-app/pages/training/select.vue`
- Test: `src/tests/uiReviewFixes.spec.ts`

**Step 1: Write minimal implementation**

Update the page to:
- define a typed `trainingModes` array with duration and difficulty metadata
- render a lighter hero instead of the old single hero card
- stack the three cards with alternating offsets and soft decorative blocks
- add a bottom streak encouragement card

**Step 2: Run targeted test**

Run: `pnpm vitest run src/tests/uiReviewFixes.spec.ts -t "restyles the training playground selection page as a level-based flow"`

Expected: PASS.

### Task 4: Verify the broader regression surface

**Files:**
- Verify: `src/tests/uiReviewFixes.spec.ts`

**Step 1: Run focused regression suite**

Run: `pnpm vitest run src/tests/uiReviewFixes.spec.ts`

Expected: PASS.

**Step 2: Run full test suite**

Run: `pnpm test`

Expected: PASS.

# Student Miniapp Core Flow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Build a runnable Vue 3 + TypeScript student-app prototype that implements the OpenSpec student Mini Program core flow, including onboarding, questionnaire gating, training sessions, adherence tracking, feedback, and growth views.

**Architecture:** Use a thin route-view layer backed by a shared student-app composable that owns registration, checkpoint, session, and adherence state. Route guards enforce profile and questionnaire gating, while feature components keep registration, questionnaire, home, training, feedback, and growth UI responsibilities separate.

**Tech Stack:** Vue 3, Vue Router, TypeScript, Vite, Vitest, UnoCSS

### Task 1: Scaffold app shell and test harness

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `uno.config.ts`
- Create: `index.html`
- Create: `src/main.ts`
- Create: `src/App.vue`
- Create: `src/styles.css`
- Test: `src/tests/studentApp.spec.ts`

**Step 1: Write the failing test**

Add route-gating and adherence expectations to `src/tests/studentApp.spec.ts`.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/tests/studentApp.spec.ts`

Expected: FAIL because app state, router, and views do not exist yet.

**Step 3: Write minimal implementation**

Create the Vite + Vue + UnoCSS foundation, router shell, and placeholder shared state.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/tests/studentApp.spec.ts`

Expected: target assertions for the implemented slice pass.

### Task 2: Implement onboarding and checkpoint gating

**Files:**
- Create: `src/types/student.ts`
- Create: `src/composables/useStudentAppState.ts`
- Create: `src/views/RegistrationPage.vue`
- Create: `src/views/LongQuestionnairePage.vue`
- Create: `src/views/QuestionnaireResultPage.vue`
- Create: `src/components/onboarding/RegistrationForm.vue`
- Create: `src/components/questionnaires/LongQuestionnaireForm.vue`
- Create: `src/components/questionnaires/QuestionnaireResultCard.vue`
- Modify: `src/router/index.ts`
- Test: `src/tests/studentApp.spec.ts`

**Step 1: Write the failing test**

Add expectations for first-time users, incomplete profile users, and week 4/8/12 checkpoint users being redirected before training.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/tests/studentApp.spec.ts --reporter=dot`

**Step 3: Write minimal implementation**

Add registration fields, questionnaire checkpoints, scoring summaries, and route guards.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/tests/studentApp.spec.ts --reporter=dot`

### Task 3: Implement training, adherence, and reminder flows

**Files:**
- Create: `src/views/HomePage.vue`
- Create: `src/views/TrainingSelectionPage.vue`
- Create: `src/views/GuidedTrainingPage.vue`
- Create: `src/views/ShortQuestionnairePage.vue`
- Create: `src/views/FeedbackPage.vue`
- Create: `src/components/home/DailyProgressCard.vue`
- Create: `src/components/home/WeeklyAdherenceCard.vue`
- Create: `src/components/home/ReminderBanner.vue`
- Create: `src/components/training/TrainingModeCard.vue`
- Create: `src/components/training/VisualTrainingPanel.vue`
- Create: `src/components/training/StairTrainingPanel.vue`
- Create: `src/components/questionnaires/ShortQuestionnaireForm.vue`
- Create: `src/components/feedback/SessionFeedbackCard.vue`
- Modify: `src/composables/useStudentAppState.ts`
- Test: `src/tests/studentApp.spec.ts`

**Step 1: Write the failing test**

Add expectations for capped daily check-ins, weekly adherence, reminder eligibility, and guided-session completion independent of quality scores.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/tests/studentApp.spec.ts --reporter=dot`

**Step 3: Write minimal implementation**

Add home progress UI, modality selection, guided sessions, short questionnaire handoff, and completion recording rules.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/tests/studentApp.spec.ts --reporter=dot`

### Task 4: Implement growth center and end-to-end verification

**Files:**
- Create: `src/views/GrowthCenterPage.vue`
- Create: `src/components/growth/GrowthSummaryCharts.vue`
- Create: `src/components/growth/AdherenceHeatmap.vue`
- Create: `src/components/growth/AchievementBadgeStrip.vue`
- Create: `src/components/growth/PhysicalMetricsPanel.vue`
- Modify: `src/composables/useStudentAppState.ts`
- Modify: `src/tests/studentApp.spec.ts`
- Modify: `openspec/changes/student-miniapp-core-flow/tasks.md`

**Step 1: Write the failing test**

Add expectations for growth summaries, empty metric states, and the full flow from first launch through training completion and reminder return.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/tests/studentApp.spec.ts --reporter=dot`

**Step 3: Write minimal implementation**

Add growth charts, badge views, physical-metric conditional rendering, and mark completed OpenSpec tasks.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/tests/studentApp.spec.ts --reporter=dot`

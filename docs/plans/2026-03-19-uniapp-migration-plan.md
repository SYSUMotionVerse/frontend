# Student Miniapp Uni-App Migration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Migrate the current Vite/Vue student-app prototype into a real `uni-app + Vue 3 + TypeScript` Mini Program codebase without losing the verified student flows, state model, and test coverage.

**Architecture:** Keep the verified domain model and flow logic, but replace the web-specific shell with a `uni-app` app shell, `pages.json` routing, and platform-compatible page/component structure. Separate migration into three layers: app scaffold, shared domain/state portability, and page-by-page UI/platform adaptation so breakage stays localized.

**Tech Stack:** `uni-app`, Vue 3, TypeScript, UnoCSS with `unocss-preset-weapp`, WeChat Mini Program APIs, Vitest for domain logic, optional uni-compatible component tests later

### Task 1: Create the uni-app application skeleton

**Files:**
- Create: `src/uni-app/main.ts`
- Create: `src/uni-app/App.vue`
- Create: `src/uni-app/manifest.json`
- Create: `src/uni-app/pages.json`
- Create: `src/uni-app/uni.scss`
- Modify: `package.json`
- Modify: `tsconfig.json`
- Modify: `uno.config.ts`
- Test: `src/tests/studentApp.spec.ts`

**Step 1: Write the failing test**

Add a routing/config test that asserts the student route map exists in a uni-app-compatible manifest source instead of only `vue-router`.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/tests/studentApp.spec.ts`

Expected: FAIL because the uni-app route manifest does not exist yet.

**Step 3: Write minimal implementation**

Create the `uni-app` entry files, define the page list in `pages.json`, and keep the existing web prototype runnable only if needed during transition.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/tests/studentApp.spec.ts`

Expected: PASS with the new route manifest present.

### Task 2: Extract framework-agnostic student domain logic

**Files:**
- Create: `src/domain/student/types.ts`
- Create: `src/domain/student/access.ts`
- Create: `src/domain/student/training.ts`
- Create: `src/domain/student/growth.ts`
- Create: `src/domain/student/state.ts`
- Modify: `src/composables/useStudentAppState.ts`
- Modify: `src/features/access/entry.ts`
- Modify: `src/features/training/session.ts`
- Modify: `src/features/growth/summary.ts`
- Test: `src/tests/accessFlow.spec.ts`
- Test: `src/tests/trainingFlow.spec.ts`
- Test: `src/tests/growthFlow.spec.ts`

**Step 1: Write the failing test**

Move one access, one training, and one growth test to import from the new domain layer.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/tests/accessFlow.spec.ts src/tests/trainingFlow.spec.ts src/tests/growthFlow.spec.ts`

Expected: FAIL because the framework-agnostic domain modules do not exist yet.

**Step 3: Write minimal implementation**

Refactor pure routing/gating, adherence, session-completion, and growth-summary logic into domain modules that do not depend on `vue-router`, component instances, or browser APIs.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/tests/accessFlow.spec.ts src/tests/trainingFlow.spec.ts src/tests/growthFlow.spec.ts`

Expected: PASS with the domain logic imported from the new layer.

### Task 3: Introduce a uni-app state adapter

**Files:**
- Create: `src/uni-app/composables/useStudentStore.ts`
- Create: `src/uni-app/composables/useNavigationGuard.ts`
- Modify: `src/composables/useStudentAppState.ts`
- Modify: `src/domain/student/state.ts`
- Test: `src/tests/accessFlow.spec.ts`
- Test: `src/tests/trainingFlow.spec.ts`

**Step 1: Write the failing test**

Add a test that asserts entry gating can be resolved from the portable student state snapshot without `vue-router`.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/tests/accessFlow.spec.ts src/tests/trainingFlow.spec.ts`

Expected: FAIL because the uni-app adapter/store contract is not implemented yet.

**Step 3: Write minimal implementation**

Build a uni-app-facing state adapter that exposes the same actions already proven in tests: complete profile, submit questionnaire, complete session, evaluate reminder eligibility, and resolve next page.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/tests/accessFlow.spec.ts src/tests/trainingFlow.spec.ts`

Expected: PASS with the adapter reading/writing the portable state model.

### Task 4: Migrate access pages into uni-app pages

**Files:**
- Create: `src/uni-app/pages/access/register.vue`
- Create: `src/uni-app/pages/access/questionnaire.vue`
- Create: `src/uni-app/pages/access/questionnaire-result.vue`
- Create: `src/uni-app/components/access/*`
- Modify: `src/views/access/RegistrationPage.vue`
- Modify: `src/views/access/LongQuestionnairePage.vue`
- Modify: `src/views/access/QuestionnaireResultPage.vue`
- Modify: `src/tests/uiReviewFixes.spec.ts`

**Step 1: Write the failing test**

Add a metadata/navigation test that asserts the access pages no longer require `vue-router` push semantics for their primary flow.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/tests/uiReviewFixes.spec.ts`

Expected: FAIL because the access pages still assume web-route navigation.

**Step 3: Write minimal implementation**

Port registration and long-questionnaire pages to uni-app pages, swap navigation to `uni.navigateTo` / `uni.redirectTo`, and keep the form semantics and accessibility metadata already fixed.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/tests/uiReviewFixes.spec.ts`

Expected: PASS for the updated access flow behavior and preserved form metadata.

### Task 5: Migrate training pages and session flow

**Files:**
- Create: `src/uni-app/pages/training/home.vue`
- Create: `src/uni-app/pages/training/select.vue`
- Create: `src/uni-app/pages/training/visual-session.vue`
- Create: `src/uni-app/pages/training/stair-session.vue`
- Create: `src/uni-app/pages/training/short-questionnaire.vue`
- Create: `src/uni-app/pages/training/feedback.vue`
- Create: `src/uni-app/components/training/*`
- Modify: `src/views/training/HomePage.vue`
- Modify: `src/views/training/TrainingSelectionPage.vue`
- Modify: `src/views/training/VisualTrainingPage.vue`
- Modify: `src/views/training/StairTrainingPage.vue`
- Modify: `src/views/training/ShortQuestionnairePage.vue`
- Modify: `src/views/training/FeedbackPage.vue`
- Test: `src/tests/trainingFlow.spec.ts`
- Test: `src/tests/uiReviewFixes.spec.ts`

**Step 1: Write the failing test**

Add a test that verifies home-page primary actions remain link/navigation-semantic equivalents after moving off web `RouterLink`.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/tests/trainingFlow.spec.ts src/tests/uiReviewFixes.spec.ts`

Expected: FAIL because navigation is still web-router-specific.

**Step 3: Write minimal implementation**

Port the home/training/session/feedback flow into uni-app pages, translate route params and reminder-entry query handling into uni-app page lifecycle hooks, and preserve the current completion/adherence logic.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/tests/trainingFlow.spec.ts src/tests/uiReviewFixes.spec.ts`

Expected: PASS with the training flow still validated.

### Task 6: Replace placeholders with Mini Program platform adapters

**Files:**
- Create: `src/uni-app/platform/camera.ts`
- Create: `src/uni-app/platform/sensors.ts`
- Create: `src/uni-app/platform/reminders.ts`
- Modify: `src/uni-app/pages/training/visual-session.vue`
- Modify: `src/uni-app/pages/training/stair-session.vue`
- Modify: `src/uni-app/pages/training/home.vue`
- Test: `src/tests/trainingFlow.spec.ts`

**Step 1: Write the failing test**

Add tests around the adapter contracts: visual sessions still count completion independent of analysis quality, and stair sessions still record sensor-backed completion after the timer flow.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/tests/trainingFlow.spec.ts`

Expected: FAIL because platform adapter boundaries do not exist yet.

**Step 3: Write minimal implementation**

Wrap Mini Program camera, motion sensor, and reminder-entry behavior behind adapter functions so the domain logic remains testable and the page layer remains thin.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/tests/trainingFlow.spec.ts`

Expected: PASS with adapters in place.

### Task 7: Migrate growth pages into uni-app pages

**Files:**
- Create: `src/uni-app/pages/growth/index.vue`
- Create: `src/uni-app/pages/growth/adherence.vue`
- Create: `src/uni-app/pages/growth/achievements.vue`
- Create: `src/uni-app/pages/growth/metrics.vue`
- Create: `src/uni-app/pages/growth/history.vue`
- Create: `src/uni-app/components/growth/*`
- Modify: `src/views/growth/GrowthCenterView.vue`
- Modify: `src/views/growth/GrowthAdherenceDetailView.vue`
- Modify: `src/views/growth/GrowthAchievementsDetailView.vue`
- Modify: `src/views/growth/GrowthPhysicalMetricsDetailView.vue`
- Modify: `src/views/growth/GrowthHistoryDetailView.vue`
- Test: `src/tests/growthFlow.spec.ts`
- Test: `src/tests/uiReviewFixes.spec.ts`

**Step 1: Write the failing test**

Add a test that ensures growth detail navigation still exposes clear interactive affordance after the page migration.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/tests/growthFlow.spec.ts src/tests/uiReviewFixes.spec.ts`

Expected: FAIL because growth pages are still web-view based.

**Step 3: Write minimal implementation**

Port the growth center and detail pages to uni-app, preserve the current hover/focus intent with platform-appropriate pressed/current states, and keep the physical-metrics empty state intact.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/tests/growthFlow.spec.ts src/tests/uiReviewFixes.spec.ts`

Expected: PASS with growth behavior unchanged.

### Task 8: Remove the temporary web shell or demote it to a preview target

**Files:**
- Modify: `src/router/index.ts`
- Modify: `src/main.ts`
- Modify: `src/App.vue`
- Modify: `package.json`
- Modify: `README.md` (if present)
- Test: `src/tests/studentApp.spec.ts`

**Step 1: Write the failing test**

Add a test that asserts the chosen final entry point is the uni-app shell, not the temporary web-router app shell.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/tests/studentApp.spec.ts`

Expected: FAIL because the old shell still owns runtime entry.

**Step 3: Write minimal implementation**

Either remove the temporary web shell or explicitly demote it to a preview-only target with separate scripts so the production path is unambiguous.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/tests/studentApp.spec.ts`

Expected: PASS with the final entry path made explicit.

### Task 9: Verify end-to-end Mini Program readiness

**Files:**
- Modify: `openspec/changes/student-miniapp-core-flow/tasks.md`
- Create: `docs/plans/uniapp-migration-verification-notes.md`
- Test: `src/tests/accessFlow.spec.ts`
- Test: `src/tests/trainingFlow.spec.ts`
- Test: `src/tests/growthFlow.spec.ts`
- Test: `src/tests/uiReviewFixes.spec.ts`

**Step 1: Write the failing test**

Add at least one verification note/checklist item for reminder return, checkpoint gating, and three-check-in completion under the uni-app runtime assumptions.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run`

Expected: FAIL if any migrated flow broke during the final consolidation.

**Step 3: Write minimal implementation**

Close remaining migration gaps, update OpenSpec tasks only after verification passes, and document what still remains platform-placeholder versus real Mini Program capability.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run && pnpm build`

Expected: PASS with the migrated codebase verified.

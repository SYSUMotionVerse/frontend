# Growth And Psychology Backend Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Connect the student mini-program to the Django backend for formal psychology-scale submission, growth history reads, and physical-test trend reads without breaking the current mini-program flow.

**Architecture:** Keep route pages thin. Expand the existing uni-app backend client and add explicit response mappers for psychology, growth history, and physical metrics. Preserve local store compatibility only where it helps existing views keep working.

**Tech Stack:** `uni-app`, `Vue 3`, `TypeScript`, `Vitest`, `vue-tsc`

### Task 1: Cover the new backend contracts with failing tests

**Files:**
- Modify: `src/tests/studentBackendApi.spec.ts`
- Modify: `src/tests/studentBackendSync.spec.ts`
- Create: `src/tests/growthBackendModels.spec.ts`
- Create: `src/tests/questionnaireBackend.spec.ts`

**Step 1: Write the failing mapper tests**

Cover:

- backend psychology scale to questionnaire form model
- questionnaire response selection to psychology submit payload
- backend psychology records to assessment history entries
- backend exercise and stairs records to training history entries
- backend physical-test trend response to physical metric entries

**Step 2: Write the failing sync tests**

Cover:

- long questionnaire sync uses psychology submit instead of survey-record fallback
- sync returns backend score and analysis from the submitted record
- growth reads return empty models when backend integration is disabled

**Step 3: Run the targeted tests to verify they fail**

Run:

```bash
pnpm test -- studentBackend growthBackendModels questionnaireBackend
```

Expected: FAIL because the new psychology and growth read-model code does not exist yet.

### Task 2: Expand the backend client and backend types

**Files:**
- Modify: `src/uni-app/api/backendClient.ts`
- Modify: `src/uni-app/api/studentBackendTypes.ts`

**Step 1: Add failing request-client tests if needed**

If request paths or payload typing are ambiguous, add narrow tests first for:

- psychology scale reads
- psychology submit
- exercise history reads
- stair history reads
- physical-test trend reads

**Step 2: Implement the minimal client additions**

Add methods for:

- `listPsychologyScales`
- `getNextPsychologyScale`
- `submitPsychologyScale`
- `listPsychologyRecords`
- `listExerciseRecords`
- `listStairRecords`
- `getPhysicalTestTrend`

**Step 3: Run the targeted tests**

Run:

```bash
pnpm test -- studentBackend
```

Expected: PASS for the client-level tests that cover the new methods.

### Task 3: Implement psychology questionnaire mappers and sync flow

**Files:**
- Modify: `src/uni-app/api/studentBackend.ts`
- Create: `src/uni-app/api/psychologyModels.ts`
- Modify: `src/components/access/LongQuestionnaireForm.vue`
- Modify: `src/uni-app/pages/access/questionnaire.vue`

**Step 1: Write the failing questionnaire-page tests**

Cover:

- questionnaire page loads backend questions
- submit emits real option selections
- successful submit updates the local store and navigates
- failed submit does not navigate

**Step 2: Implement the minimal mapper layer**

Implement:

- backend scale to front-end questionnaire model
- selected option IDs to psychology submit payload
- submission result to existing local questionnaire summary shape

**Step 3: Update the page flow**

Change the questionnaire page to:

- load the backend scale on entry
- render loading and empty states
- submit the backend payload
- keep the user on the page if the official backend submit fails

**Step 4: Run the questionnaire tests**

Run:

```bash
pnpm test -- questionnaireBackend studentBackendPageSync
```

Expected: PASS

### Task 4: Implement growth read models

**Files:**
- Create: `src/uni-app/api/growthBackendModels.ts`
- Modify: `src/components/growth/AssessmentHistoryList.vue`
- Modify: `src/components/growth/TrainingHistoryList.vue`
- Modify: `src/components/growth/PhysicalMetricsPanel.vue` if mapping requires it

**Step 1: Write the failing growth-model tests**

Cover:

- combined training history sorting and formatting
- psychology record formatting for the assessment history list
- physical-test trend formatting for the metrics panel

**Step 2: Implement the minimal read models**

Implement:

- exercise/stairs history merge
- psychology record mapping
- physical trend mapping

**Step 3: Run the targeted model tests**

Run:

```bash
pnpm test -- growthBackendModels
```

Expected: PASS

### Task 5: Wire growth pages to backend reads

**Files:**
- Modify: `src/uni-app/pages/growth/history.vue`
- Modify: `src/uni-app/pages/growth/metrics.vue`

**Step 1: Write the failing page tests**

Cover:

- history page loads and renders backend assessment/training history
- metrics page loads and renders backend trend data
- read failures degrade to empty state instead of crashing

**Step 2: Implement the minimal page orchestration**

Keep page responsibilities narrow:

- call backend read helpers
- expose loading, empty, and error-safe states
- pass mapped data into existing components

**Step 3: Run the page tests**

Run:

```bash
pnpm test -- growthBackendModels studentBackendPageSync
```

Expected: PASS

### Task 6: Verify the whole change

**Files:**
- Verify: modified API, page, component, and test files
- Verify: `docs/plans/2026-04-11-growth-psychology-backend-integration-design.md`
- Verify: `docs/plans/2026-04-11-growth-psychology-backend-integration.md`

**Step 1: Run the full test suite**

Run:

```bash
pnpm test
```

Expected: PASS

**Step 2: Run type checks**

Run:

```bash
npx vue-tsc --noEmit
```

Expected: PASS

**Step 3: Note manual verification**

Document that WeChat DevTools is still needed to verify:

- `wechat_login` session reuse
- request-domain allowlist setup
- actual mini-program questionnaire submission and growth data rendering

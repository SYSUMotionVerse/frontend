# WeChat Startup Routing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a startup bootstrap flow that uses WeChat-backed backend state to route users to registration, the baseline questionnaire, or the training home page without repeatedly showing completed access steps.

**Architecture:** Add a dedicated startup access page as the default app entry, extend the backend client with current-user bootstrap APIs, resolve startup routing from backend truth instead of fresh local memory, then hydrate the local store before redirecting. Keep the startup flow isolated so registration and questionnaire pages remain focused on data entry, not entry-state discovery.

**Tech Stack:** `uni-app`, `Vue 3`, `TypeScript`, `Vitest`

### Task 1: Extend backend bootstrap contracts

**Files:**
- Modify: `src/uni-app/api/studentBackendTypes.ts`
- Modify: `src/uni-app/api/backendClient.ts`
- Test: `src/tests/backendClient.spec.ts`

**Step 1: Write the failing tests**

Add tests that prove the backend client can:

- call `GET /users/users/me/` after session bootstrap
- return the deserialized current user payload
- reuse the authenticated session cookie on the `me` request

**Step 2: Run test to verify it fails**

Run: `pnpm test -- src/tests/backendClient.spec.ts`
Expected: FAIL because `getCurrentUser()` is not implemented.

**Step 3: Write minimal implementation**

- Add a `BackendCurrentUser` type that matches the backend serializer fields needed by the frontend.
- Add `getCurrentUser()` to the backend client.
- Add `getCurrentUser()` to `StudentBackendSyncDependencies`.

**Step 4: Run test to verify it passes**

Run: `pnpm test -- src/tests/backendClient.spec.ts`
Expected: PASS with the new current-user request covered.

**Step 5: Commit**

```bash
git add src/uni-app/api/studentBackendTypes.ts src/uni-app/api/backendClient.ts src/tests/backendClient.spec.ts
git commit -m "feat: add backend startup user bootstrap"
```

### Task 2: Add backend startup resolver logic

**Files:**
- Modify: `src/domain/student/access.ts`
- Modify: `src/uni-app/api/studentBackend.ts`
- Modify: `src/uni-app/composables/useStudentStore.ts`
- Test: `src/tests/accessFlow.spec.ts`
- Test: `src/tests/studentBackendPageSync.spec.ts`
- Create: `src/tests/startupAccess.spec.ts`

**Step 1: Write the failing tests**

Add tests for:

- incomplete backend profile -> register route
- complete backend profile + no psychology records -> baseline questionnaire route
- complete backend profile + psychology record -> home route
- local store hydration from backend profile before routing

**Step 2: Run test to verify it fails**

Run: `pnpm test -- src/tests/accessFlow.spec.ts src/tests/startupAccess.spec.ts src/tests/studentBackendPageSync.spec.ts`
Expected: FAIL because no backend startup resolver exists.

**Step 3: Write minimal implementation**

- Add a startup route resolver that accepts backend current-user data and psychology records.
- Add profile completeness checks based on required fields.
- Add a store hydration method that maps backend user fields into the local `StudentProfile`.
- Add a `bootstrapAccess()`-style method in `studentBackendSync` that returns the resolved startup destination and any profile hydration payload.

**Step 4: Run test to verify it passes**

Run: `pnpm test -- src/tests/accessFlow.spec.ts src/tests/startupAccess.spec.ts src/tests/studentBackendPageSync.spec.ts`
Expected: PASS with deterministic route decisions.

**Step 5: Commit**

```bash
git add src/domain/student/access.ts src/uni-app/api/studentBackend.ts src/uni-app/composables/useStudentStore.ts src/tests/accessFlow.spec.ts src/tests/startupAccess.spec.ts src/tests/studentBackendPageSync.spec.ts
git commit -m "feat: resolve startup access from backend state"
```

### Task 3: Add the startup entry page and route wiring

**Files:**
- Modify: `src/pages.json`
- Create: `src/uni-app/pages/access/startup.vue`
- Create: `src/pages/access/startup.vue`
- Test: `src/tests/studentBackendPageSync.spec.ts`

**Step 1: Write the failing tests**

Add page-level tests that prove:

- startup page retries bootstrap once on failure
- startup page routes to register, questionnaire, or home
- startup page shows a retry UI after repeated failures

**Step 2: Run test to verify it fails**

Run: `pnpm test -- src/tests/studentBackendPageSync.spec.ts`
Expected: FAIL because the startup page and route do not exist.

**Step 3: Write minimal implementation**

- Create the startup page with loading and retry states.
- Make it the first entry in `src/pages.json`.
- Call the startup bootstrap method from the new page.
- Use `uni.reLaunch()` to leave the startup page after resolution.

**Step 4: Run test to verify it passes**

Run: `pnpm test -- src/tests/studentBackendPageSync.spec.ts`
Expected: PASS with all startup routing branches covered.

**Step 5: Commit**

```bash
git add src/pages.json src/uni-app/pages/access/startup.vue src/pages/access/startup.vue src/tests/studentBackendPageSync.spec.ts
git commit -m "feat: add startup routing page"
```

### Task 4: Run integrated verification

**Files:**
- No code changes required unless verification exposes regressions

**Step 1: Run focused test suite**

Run:

```bash
pnpm test -- src/tests/backendClient.spec.ts src/tests/accessFlow.spec.ts src/tests/startupAccess.spec.ts src/tests/studentBackendPageSync.spec.ts
```

Expected: PASS

**Step 2: Run full automated checks**

Run:

```bash
pnpm test
npx vue-tsc --noEmit
```

Expected: PASS

**Step 3: Manual mini-program verification**

Run: `pnpm dev`

Then verify in WeChat DevTools using `dist/build/mp-weixin`:

- returning user with complete profile and baseline questionnaire lands on the training home page
- returning user with complete profile but no baseline record lands on the baseline questionnaire page
- returning user with incomplete profile lands on the registration page
- repeated bootstrap failure shows retry UI instead of the registration page

**Step 4: Commit**

```bash
git add -A
git commit -m "test: verify startup routing bootstrap"
```

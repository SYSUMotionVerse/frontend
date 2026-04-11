# Backend API Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a frontend-side backend integration layer for the existing registration, questionnaire, and training flows, and document the contract with the Django backend for future work.

**Architecture:** Keep page components thin. Add a small uni-app request client plus a feature-focused backend sync module that maps existing frontend payloads to the backend's actual API surface. Prefer direct integration where the backend contract exists, and record schema mismatches explicitly instead of inventing new server behavior.

**Tech Stack:** `uni-app`, `Vue 3`, `TypeScript`, `Vitest`, `vue-tsc`

### Task 1: Document the backend contract and current mismatches

**Files:**
- Create: `docs/api/sport-snack-backend-integration.md`
- Create: `docs/plans/2026-04-09-backend-api-integration.md`
- Reference: `/Users/pi-dal/sport-snack-backend/API_DOCUMENTATION.md`
- Reference: `/Users/pi-dal/sport-snack-backend/users/views.py`
- Reference: `/Users/pi-dal/sport-snack-backend/exercises/views.py`
- Reference: `/Users/pi-dal/sport-snack-backend/psychology/views.py`

**Step 1: Write the documentation expectations**

Document:
- backend base URL and session-login behavior
- endpoints the frontend now uses
- field mappings from frontend models to backend payloads
- documented gaps, especially avatar upload, grade, resting heart rate, and backend profile/schema mismatches

**Step 2: Save the API integration doc**

Write a markdown document that future frontend work can follow without re-reading the backend repo.

### Task 2: Add failing tests for payload mapping and sync orchestration

**Files:**
- Create: `src/tests/studentBackendSync.spec.ts`
- Create: `src/tests/studentBackendApi.spec.ts`
- Reference: `src/uni-app/pages/access/register.vue`
- Reference: `src/uni-app/pages/access/questionnaire.vue`
- Reference: `src/uni-app/pages/training/visual-session.vue`
- Reference: `src/uni-app/pages/training/stair-session.vue`

**Step 1: Write the failing mapping tests**

Cover:
- registration payload maps to backend `update_profile` fields and omits unsupported fields
- registration also creates a survey-record payload for extra local-only fields
- long questionnaire maps to a survey-record payload
- visual training maps modality to backend exercise type
- stair training maps local sensor summary to stairs payload

**Step 2: Write the failing orchestration tests**

Cover:
- registration sync logs in, updates profile, and creates a survey record
- long questionnaire sync posts one survey record
- visual session sync fetches a matching video and creates an exercise record
- stair session sync creates a stairs record
- disabled backend config becomes a no-op instead of breaking the local flow

**Step 3: Run the targeted tests to confirm they fail**

Run: `pnpm test -- studentBackend`

Expected: FAIL because the backend sync layer does not exist yet.

### Task 3: Implement the uni-app backend client and sync module

**Files:**
- Create: `src/uni-app/api/backendClient.ts`
- Create: `src/uni-app/api/studentBackend.ts`
- Create: `src/uni-app/api/studentBackendTypes.ts`

**Step 1: Add a minimal request client**

Implement:
- configurable `VITE_API_BASE_URL`
- JSON requests through `uni.request`
- lightweight cookie persistence for session-based auth when available
- no-op mode when no backend base URL is configured

**Step 2: Add backend-specific mappers and actions**

Implement:
- ensure-session via `uni.login` -> `POST /api/users/wechat_login/`
- registration sync via `PATCH /api/users/update_profile/`
- registration questionnaire record via `POST /api/users/survey-records/`
- long questionnaire summary record via `POST /api/users/survey-records/`
- visual session sync via `GET /api/exercises/videos/` then `POST /api/exercises/records/`
- stair session sync via `POST /api/exercises/stairs/`

**Step 3: Keep unsupported fields explicit**

Do not silently invent backend fields. Preserve unsupported frontend-only values only where a documented fallback record is intentional.

### Task 4: Integrate the sync module into existing pages

**Files:**
- Modify: `src/uni-app/pages/access/register.vue`
- Modify: `src/uni-app/pages/access/questionnaire.vue`
- Modify: `src/uni-app/pages/training/visual-session.vue`
- Modify: `src/uni-app/pages/training/stair-session.vue`

**Step 1: Keep page responsibilities narrow**

Each page should:
- update the local store as it does today
- call one backend sync action
- avoid embedding payload mapping logic inline

**Step 2: Make sync non-blocking for local UX**

If sync is disabled or fails, keep the existing local navigation flow intact and surface only a lightweight warning when appropriate.

### Task 5: Verify and clean up

**Files:**
- Verify: `src/tests/studentBackendSync.spec.ts`
- Verify: `src/tests/studentBackendApi.spec.ts`
- Verify: changed page files and new API files

**Step 1: Run targeted tests**

Run: `pnpm test`

Expected: PASS

**Step 2: Run type checks**

Run: `npx vue-tsc --noEmit`

Expected: PASS

**Step 3: Note manual validation**

Document:
- whether WeChat DevTools is still needed to verify request/cookie behavior
- whether the result is limited by missing backend env vars or `touristappid`

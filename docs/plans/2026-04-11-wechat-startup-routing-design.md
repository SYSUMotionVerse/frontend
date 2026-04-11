# WeChat Startup Routing Design

**Date:** 2026-04-11

## Goal

Make the WeChat mini-program recognize returning users by their WeChat identity on app entry, then route them directly to the correct page without repeatedly showing registration or the first psychology questionnaire.

## Problem

The current frontend decides entry routing from in-memory student state only. On a fresh launch, that state starts empty, so the app falls back to the registration flow even when the backend already knows the WeChat user and the user has already completed registration and the baseline psychology questionnaire.

The current behavior has three concrete issues:

1. Returning users repeatedly hit the registration page.
2. Returning users can also be forced through the baseline questionnaire gate again because the frontend only trusts local state.
3. Network failures are indistinguishable from “unregistered user” failures because there is no dedicated startup resolution state.

## Existing Constraints

### Frontend

- The current entry decision is driven by `resolveEntryRoute()` in `src/domain/student/access.ts`.
- The student store initializes from `createInitialStudentState()` and does not currently hydrate itself from backend state during startup.
- The current default first page in `src/pages.json` is `pages/access/register`.
- Backend integration already supports `uni.login()` followed by `POST /users/users/wechat_login/`.

### Backend

- `POST /api/users/users/wechat_login/` logs the user in with a Django session and returns `{ user, is_new_user }`.
- `GET /api/users/users/me/` returns the current authenticated user profile.
- `GET /api/psychology/records/my_records/` returns the current user’s completed psychology scale records.
- The backend creates a user record on first successful WeChat login, so “user exists” is not the same thing as “registration is complete”.

## Product Rules

The startup flow must enforce these rules:

1. If the WeChat user has incomplete registration data, route to the registration page.
2. If registration is complete but the baseline psychology questionnaire is not complete, route to the first psychology questionnaire page.
3. If both registration and the baseline psychology questionnaire are complete, route directly to the main training home page.
4. If startup login or backend bootstrap fails, do not fall back to the registration page. Show a lightweight startup error state with retry.
5. Startup should retry once automatically before showing the error state.

## Recommended Architecture

Use a dedicated startup bootstrap layer that resolves backend truth before any access page is shown.

### Startup Page

Introduce a lightweight startup page as the app’s default entry page. This page owns:

- loading state
- one automatic retry on failure
- a retry button for the user
- one-time routing to the correct destination

It should not collect user input or contain business logic beyond bootstrap orchestration.

### Backend Bootstrap

The startup page should call a single frontend bootstrap routine with this sequence:

1. `ensureSession()` to exchange the WeChat login code for a backend-authenticated session
2. `getCurrentUser()` to fetch the current user profile from `/users/users/me/`
3. `listPsychologyRecords()` to fetch completed psychology records
4. `resolveStartupRouteFromBackendState()` to map backend data into one destination page

This keeps the startup decision in one place and prevents page-level duplication.

## State Resolution Rules

### Registration completeness

Registration completeness must be stricter than “backend user exists”.

The frontend should treat the registration as complete only if the backend user has the required core profile fields already filled. The minimum required set should match the current registration flow’s backend-backed essentials:

- `name`
- `gender`
- `student_id`
- `major`
- `height`
- `weight`

If any required field is missing, blank, or zero-like where zero is invalid, the user is routed to registration.

The frontend should map the backend profile into the local student profile shape when enough data exists to hydrate the store.

### Baseline questionnaire completeness

The baseline psychology questionnaire should be treated as complete only when the backend has at least one completed psychology scale record for the current user.

The frontend should stop trusting local `baseline.completed` as the source of truth for app entry. Local questionnaire state can still be updated after in-app completion, but startup routing should resolve from backend records.

## Routing Outcomes

The bootstrap resolver should produce one of three destinations:

- `/pages/access/register`
- `/pages/access/questionnaire?checkpoint=baseline`
- `/pages/training/home`

The startup page should use `uni.reLaunch()` or equivalent top-level routing so users do not navigate “back” into the startup shell.

## Error Handling

Startup failures need their own UI state.

### Retry policy

- Attempt bootstrap once.
- If it fails, immediately retry once.
- If the second attempt fails, show an error state.

### Error page behavior

The startup page should show:

- a short “正在连接” style message
- a retry button
- no fallback jump to registration

This avoids misclassifying existing users as new users when the problem is only network or backend availability.

## Testing Strategy

Add targeted tests for the new startup contract.

### Resolver-level tests

Cover these scenarios:

1. incomplete backend profile -> register
2. complete profile + no psychology records -> baseline questionnaire
3. complete profile + at least one psychology record -> home
4. bootstrap disabled -> preserve existing local fallback behavior if explicitly needed

### Page-level tests

Cover these scenarios:

1. startup page calls bootstrap and routes to home for a complete returning user
2. startup page routes to register when required profile fields are missing
3. startup page routes to the baseline questionnaire when profile is complete but no psychology record exists
4. startup page retries once, then shows an error state on repeated failure

## Files Likely Affected

- `src/pages.json`
- `src/uni-app/api/backendClient.ts`
- `src/uni-app/api/studentBackend.ts`
- `src/uni-app/api/studentBackendTypes.ts`
- `src/domain/student/access.ts`
- `src/uni-app/composables/useStudentStore.ts`
- `src/uni-app/pages/access/*.vue`
- `src/pages/access/*.vue`
- `src/tests/*.spec.ts`

## Non-Goals

- Do not auto-open the mini-program without user intent. WeChat platform rules do not allow that.
- Do not redesign the registration form.
- Do not redesign the questionnaire experience.
- Do not introduce cross-app identity requirements such as `unionid` unless later product scope expands beyond this mini-program.

## Recommendation

Implement the startup bootstrap flow with backend state as the source of truth. This is the smallest change that gives correct returning-user behavior across app restarts and devices, while preserving strict gating for incomplete registration and incomplete baseline questionnaire flows.

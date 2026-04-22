# Unified Avatar Source Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make registration avatars and in-app profile avatars persist through one backend-backed user avatar source and allow avatar updates from the training home page.

**Architecture:** Add a dedicated backend avatar upload endpoint, expose it through the frontend backend client, hydrate backend avatar URLs into the local student store, and wire the training home header avatar to trigger uploads. Registration keeps its existing avatar entry UI but switches to the same backend upload path so all avatar flows converge on `user.avatar`.

**Tech Stack:** `Django REST Framework`, `uni-app`, `Vue 3`, `TypeScript`, `Vitest`

### Task 1: Add backend avatar upload endpoint

**Files:**
- Modify: `/Users/pi-dal/Developer/sport-snack-backend/users/views.py`
- Modify: `/Users/pi-dal/Developer/sport-snack-backend/users/tests.py`

**Step 1: Write the failing test**

Add backend API tests that prove:

- authenticated user can `POST` an image file to `/api/users/users/upload_avatar/`
- response includes updated avatar data
- unauthenticated request is rejected

**Step 2: Run test to verify it fails**

Run:

```bash
cd /Users/pi-dal/Developer/sport-snack-backend
python manage.py test users.tests
```

Expected: FAIL because `upload_avatar` does not exist.

**Step 3: Write minimal implementation**

- Add a `@action(detail=False, methods=['post'])` endpoint on `UserViewSet`
- Use multipart-capable parsers
- Save `request.FILES['file']` into `request.user.avatar`
- Return updated `UserSerializer(request.user).data`

**Step 4: Run test to verify it passes**

Run:

```bash
cd /Users/pi-dal/Developer/sport-snack-backend
python manage.py test users.tests
```

Expected: PASS

**Step 5: Commit**

```bash
cd /Users/pi-dal/Developer/sport-snack-backend
git add users/views.py users/tests.py
git commit -m "feat: add user avatar upload endpoint"
```

### Task 2: Extend frontend backend client and avatar hydration

**Files:**
- Modify: `src/uni-app/api/studentBackendTypes.ts`
- Modify: `src/uni-app/api/backendClient.ts`
- Modify: `src/uni-app/api/studentBackend.ts`
- Modify: `src/uni-app/composables/useStudentStore.ts`
- Test: `src/tests/backendClient.spec.ts`
- Test: `src/tests/startupAccess.spec.ts`

**Step 1: Write the failing tests**

Add tests that prove:

- frontend backend client can upload avatar files through backend API
- startup hydration maps backend `user.avatar` into local `profile.avatarUrl`
- store supports updating avatar without resetting the rest of profile state

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm test -- src/tests/backendClient.spec.ts src/tests/startupAccess.spec.ts
```

Expected: FAIL because upload and avatar hydration support do not exist.

**Step 3: Write minimal implementation**

- Extend `BackendCurrentUser` with backend avatar shape
- Add backend client avatar upload method using `uni.uploadFile`
- Map backend avatar URL into `StudentProfile.avatarUrl`
- Add a store method for updating current avatar after successful upload

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm test -- src/tests/backendClient.spec.ts src/tests/startupAccess.spec.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/uni-app/api/studentBackendTypes.ts src/uni-app/api/backendClient.ts src/uni-app/api/studentBackend.ts src/uni-app/composables/useStudentStore.ts src/tests/backendClient.spec.ts src/tests/startupAccess.spec.ts
git commit -m "feat: add frontend avatar persistence client"
```

### Task 3: Wire avatar editing into training home UI

**Files:**
- Modify: `src/components/training/TrainingHomeHeader.vue`
- Modify: `src/uni-app/pages/training/home.vue`
- Modify: `src/uni-app/pages/training/select.vue`
- Test: `src/tests/studentBackendPageSync.spec.ts`
- Test: `src/tests/uiReviewFixes.spec.ts`

**Step 1: Write the failing tests**

Add tests that prove:

- home header exposes an avatar edit trigger
- training home uploads avatar and updates local avatar state after success
- training selection reflects the updated avatar from shared store state

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm test -- src/tests/studentBackendPageSync.spec.ts src/tests/uiReviewFixes.spec.ts
```

Expected: FAIL because the avatar is display-only today.

**Step 3: Write minimal implementation**

- Add an avatar-edit event from `TrainingHomeHeader`
- In training home, handle avatar selection and call the backend avatar upload path
- Update store avatar on success
- Keep selection page reading the shared avatar state

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm test -- src/tests/studentBackendPageSync.spec.ts src/tests/uiReviewFixes.spec.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/training/TrainingHomeHeader.vue src/uni-app/pages/training/home.vue src/uni-app/pages/training/select.vue src/tests/studentBackendPageSync.spec.ts src/tests/uiReviewFixes.spec.ts
git commit -m "feat: add in-app avatar editing"
```

### Task 4: Switch registration avatar flow to the unified backend path

**Files:**
- Modify: `src/uni-app/composables/useRegistrationAvatar.ts`
- Modify: `src/components/access/RegistrationForm.vue`
- Test: `src/tests/registrationForm.spec.ts`
- Test: `src/tests/registrationAvatarField.spec.ts`

**Step 1: Write the failing tests**

Add tests that prove:

- registration avatar upload uses backend-backed upload path rather than placeholder-only file URL fallback when backend integration is enabled
- existing registration payload emission still works after successful upload

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm test -- src/tests/registrationForm.spec.ts src/tests/registrationAvatarField.spec.ts
```

Expected: FAIL because registration upload still uses the old adapter path.

**Step 3: Write minimal implementation**

- Reuse the same backend avatar upload path in `useRegistrationAvatar`
- Preserve current WeChat `chooseAvatar` UI
- Return saved backend avatar URL after upload

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm test -- src/tests/registrationForm.spec.ts src/tests/registrationAvatarField.spec.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/uni-app/composables/useRegistrationAvatar.ts src/components/access/RegistrationForm.vue src/tests/registrationForm.spec.ts src/tests/registrationAvatarField.spec.ts
git commit -m "feat: unify registration avatar upload"
```

### Task 5: Run integrated verification

**Files:**
- No code changes required unless verification reveals regressions

**Step 1: Run frontend checks**

Run:

```bash
pnpm test
npx vue-tsc --noEmit
```

Expected: PASS

**Step 2: Run backend checks**

Run:

```bash
cd /Users/pi-dal/Developer/sport-snack-backend
python manage.py test users.tests
```

Expected: PASS

**Step 3: Manual mini-program verification**

Run: `pnpm dev`

Then in WeChat DevTools using `dist/build/mp-weixin` verify:

- registration avatar upload returns a persistent avatar
- startup hydration shows saved avatar on home and training selection pages
- tapping avatar on training home uploads a new image and updates display
- re-entering the mini-program still shows the updated avatar

**Step 4: Commit**

```bash
git add -A
git commit -m "test: verify unified avatar persistence"
```

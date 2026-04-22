# Unified Avatar Source Design

**Date:** 2026-04-11

## Goal

Unify registration avatars and in-app profile avatars behind one backend-backed user avatar source so that:

- the user can update their avatar after entering the app
- the avatar persists across app restarts
- registration and training pages show the same saved avatar

## Problem

The current avatar flow is not a true persistence flow.

On the frontend:

- `useRegistrationAvatar()` uploads only when `VITE_AVATAR_UPLOAD_URL` is configured.
- When no upload URL is configured, it falls back to the local temporary file path and treats that as the avatar URL.
- Registration submits `avatarUrl` and `avatarSource` only as fallback metadata in `survey-records.analysis`, not into the backend user `avatar` field.
- Training pages read `profile.avatarUrl` from the local store only.
- The training home header avatar is display-only and has no edit interaction.

On the backend:

- The `User` model already has an `avatar` field.
- `UserUpdateSerializer` includes `avatar`.
- But there is no dedicated student avatar upload endpoint and no confirmed multipart upload contract for the current frontend path.

The result is that the current “avatar upload” is often only a temporary preview, not a persistent saved user avatar.

## Recommended Approach

Use a dedicated backend avatar upload endpoint and make the backend user `avatar` field the single source of truth.

### Why this approach

This is the cleanest option because it separates file upload from JSON profile updates.

Compared with forcing `PATCH /users/users/update_profile/` to accept both JSON and multipart payloads, a dedicated upload endpoint:

- keeps request contracts simpler
- avoids mixed serializer/parser complexity
- makes frontend avatar update logic small and explicit
- creates a clean boundary for future avatar validation or image processing

## Unified Avatar Rules

After this change:

1. The only durable avatar source is `user.avatar` on the backend.
2. Frontend local store mirrors backend avatar state; it does not invent a long-term avatar URL on its own.
3. Registration and post-login avatar editing both write to the same backend field.
4. Startup hydration must map the backend avatar URL into the local `StudentProfile.avatarUrl`.

## Backend Design

Add a dedicated action on the current user viewset:

- `POST /api/users/users/upload_avatar/`

Expected behavior:

- requires authenticated session
- accepts multipart form data with a single file field, for example `file`
- saves the uploaded image into `request.user.avatar`
- returns the updated serialized user object, or at minimum the new avatar URL

Suggested response shape:

```json
{
  "message": "头像上传成功",
  "user": {
    "id": 1,
    "avatar": "/media/avatars/xxx.jpg"
  }
}
```

The endpoint should use `MultiPartParser` and `FormParser` explicitly so the contract is unambiguous.

## Frontend Data Flow

### Registration flow

Registration should continue to allow avatar selection before full profile submission, but the upload target changes:

1. user chooses avatar on the registration page
2. frontend uploads the file to the backend avatar endpoint
3. frontend stores the returned avatar URL locally
4. registration submits the rest of the textual profile fields

This means the registration form no longer depends on `VITE_AVATAR_UPLOAD_URL` for normal operation.

### In-app profile editing

The training home header avatar becomes an edit trigger.

The recommended UI behavior is:

1. user taps their avatar on the training home header
2. frontend opens an image picker suitable for mini-programs
3. selected image uploads to the same backend avatar endpoint
4. local store updates immediately with the returned avatar URL
5. training home and training selection pages both reflect the new avatar

## Avatar Input Methods

Use different input mechanisms where they make sense, but keep one storage destination.

- Registration page can keep the existing WeChat `chooseAvatar` flow if desired.
- In-app editing should support a real photo picker (`album` / `camera`) because the user specifically wants to upload a photo after entering the app.

These can coexist because they both write to the same backend `avatar` field.

## Frontend Components and State

### Data layer

Add a backend client upload method that:

- ensures session exists
- calls the avatar upload endpoint with `uni.uploadFile`
- returns the updated avatar URL

Extend startup hydration so backend `/me` mapping includes the backend avatar URL.

### Store

Add a focused store method for updating the current avatar in local state after a successful upload.

### UI layer

Keep route pages thin:

- `TrainingHomeHeader.vue` becomes a presentational component with an avatar-edit event
- training home page owns the edit action wiring
- training selection page reuses the same store avatar value and should reflect updates automatically

If registration remains avatar-capable, it should reuse the same backend upload mechanism rather than the current placeholder upload branch.

## Error Handling

Avatar upload needs explicit failure handling.

For both registration and in-app editing:

- show uploading state
- keep the previous avatar visible during upload
- if upload fails, keep the previous avatar and show a small error message
- do not blank out the user’s existing saved avatar on upload failure

For registration specifically:

- avatar upload failure should block avatar-dependent submission only if an avatar is required for registration
- otherwise keep the current fallback rules explicit and consistent

## Testing Strategy

### Backend tests

Add API tests that prove:

- authenticated user can upload an avatar file
- endpoint persists `request.user.avatar`
- unauthenticated upload is rejected

### Frontend tests

Add or update tests for:

- backend upload client method using `uni.uploadFile`
- startup hydration mapping backend `avatar` into `profile.avatarUrl`
- home-header avatar click emitting edit intent
- training home page updating store avatar after successful upload
- registration avatar flow using backend upload instead of the placeholder-only branch

## Files Likely Affected

Frontend repository:

- `src/uni-app/api/backendClient.ts`
- `src/uni-app/api/studentBackend.ts`
- `src/uni-app/api/studentBackendTypes.ts`
- `src/uni-app/composables/useRegistrationAvatar.ts`
- `src/uni-app/composables/useStudentStore.ts`
- `src/components/training/TrainingHomeHeader.vue`
- `src/uni-app/pages/training/home.vue`
- `src/uni-app/pages/training/select.vue`
- `src/tests/*.spec.ts`

Backend repository:

- `/Users/pi-dal/Developer/sport-snack-backend/users/views.py`
- `/Users/pi-dal/Developer/sport-snack-backend/users/tests.py`

## Non-Goals

- Do not redesign the entire profile system.
- Do not add user-facing account settings pages beyond the avatar edit interaction.
- Do not rely on `survey-records.analysis` as the durable avatar source.
- Do not keep external `VITE_AVATAR_UPLOAD_URL` as the primary production path for this repo.

## Recommendation

Implement a dedicated backend avatar upload endpoint and update both registration and post-login avatar editing to write through that endpoint. Then hydrate `profile.avatarUrl` from backend `user.avatar` so every avatar entry point shares the same persistent source of truth.

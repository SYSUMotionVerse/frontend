# Visual Session Live Pose Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire the visual training session to BlazePose live detection so the user sees real-time pose overlay during training.

**Architecture:** Reuse the existing `PoseDetectionView` as the live detector instead of duplicating inference logic in the training page. Keep production mode focused on live pose overlay and status callbacks, and make model loading deterministic in `mp-weixin` builds by using a stable generated data import.

**Tech Stack:** `uni-app`, `Vue 3`, `TypeScript`, `TensorFlow.js`, `@tensorflow-models/pose-detection`, `Vitest`

### Task 1: Add failing tests for live pose wiring

**Files:**
- Create: `src/tests/visualSessionLivePose.spec.ts`
- Create: `src/tests/poseProductionMode.spec.ts`
- Create: `src/tests/blazePoseModelLoader.spec.ts`

**Step 1: Write the failing tests**

- Assert the visual session page uses `PoseDetectionView` in production mode instead of `PoseCamera`.
- Assert `PoseDetectionView` hides the analyze bar outside debug mode and exposes recording controls.
- Assert the BlazePose model loader uses a stable `model-data.gen` import instead of runtime dynamic import.

**Step 2: Run tests to verify they fail**

Run: `pnpm test -- visualSessionLivePose poseProductionMode blazePoseModelLoader`

Expected: FAIL because the training page still renders `PoseCamera`, production mode still renders the analyze UI, and the model loader still uses dynamic import.

### Task 2: Wire the visual session page to live pose detection

**Files:**
- Modify: `src/uni-app/pages/training/visual-session.vue`
- Modify: `src/pages/training/visual-session.vue`

**Step 1: Replace camera-only usage with `PoseDetectionView`**

- Import `PoseDetectionView`.
- Keep a ref to the detection view so recording controls still work.
- Capture live pose results and stats for future scoring and visible runtime state.

**Step 2: Preserve existing record / finish flow**

- Route `startRecord()` / `stopRecord()` through the detection view ref.
- Keep backend sync and post-session redirect behavior unchanged.

**Step 3: Run the focused tests**

Run: `pnpm test -- visualSessionLivePose`

Expected: PASS

### Task 3: Tighten `PoseDetectionView` for production use

**Files:**
- Modify: `src/uni-app/components/pose/PoseDetectionView.vue`

**Step 1: Remove debug-only UI from production mode**

- Only render the analyze button and latency readout when `mode === 'debug'`.

**Step 2: Prevent overlapping live inferences**

- Add a live-frame busy guard so a new frame is skipped while the current one is still being inferred.

**Step 3: Expose recording methods**

- Forward `startRecord()` and `stopRecord()` to the inner `PoseCamera`.

**Step 4: Run the focused tests**

Run: `pnpm test -- poseProductionMode`

Expected: PASS

### Task 4: Make embedded model loading deterministic in `mp-weixin`

**Files:**
- Modify: `src/uni-app/components/pose/model-loader.ts`

**Step 1: Replace runtime dynamic import with a stable generated-data import**

- Import the generated model data directly from `model-data.gen.ts`.
- Keep the `tf.io.fromMemory()` behavior unchanged.

**Step 2: Run the focused tests**

Run: `pnpm test -- blazePoseModelLoader`

Expected: PASS

### Task 5: Verify end to end

**Files:**
- No new files

**Step 1: Run targeted and full verification**

Run:

```bash
pnpm test -- visualSessionLivePose poseProductionMode blazePoseModelLoader
pnpm test
npx vue-tsc --noEmit
pnpm build:mp-weixin
```

Expected:

- New focused tests pass
- Existing Vitest suite stays green
- TypeScript check passes
- Mini-program build completes successfully

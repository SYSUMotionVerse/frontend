## Context

BlazePose inference already produces `PoseAngleFrame` values for the same eight joint angles and torso rotation used by the Python reference package. Arrangement items expose matching standard action JSON URLs. The remaining gap is deterministic local comparison and persistence.

## Goals / Non-Goals

**Goals:**
- Preserve the Python scoring semantics for interpolation, resampling, DTW alignment, angle weighting, tolerance handling, and feedback.
- Score one active arrangement item at a time.
- Keep session completion resilient when a standard file or usable pose data is unavailable.
- Persist enough versioned scoring detail to explain how a score was produced.

**Non-Goals:**
- Automatic repetition counting or cycle segmentation.
- Real-time DTW scoring on every camera frame.
- Treating a client-computed score as tamper-proof assessment evidence.
- Redesigning the training or feedback UI.

## Decisions

### 1. Reuse existing frontend angles

The scorer consumes `PoseAngleFrame` values through a small adapter. The Python landmark-to-angle module is not ported because both standard generation and live inference already share the frontend angle calculation.

### 2. Score at active-action boundaries

Pose frames are accepted only while the workout phase is `active`. The buffer is reset when an action starts and finalized before the state machine advances to rest, demonstration, countdown, or completion.

### 3. Preload standard JSON

Standard files are requested when the arrangement loads and cached in memory by URL. A missing or invalid standard disables scoring only for that item; it does not block playback or session completion.

### 4. Use final DTW scoring

Each action is scored once at completion using global DTW. Expected action windows are small enough for the `O(standard frames x user frames)` algorithm. No scoring work runs per inference frame.

### 5. Aggregate only valid action results

The session score is the expected-duration-weighted mean of successfully scored actions. Missing actions are omitted rather than counted as zero. When none can be scored, the session score remains absent and the summary explains why.

### 6. Persist client scoring explicitly

The frontend sends optional `score` and `comment` fields plus versioned scoring details in `poseAnalysis`. The backend validates `score` to the 0-100 range, stores it, marks the record completed, and never substitutes a random value.

## Risks / Trade-offs

- Client scores can be modified by a compromised client. The payload records `scoringSource: client`; server-side verification can be added later if scores become authoritative.
- A standard representing one repetition cannot correctly score a multi-repetition active window without segmentation. This change assumes each standard describes the matching guided action clip.
- DTW allocates a parent matrix for path reconstruction. Per-action buffering bounds this cost; the session-wide 18,000-frame buffer is not used for scoring.

## Verification

- Unit tests reproduce near-identical, biased-joint, missing-value, resampling, and time-warped DTW cases from the Python reference example.
- Integration-focused tests cover payload mapping and backend acceptance/rejection of client scores.
- Run frontend Vitest, `vue-tsc`, and the Mini Program production build.
- Run backend exercise and training-progress tests.

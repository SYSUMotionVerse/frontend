## 1. Domain scoring

- [x] 1.1 Add typed standard-action and scoring result contracts.
- [x] 1.2 Port interpolation, resampling, DTW alignment, weighted scoring, and feedback to a pure TypeScript module.
- [x] 1.3 Add golden behavior tests derived from the Python scoring demo.

## 2. Mini Program integration

- [x] 2.1 Add a standard-action JSON loader with validation and per-session caching.
- [x] 2.2 Capture pose angles only during active actions and score before each action transition.
- [x] 2.3 Aggregate valid per-action scores and include versioned score details in the visual training submission.
- [x] 2.4 Preserve completion and clear user-facing fallback summaries when scoring is unavailable.

## 3. Backend persistence

- [x] 3.1 Extend the exercise-record create contract with optional validated score and comment fields.
- [x] 3.2 Remove random placeholder scoring and complete records with the submitted score or null.
- [x] 3.3 Add backend tests for valid, missing, and invalid client scores.

## 4. Verification

- [x] 4.1 Run focused frontend scoring and session tests.
- [x] 4.2 Run the full frontend test suite and TypeScript check.
- [x] 4.3 Build the `mp-weixin` production bundle.
- [x] 4.4 Run focused backend exercise and training-progress tests.

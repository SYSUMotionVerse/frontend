## Why

The visual training client already derives the nine joint and torso angles needed by the reference scoring package, but it currently uploads one session-wide sequence and relies on the backend to return a score. The backend still generates a random placeholder score, so students do not receive deterministic feedback based on their movement.

## What Changes

- Port the stateless repetitive-action scoring algorithm from Python to TypeScript without adding a numerical runtime dependency.
- Load and validate each arrangement item's standard action JSON from its `standard_data_url` before the action is scored.
- Capture pose angle frames only during each active action, score that action when it ends, and aggregate valid action scores for the session.
- Submit the locally computed score, summary, per-action results, and scoring metadata with the training record.
- Replace backend random scoring with validated persistence of the client score while preserving completion when scoring is unavailable.
- Keep action quality independent from whether a guided training session counts as completed.

## Capabilities

### Modified Capabilities

- `student-training-sessions`: Visual sessions compute deterministic per-action quality feedback on-device and persist the resulting session score.

## Impact

- Adds a pure TypeScript domain scorer and standard-data loader to the Mini Program frontend.
- Changes visual-session buffering from one session-wide sequence to per-action active-phase sequences.
- Extends the exercise-record create contract to accept an optional validated client score and comment.
- Removes placeholder random scoring from the backend exercise record flow.

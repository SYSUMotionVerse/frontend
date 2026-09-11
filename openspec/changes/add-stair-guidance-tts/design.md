# Design

## Protocol model

A pure feature module owns the five-minute duration, phase boundaries, safety copy, narration timeline, and immutable CDN URLs. The page derives the current phase from elapsed time instead of duplicating timestamp conditions in the template.

## Playback

The stair page reuses `createTrainingTtsPlayer`. It preloads the protocol assets, schedules cues from 00:00 through 04:30 against the player's anchored timeline, and plays the 05:00 completion cue before the normal completion sound and questionnaire redirect. Page hide, interruption, and unmount reset or destroy playback so stale speech cannot continue.

## Sensor capture

The full session clock runs for 300 seconds. Motion and horizontal evidence begin at 02:00 and stop at 02:30. Only this sprint window contributes to stair eligibility and live metrics. The backend record reports a 300-second guided session while its summary remains based on the measured 30-second sprint.

## Interface

`StairTrainingPanel.vue` remains presentational. It receives the current phase and instruction, formats the five-minute clock, shows the safety notice before start, and keeps the existing two live climb metrics during the session. No new route or component hierarchy is needed.

## Failure behavior

TTS preload or playback failure does not block training. Sensor startup failure leaves the guide running and records an unavailable sensor result. An interrupted or backgrounded session earns no completion and cancels all pending audio and capture work.

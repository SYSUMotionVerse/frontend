# Add guided stair-training narration

## Why

The stair session currently records only a 30-second climb and provides no spoken guidance. The supplied five-minute ES protocol includes a warm-up, preparation, a measured 30-second stair sprint, recovery, stretching, and a completion prompt. Students need hands-free narration so they can follow that protocol safely without watching the screen while moving.

## What Changes

- Expand the stair session from a standalone 30-second capture to the complete five-minute guided protocol.
- Play versioned Xiaoxiao TTS cues at the supplied protocol timestamps without overlapping adjacent prompts.
- Keep stair sensor and horizontal-location evidence restricted to the 30-second sprint window.
- Show the current phase, full-session remaining time, and pre-start safety notice on the existing stair-training surface.
- Preserve stair completion syncing, sensor eligibility, interruption cleanup, and questionnaire navigation.

## Impact

- Frontend training orchestration and stair-training presentation change.
- New immutable audio assets are published to the existing COS/CDN.
- No backend schema or API change is required; the existing stair record accepts the full session duration and sprint-derived sensor summary.

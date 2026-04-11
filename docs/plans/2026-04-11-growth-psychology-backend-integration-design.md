# Growth And Psychology Backend Integration Design

**Date:** 2026-04-11

## Goal

Connect the student mini-program to the Django backend for:

- formal psychology-scale loading and submission
- growth history reads
- physical-test trend reads

Keep the existing mini-program navigation flow intact and avoid inventing backend behavior that is not present in the backend repository.

## Confirmed Backend Reality

The backend repository at `/Users/pi-dal/Developer/sport-snack-backend` exposes these API groups under `/api`:

- `/api/users/`
- `/api/exercises/`
- `/api/psychology/`
- `/api/physical-tests/`

Relevant confirmed endpoints:

- `POST /api/users/users/wechat_login/`
- `PATCH /api/users/users/update_profile/`
- `POST /api/users/survey-records/`
- `GET /api/exercises/records/my_records/`
- `GET /api/exercises/stairs/my_records/`
- `GET /api/exercises/records/statistics/`
- `GET /api/exercises/stats/weekly_stats/`
- `GET /api/exercises/stats/monthly_stats/`
- `GET /api/psychology/scales/`
- `GET /api/psychology/scales/next_scale/`
- `POST /api/psychology/records/submit/`
- `GET /api/psychology/records/my_records/`
- `GET /api/psychology/records/score_trend/`
- `GET /api/physical-tests/my_tests/`
- `GET /api/physical-tests/trend/`

## Current Frontend Reality

The frontend already contains a lightweight backend client and page-level sync hooks for:

- registration
- long questionnaire
- visual session sync
- stair session sync

The growth pages exist, but they still render almost entirely from the local student store:

- `src/uni-app/pages/growth/index.vue`
- `src/uni-app/pages/growth/history.vue`
- `src/uni-app/pages/growth/adherence.vue`
- `src/uni-app/pages/growth/metrics.vue`
- `src/uni-app/pages/growth/achievements.vue`

The current long questionnaire is frontend-defined and uses custom prompt IDs like `focus` and `confidence`. That does not match the backend psychology submission contract, which requires real `scale_id`, `question_id`, and selected option IDs.

## Scope

This change includes:

- replacing the current long-questionnaire summary write with formal psychology-scale submission
- loading backend psychology scales to drive the long-questionnaire UI
- reading backend psychology history for the growth history page
- reading backend exercise history for the growth history page
- reading backend physical-test trend data for the growth metrics page

This change does not include:

- rewriting the growth overview page to be fully backend-driven
- rewriting local adherence or achievement rules
- adding missing backend avatar upload support
- adding new backend endpoints
- fabricating missing scale questions for rounds that the backend has not initialized

## Recommended Approach

Use a backend-driven questionnaire and a thin read-model layer for growth pages.

### Why

- It aligns the frontend with the backend’s actual source of truth.
- It removes the need to maintain a fake questionnaire schema in parallel.
- It preserves current UI components where possible by adapting backend responses into existing view models.

## Architecture

### 1. Keep pages thin

Route-level pages remain orchestration surfaces:

- load backend data
- show loading and empty states
- trigger sync and navigation

They should not contain payload mapping logic.

### 2. Expand the backend API layer

Add backend client methods for:

- `listPsychologyScales`
- `getNextPsychologyScale`
- `submitPsychologyScale`
- `listPsychologyRecords`
- `getPsychologyScoreTrend`
- `listExerciseRecords`
- `listStairRecords`
- `getExerciseStatistics`
- `getWeeklyTrainingStats`
- `getMonthlyTrainingStats`
- `listPhysicalTests`
- `getPhysicalTestTrend`

### 3. Add feature-focused mappers

Create explicit mappers that:

- convert backend psychology scales into a form model consumable by the questionnaire component
- convert form selections back into `submit` payloads
- convert backend training records into the shape required by `TrainingHistoryList`
- convert backend psychology records into the shape required by `AssessmentHistoryList`
- convert backend physical-test trend entries into the shape required by `PhysicalMetricsPanel`

### 4. Preserve local compatibility where useful

After successful psychology submission:

- keep using the backend response as the source of truth
- write a compatible local summary into the existing store so current result and growth surfaces continue to work

This lets the app move toward backend truth without forcing a full state-architecture rewrite in one pass.

## Questionnaire Design

### Data loading

The long-questionnaire page will:

1. ensure backend session
2. request the next scale from `/api/psychology/scales/next_scale/`
3. fall back to `/api/psychology/scales/` if necessary
4. render the returned questions dynamically

### Rendering

The existing questionnaire UI stays visually similar, but the underlying data model changes:

- each rendered question carries `questionId`
- each option carries `optionId` and score metadata from the backend
- submit payload is based on selected option IDs, not frontend-made question keys

### Submission

Submit to:

`POST /api/psychology/records/submit/`

Payload shape:

```json
{
  "scale_id": 1,
  "answers": [
    {
      "question_id": 11,
      "selected_options": [42]
    }
  ]
}
```

### Source of truth

The frontend should not compute the official score when using backend scales. It should use:

- `record.total_score`
- `record.analysis`

from the backend response.

## Growth Read Models

### History page

The history page will read two backend-backed datasets:

- training history
- psychology history

Training history will combine:

- `/api/exercises/records/my_records/`
- `/api/exercises/stairs/my_records/`

Psychology history will come from:

- `/api/psychology/records/my_records/`

### Metrics page

The metrics page will read:

- `/api/physical-tests/trend/`

and map trend entries into the existing physical-metrics panel model.

### Overview, adherence, achievements

These remain primarily local in this iteration because:

- adherence rules are already encoded in frontend domain logic
- achievements are derived from local domain rules
- the backend does not expose a dedicated achievement model

## Error Handling

### Questionnaire writes

Formal psychology submission is not a best-effort background sync. If submission fails:

- the page must not pretend the questionnaire was officially submitted
- the user stays on the questionnaire page
- the app shows an actionable error toast

### Training sync writes

Existing training sync behavior remains:

- local flow continues even if sync fails
- user gets a lightweight warning

### Growth reads

If backend reads fail:

- the page shows an empty or fallback state
- the page does not crash
- local-only sections remain usable

### Disabled backend mode

If `VITE_API_BASE_URL` is not configured:

- write actions become no-ops where appropriate
- read actions return empty state models
- the app stays usable for local frontend development

## Testing Strategy

### Mapper and API tests

Add or update tests for:

- psychology scale response to questionnaire form model
- questionnaire answer selections to backend submit payload
- backend psychology record to history model
- backend exercise and stair records to training-history model
- backend physical-test trend to metrics model

### Page integration tests

Add or update tests for:

- questionnaire page loading backend scale data
- questionnaire page submitting backend answers and then navigating
- history page showing backend-backed assessment and training records
- metrics page showing backend-backed physical trends
- graceful empty-state behavior when the backend is disabled or a read fails

### Verification

Required commands after implementation:

- `pnpm test`
- `npx vue-tsc --noEmit`

Manual follow-up still required in WeChat DevTools to confirm:

- `wechat_login` cookie/session reuse
- request-domain allowlist behavior
- questionnaire submission and growth-page rendering in the mini-program runtime

## Known Constraints

- The backend initialization script currently creates only the first psychology scale with actual questions and options. Later scales may exist without full question data.
- The frontend must render whatever the backend actually returns and must not fabricate missing backend questions for later checkpoints.
- True real-device preview and restricted mini-program features may still be limited by `touristappid` in `src/manifest.json`.

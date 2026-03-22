## Why

The project needs a clear student-side product contract before UI implementation begins. Right now the idea spans registration, psychological assessments, AI-guided training, sensor-based stair sessions, reminders, and growth feedback, but the student experience, completion rules, and data collection boundaries are still mixed together with admin-side concerns.

This change defines the WeChat Mini Program experience for university students in a way that supports both day-to-day engagement and the research workflow. It narrows scope to the student app, aligns the key flows that must happen in-app, and leaves teacher/admin tooling out of the first specification set.

## What Changes

- Define the student-side onboarding flow, including profile registration, mandatory baseline long questionnaire, periodic long questionnaire checkpoints, post-training short questionnaires, and assessment result pages.
- Define the motivational home flow for the WeChat Mini Program, including daily completion progress toward three valid check-ins, reminder handoff from WeChat notifications, and student-facing progress status.
- Define the training selection and execution flow where students can freely choose among Wushu, HIIT, and stair-climbing “exercise snacks” for each session.
- Define session completion rules: a session is considered completed when the student follows the assigned teaching video through to the end, while AI recognition and sensor capture provide scoring, feedback, and research data rather than blocking completion.
- Define modality-specific capture expectations:
  - Wushu and HIIT use split-screen video guidance with camera-based motion analysis.
  - Stair-climbing uses device sensor capture such as accelerometer/gyroscope data, with optional step/health integration when available.
- Define student-side result, growth, and adherence views, including charts, heatmaps/calendars, badge-style encouragement, and history of training and questionnaire outcomes.
- Explicitly exclude teacher/admin web management features from this change so the Mini Program spec stays focused and implementation-ready.

## Capabilities

### New Capabilities
- `student-onboarding-and-assessments`: Registration, profile collection, mandatory long questionnaires at research checkpoints, short post-training questionnaires, and student-facing assessment result pages.
- `student-training-sessions`: Motivational home entry, free selection of Wushu/HIIT/stair-climbing sessions, modality-specific training screens, and session completion/feedback behavior.
- `student-adherence-and-reminders`: Daily completion tracking, 18:00 reminder-triggered return flows, valid check-in limits, and weekly adherence rules.
- `student-growth-and-records`: Personal charts, adherence calendar/heatmap, badges, training history, assessment summaries, and student-visible health/fitness record trends when data exists.

### Modified Capabilities
- None.

## Impact

- Affects the WeChat Mini Program information architecture, page flows, state model, and student-facing data model.
- Establishes the capability boundaries that future UI design and implementation must follow.
- Clarifies integration points for AI video analysis, sensor data collection, questionnaire scoring, and WeChat reminder delivery without specifying backend/admin implementation details.

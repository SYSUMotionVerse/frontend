## Why

The current onboarding assessment renders a long backend scale as one scrolling page and blocks all access to the product until every item is submitted. Students can see the total item count, cannot preview the motivating training experience, cannot reliably resume after a timeout, and receive no useful navigation when an answer is missing. This creates fatigue and threatens response quality.

The frontend also presents backend option text without a questionnaire-level response legend or instrument boundary. For validated psychological instruments, the client must not invent section names, scores, or duration intervals. Those semantics need to come from reviewed backend scale metadata.

## What Changes

- Replace the single long scrolling form with a progressive questionnaire runner that presents one item at a time.
- Present one validated questionnaire/instrument at a time and advance only after that questionnaire is submitted.
- Auto-save each selected answer locally immediately, restore the latest draft after page reload or request failure, and clear it only after confirmed server submission.
- Add missing-answer navigation and preserve all answers when submission times out.
- Replace the visible total item count with a study-level introduction that reports the number of questionnaires and estimated total time.
- Require backend-provided response instructions and option meanings; the frontend SHALL render exact scale labels and SHALL NOT infer `1–5` meanings or rewrite duration ranges.
- Allow students with an incomplete required questionnaire to browse the home, training catalog, and growth explanation surfaces in preview mode while disabling training start and protected data actions.
- Define backend contract extensions for questionnaire-plan metadata, per-instrument progress, and server-side draft/submission boundaries.

## Capabilities

### Modified Capabilities

- `student-onboarding-and-assessments`: progressive validated questionnaire presentation, draft recovery, per-instrument completion, and non-coercive onboarding guidance.
- `student-training-sessions`: preview access to training content while required assessments remain incomplete, with execution actions locked.
- `student-growth-and-records`: preview access to motivating growth explanations without exposing unavailable personal results.

## Impact

- Changes the baseline and checkpoint assessment UX, local storage, navigation, and failure recovery.
- Changes startup gating from a hard redirect-only model to a browse-preview plus execution-lock model.
- Requires backend scale metadata and draft/submission APIs before multi-questionnaire server persistence can be fully authoritative.
- Requires research-owner review of all questionnaire prompts, response legends, scoring labels, and duration interval options.


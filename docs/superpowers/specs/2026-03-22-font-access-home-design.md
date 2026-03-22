# Result And Home Typography Design

**Scope:** Increase the perceived readability of the questionnaire result page and the training home page in the WeChat mini program, and fix the distorted home action button.

## Problem

The current mini program uses several `12px` and `14px` text styles in places that function as primary reading content on phone screens. On the training home page, the two main action buttons also lack explicit minimum sizing, so the secondary action can appear compressed on narrow layouts.

## Design

- Keep the existing component boundaries and state flow unchanged.
- Increase result-page supporting text, status copy, metadata, and CTA sizing inside `QuestionnaireResultCard`.
- Increase training-home explanatory copy inside the page body, `DailyProgressCard`, and `ReminderBanner` so the screen reads as one consistent scale.
- Add stable button sizing on the training home page with explicit minimum height and balanced flex behavior so the buttons no longer deform on smaller screens.

## Files

- `src/components/access/QuestionnaireResultCard.vue`
- `src/components/training/DailyProgressCard.vue`
- `src/components/training/ReminderBanner.vue`
- `src/uni-app/pages/training/home.vue`
- `src/views/training/HomePage.vue`
- `src/tests/uiReviewFixes.spec.ts`

## Verification

- Add a regression test that locks in the larger text classes and home button sizing rules.
- Run the targeted Vitest spec.
- Run the full test suite if the targeted spec passes.

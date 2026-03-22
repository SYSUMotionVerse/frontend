## 1. App shell and student state

- [x] 1.1 Define the student-side route map for registration, questionnaires, home, training selection, modality-specific training screens, feedback pages, and growth views
- [x] 1.2 Define the student profile, checkpoint questionnaire, session record, and adherence state models used by the Mini Program
- [x] 1.3 Implement entry gating so first-time users and checkpoint users are routed to the required registration/questionnaire flow before training

## 2. Onboarding and assessment flows

- [x] 2.1 Build the registration/profile entry flow with all required baseline fields
- [x] 2.2 Build the baseline, week-4, week-8, and week-12 long questionnaire flow and result page
- [x] 2.3 Build the short post-training questionnaire flow and connect it to the session feedback handoff

## 3. Home and adherence experience

- [x] 3.1 Build the motivational home page with daily progress toward three valid check-ins and weekly adherence status
- [x] 3.2 Implement valid daily check-in counting capped at three and weekly active-day status
- [x] 3.3 Add student-facing reminder return states for the documented 18:00 daily reminder flow

## 4. Training session flows

- [x] 4.1 Build the training selection page so students can choose Wushu, HIIT, or stair-climbing for each session
- [x] 4.2 Build the Wushu/HIIT split-screen guided training flow with camera capture and analysis placeholders
- [x] 4.3 Build the stair-climbing guided training flow with a 30-second timer and motion-sensor capture placeholders
- [x] 4.4 Implement guided-session completion rules so finishing the guided flow records a completed session regardless of quality score

## 5. Feedback and growth views

- [x] 5.1 Build the immediate post-session feedback page with completion status, modality-specific score/quality feedback, and encouragement UI
- [x] 5.2 Build the growth center with charts for training activity, assessment summaries, and historical records
- [x] 5.3 Build the adherence calendar or heatmap and achievement/badge views
- [x] 5.4 Add conditional display for imported physical metrics so available data shows trends and missing data shows empty states

## 6. Integration and verification

- [x] 6.1 Integrate questionnaire scoring, AI-analysis results, and sensor-analysis results into the student-facing states and result pages
- [x] 6.2 Integrate capped adherence records and daily completion status into reporting and growth views
- [x] 6.3 Verify the end-to-end flows for first-time students, normal training days, 18:00 reminder eligibility, three-check-in completion, and week-4/week-8/week-12 checkpoint gating
  - Verification notes: `docs/plans/uniapp-migration-verification-notes.md`
  - Verification status: `pnpm build`, `pnpm vitest run`, and `pnpm exec vue-tsc --noEmit` all pass in the aligned Vue 3 uni-app toolchain.

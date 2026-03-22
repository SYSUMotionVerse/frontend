## Context

This change defines the WeChat Mini Program experience for university students participating in a research-oriented “exercise snack” program. The student app combines lightweight exercise sessions, questionnaire checkpoints, motion/sensor capture, and progress feedback. The current source material mixes student-side flows with teacher/admin responsibilities, and also contains unresolved differences around reminder timing, questionnaire checkpoints, and daily completion counting.

For this design, the student-side product contract is aligned to the latest clarified intent:

- Scope is limited to the student Mini Program.
- Student-side implementation stack is uni-app + Vue 3 + TypeScript.
- Student-side styling stack uses UnoCSS with `unocss-preset-weapp`, with SCSS reserved for page-specific details.
- Long questionnaires gate access at baseline, week 4, week 8, and week 12.
- The home experience centers on daily progress toward three valid check-ins.
- Students may freely choose Wushu, HIIT, or stair-climbing for each session.
- Session completion is based on finishing the guided session rather than achieving a minimum AI/sensor score.
- Daily valid check-ins are capped at three for adherence purposes.

## Goals / Non-Goals

**Goals:**
- Define a coherent student-side information architecture and flow contract for onboarding, assessments, training, reminders, and growth feedback.
- Separate “session completion” from “quality/scoring” so AI and sensor analysis enrich the experience without unfairly blocking completion.
- Support multiple training modalities under one unified session lifecycle.
- Support research data collection through profile data, questionnaire checkpoints, completion records, and modality-specific session capture.
- Align the reminder and adherence model to the source requirements for three valid daily check-ins and weekly participation targets.

**Non-Goals:**
- Defining teacher/admin backend pages, permissions, or operational workflows.
- Locking down implementation details for AI inference, sensor algorithms, or scoring formulas.
- Defining the full questionnaire copy, item bank, or psychological interpretation language.
- Designing deployment, rollback, or data migration for systems that do not yet exist.

## Decisions

### 1. Student-side scope is the authoritative boundary
This change models only what students see and do in the Mini Program. Teacher/admin functions remain integration dependencies, not first-class requirements in this spec set.

**Why this approach**
- Prevents student-side requirements from being delayed by backend/admin ambiguity.
- Matches the current design exploration and HTML examples.

**Alternatives considered**
- Specify both student and admin flows together. Rejected because it broadens scope and mixes product surfaces with very different users.

### 1a. The student client uses uni-app + Vue 3 + TypeScript
The student-side implementation uses uni-app as the Mini Program framework, Vue 3 as the UI framework, and TypeScript as the application language. Vue components should follow Composition API patterns with `<script setup lang="ts">`.

**Why this approach**
- Matches the newly confirmed student-side technology choice.
- Gives future implementation tasks a stable frontend architecture and code organization baseline.

**Alternatives considered**
- Leave the frontend stack unspecified until implementation starts. Rejected because it would make later implementation planning and code organization less consistent.

### 1b. The student styling system uses UnoCSS with `unocss-preset-weapp`
The student-side styling system uses UnoCSS as the utility and design-token layer, with `unocss-preset-weapp` as the Mini Program-oriented preset baseline. SCSS remains available for page-specific layouts and complex visual details that are not a good fit for shortcuts or utilities.

**Why this approach**
- Matches the current decision to make the cartoon visual system easier to maintain across many pages.
- Gives the project a reusable token, shortcut, and component-skin layer suited to Mini Program development.
- Keeps styling practical by allowing SCSS where one-off page details are clearer outside utility classes.

**Alternatives considered**
- Use only plain SCSS without a utility layer. Rejected because the project needs a more systematic way to keep the visual language consistent across many student-side pages.
- Adopt UnoCSS without a WeChat-oriented preset. Rejected because `unocss-preset-weapp` is better aligned to the Mini Program context.

### 2. Long questionnaires are gating checkpoints
The product SHALL gate training access behind long questionnaires at baseline, week 4, week 8, and week 12. If a required checkpoint questionnaire is incomplete, the student enters it directly upon opening the app.

**Why this approach**
- Matches the latest clarified research flow.
- Ensures required checkpoint data is collected before continued intervention exposure.

**Alternatives considered**
- Let students postpone long questionnaires while continuing training. Rejected because it weakens checkpoint compliance and research data quality.

### 3. Daily adherence uses a three-check-in target with an 18:00 reminder scan
The home and student-facing logic are built around progress toward three valid daily check-ins. Reminder delivery follows the documented behavior: the system performs a daily 18:00 scan and notifies students whose valid daily training count is still below three.

**Why this approach**
- Matches the source requirements document.
- Gives the product a clear, measurable daily adherence target.

**Alternatives considered**
- Use morning/afternoon/evening anchor windows as the primary requirement. Rejected for this change because the user asked to align the spec back to the source document instead.

### 4. Students freely choose a training modality for every session
Each session begins with a student choice among Wushu, HIIT, and stair-climbing rather than locking each student into a permanent training group.

**Why this approach**
- Matches the clarified product intent.
- Better supports autonomy and repeated engagement.

**Alternatives considered**
- Assign a fixed modality per student or per week. Rejected because it conflicts with the current desired product behavior.

### 5. Session completion is based on guided-session completion
An exercise session is completed when the student follows the guided training flow to the end of the associated video/timer experience. AI recognition and sensor capture provide analysis, scoring, and research records, but do not determine whether the session counts as completed.

**Why this approach**
- Avoids false negatives caused by imperfect recognition.
- Preserves an encouraging student experience.

**Alternatives considered**
- Require a minimum AI/sensor score to count completion. Rejected because it creates unnecessary frustration and confounds adherence measurement.

### 6. Daily adherence counts only valid check-ins up to three per day
Each completed training session records a valid check-in until the student reaches three valid daily check-ins. Daily adherence status is based on that capped count and the weekly goal is based on qualifying days.

**Why this approach**
- Matches the source requirements document and its `training_compliance` model.
- Preserves a stable definition of daily goal completion.

**Alternatives considered**
- Separate raw session count from effective adherence count. Rejected for this change because the user asked to keep the spec aligned to the current requirements document.

### 7. Training UI splits into two execution patterns
Wushu and HIIT use a split-screen training layout with teaching video plus student camera view. Stair-climbing uses a guided sensor-driven layout with a 30-second training timer and movement/status feedback.

**Why this approach**
- Aligns the UI to the underlying capture mode.
- Avoids forcing sensor-based training into a camera-first layout that does not fit.

**Alternatives considered**
- Use one identical training screen for all modalities. Rejected because it hides meaningful modality differences and adds confusion.

### 8. Stair-climbing uses only the currently chosen motion sensors
Stair-climbing sessions use the selected device motion sensors for training capture and do not depend on barometer or step-count integrations in this change.

**Why this approach**
- Matches the latest clarified product decision.
- Reduces scope and avoids introducing extra hardware or platform dependencies into the first student-side implementation.

**Alternatives considered**
- Add barometer or step-count inputs to improve stair-climbing inference. Rejected for this change because the current product decision is not to include them.

### 9. Interrupted training sessions restart from the beginning
If a student exits or interrupts a guided training session before completion, the next attempt starts from the beginning rather than resuming from the prior progress point.

**Why this approach**
- Keeps completion semantics simple and consistent across video-driven and timer-driven sessions.
- Avoids ambiguous partial-completion states in adherence and research records.

**Alternatives considered**
- Resume from the last position in the interrupted session. Rejected for this change because restart behavior is simpler and was explicitly chosen.

## Risks / Trade-offs

- **Reminder delivery depends on WeChat capabilities and backend orchestration** → Keep the product requirements focused on the documented 18:00 scan and reminder outcome, not transport implementation.
- **Reminder timing may feel less immediate than anchor-based nudging** → Keep the product contract aligned to the documented 18:00 scan, and revisit finer-grained reminder windows in a later change if needed.
- **Checkpoint cadence is heavier with week-12 included** → Keep the four checkpoint schedule explicit so gating behavior remains predictable.
- **AI or sensor accuracy may be inconsistent across devices and environments** → Use completion rules based on guided-session completion; keep analysis as feedback rather than a gate.
- **Student-visible growth views depend on imported or computed data that may not always exist yet** → Require graceful empty states and conditional display when metrics are unavailable.

## Migration Plan

No production migration is defined in this change. This artifact establishes the student-side contract for future implementation. When implementation begins, the work can proceed in phases:

1. Build onboarding and assessment gates.
2. Build the motivational home and adherence model.
3. Build modality-specific training flows.
4. Build result, growth, and adherence views.
5. Integrate WeChat reminders and analysis services.

## Open Questions

- None at this stage for the student-side scope captured by this change.

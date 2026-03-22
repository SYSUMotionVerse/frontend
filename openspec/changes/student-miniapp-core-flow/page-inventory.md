# Student Mini Program Page Inventory

This document translates the OpenSpec change into a student-facing page inventory for easier product, design, and frontend maintenance.

Scope: WeChat Mini Program student side only. Teacher/admin web management is out of scope for this document.

## 1. Access and Assessment Pages

### A1. Registration / Profile Entry

**Goal**
- Collect the full baseline student profile before any training access is allowed.

**Entry Conditions**
- Student opens the Mini Program without an existing completed profile.

**Exit Routes**
- To `A2. Long Questionnaire` after all required fields are submitted.

**Key Components**
- Basic identity fields
- Demographic and academic fields
- Physical profile fields
- Required-field validation
- Submit action

**Key Rules**
- Registration is mandatory before any training flow.
- Incomplete required fields block progress.

### A2. Long Questionnaire

**Goal**
- Collect the mandatory long-form assessment at research checkpoints.

**Entry Conditions**
- Immediately after initial registration
- Or when the student opens the app during week 4, week 8, or week 12 and the checkpoint questionnaire is incomplete

**Exit Routes**
- To `A3. Long Questionnaire Result`

**Key Components**
- Questionnaire content
- Progress indicator
- Submit action

**Key Rules**
- Long questionnaires are required at baseline, week 4, week 8, and week 12.
- If the active checkpoint questionnaire is incomplete, the student is routed here directly.
- The student cannot continue to training until this questionnaire is submitted.

### A3. Long Questionnaire Result

**Goal**
- Present a student-friendly result summary after long questionnaire submission.

**Entry Conditions**
- Student submits the long questionnaire.

**Exit Routes**
- To `B1. Home`

**Key Components**
- Score or percentage summary
- Brief interpretation
- Return/continue action

**Key Rules**
- This page appears after every required long questionnaire submission.

## 2. Daily Training Flow Pages

### B1. Home

**Goal**
- Serve as the daily student hub for motivation, progress, and training entry.

**Entry Conditions**
- Student has completed required registration and any active long questionnaire checkpoint.
- Student returns from training, reminders, or growth pages.

**Exit Routes**
- To `B2. Training Selection`
- To `C1. Growth Center`

**Key Components**
- Daily valid check-in progress
- Weekly adherence status
- Encouragement content
- Start training action
- Growth center entry

**Key Rules**
- Home reflects progress toward the daily target of 3 valid check-ins.
- Reminder-driven returns should reopen into the current incomplete daily progress context.
- This document follows the source requirement model, not morning/afternoon/evening anchor logic.

### B2. Training Selection

**Goal**
- Let the student choose a training modality for the next session.

**Entry Conditions**
- Student taps the training entry from Home.

**Exit Routes**
- To `B3. Wushu / HIIT Training`
- To `B4. Stair-Climbing Training`

**Key Components**
- Wushu option
- HIIT option
- Stair-climbing option
- Short modality descriptions

**Key Rules**
- Students can freely choose among Wushu, HIIT, and stair-climbing for every session.
- There is no permanent per-student modality lock in the student-side flow.

### B3. Wushu / HIIT Training

**Goal**
- Deliver guided camera-based training for Wushu and HIIT sessions.

**Entry Conditions**
- Student selects Wushu or HIIT from Training Selection.

**Exit Routes**
- To `B5. Short Questionnaire` on successful guided completion
- Back to start of the same session if interrupted and restarted later

**Key Components**
- Teacher guidance video
- Student live camera panel
- Motion-analysis overlays or placeholders
- Session controls

**Key Rules**
- The training layout is split-screen (teacher guidance + student live view).
- AI analysis can provide feedback during or after the session.
- Session completion is defined by finishing the guided training flow, not by reaching a minimum AI score.
- If the session is interrupted before completion, the next attempt restarts from the beginning.

### B4. Stair-Climbing Training

**Goal**
- Deliver guided sensor-based stair-climbing training.

**Entry Conditions**
- Student selects stair-climbing from Training Selection.

**Exit Routes**
- To `B5. Short Questionnaire` on successful guided completion
- Back to start of the same session if interrupted and restarted later

**Key Components**
- 30-second guided timer
- Sensor status or motion feedback
- Session controls

**Key Rules**
- Stair-climbing is a guided 30-second training flow.
- It uses configured device motion sensors for capture.
- This change does not require barometer or step-count integration.
- Session completion is defined by finishing the guided flow.
- If the session is interrupted before completion, the next attempt restarts from the beginning.

### B5. Short Questionnaire

**Goal**
- Capture immediate post-training self-report feedback.

**Entry Conditions**
- Student completes any training session.

**Exit Routes**
- To `B6. Training Feedback`

**Key Components**
- Short questionnaire items
- Submit action

**Key Rules**
- Every completed training session must be followed by the short questionnaire before final session feedback is shown.

### B6. Training Feedback

**Goal**
- Summarize the completed training session and reinforce continued participation.

**Entry Conditions**
- Student submits the short questionnaire after a completed training session.

**Exit Routes**
- To `B1. Home`
- To `C1. Growth Center`
- To `B2. Training Selection` for another session if the product exposes a direct retry path

**Key Components**
- Completion confirmation
- Modality-specific score or quality feedback
- Encouragement copy
- Badge/achievement prompts

**Key Rules**
- Feedback confirms successful completion even if AI/sensor quality is low.
- Quality, scoring, and comments are feedback layers, not completion gates.

## 3. Growth and Record Pages

### C1. Growth Center

**Goal**
- Provide a consolidated student-facing overview of activity, adherence, and assessment history.

**Entry Conditions**
- Student navigates from Home or Training Feedback.

**Exit Routes**
- To `C2. Adherence Calendar / Heatmap`
- To `C3. Trend Charts`
- To `C4. Achievements / Badges`
- To `C5. Physical Metrics`
- Back to `B1. Home`

**Key Components**
- Summary cards
- Navigation to detailed growth views

**Key Rules**
- The growth center is the main history and summary hub for the student side.

### C2. Adherence Calendar / Heatmap

**Goal**
- Show recent adherence at the day level.

**Entry Conditions**
- Student opens the adherence history area from Growth Center.

**Exit Routes**
- Back to `C1. Growth Center`

**Key Components**
- Calendar or heatmap view
- Day-level completion states

**Key Rules**
- Adherence visualization reflects whether the student met daily training goals.
- Daily valid check-ins are capped at 3 for adherence purposes.

### C3. Trend Charts

**Goal**
- Show chart-based changes over time for training and assessment records.

**Entry Conditions**
- Student opens the trend area from Growth Center.

**Exit Routes**
- Back to `C1. Growth Center`

**Key Components**
- Training activity charts
- Assessment result charts
- Historical summaries

**Key Rules**
- Charts should be student-friendly and readable.
- They can combine training, adherence, and assessment summaries where appropriate.

### C4. Achievements / Badges

**Goal**
- Surface motivational rewards and milestones.

**Entry Conditions**
- Student opens the achievement area from Growth Center.

**Exit Routes**
- Back to `C1. Growth Center`

**Key Components**
- Badge list
- Trophy or milestone cards
- Streak or encouragement elements

**Key Rules**
- Achievement presentation supports motivation and continued participation.

### C5. Physical Metrics

**Goal**
- Display imported body-test or physical-metric trends when available.

**Entry Conditions**
- Student opens the physical metrics area from Growth Center.

**Exit Routes**
- Back to `C1. Growth Center`

**Key Components**
- Metric list
- Trend charts
- Empty state

**Key Rules**
- This page is student-facing display only.
- If imported physical data does not exist, the page must show a graceful empty state.

## 4. Cross-Page Rules

### Daily Adherence
- Daily target: 3 valid check-ins
- Weekly target: at least 3 qualifying days
- Daily valid check-ins are capped at 3

### Reminder Logic
- At 18:00, if the student’s valid daily count is below 3, the student is reminder-eligible
- Reminder return should reopen the app into the current daily progress context

### Training Completion
- A session counts as completed when the student reaches the end of the guided video/timer flow
- AI or sensor quality does not cancel completion

### Interruption Behavior
- Interrupted sessions restart from the beginning
- No resume-from-last-progress behavior is assumed in this change

### Modality Rules
- Wushu / HIIT: split-screen camera-based training
- Stair-climbing: 30-second sensor-based training
- Stair-climbing excludes barometer and step-count requirements in this change

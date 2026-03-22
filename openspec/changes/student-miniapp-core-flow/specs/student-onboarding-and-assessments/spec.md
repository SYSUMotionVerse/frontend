## ADDED Requirements

### Requirement: Student registration SHALL collect a complete baseline profile before training access
The system SHALL require first-time student users to complete profile registration before any training flow becomes available. The registration flow SHALL collect the baseline profile fields required by the study, including identity, demographic, academic, and physical profile information.

#### Scenario: First-time user is required to register
- **WHEN** a student opens the Mini Program without an existing profile
- **THEN** the system SHALL route the student to the registration flow before showing training entry points

#### Scenario: Incomplete registration blocks training
- **WHEN** a student has not completed all required registration fields
- **THEN** the system SHALL prevent the student from entering any training session

### Requirement: Long questionnaires SHALL gate training at baseline and checkpoint weeks
The system SHALL require a long questionnaire at baseline, week 4, week 8, and week 12. If a required long questionnaire for the active checkpoint is incomplete, the student SHALL be taken directly to that questionnaire and SHALL NOT continue to training until it is submitted.

#### Scenario: Baseline questionnaire gates first training access
- **WHEN** a newly registered student completes profile registration for the first time
- **THEN** the system SHALL present the baseline long questionnaire before allowing any training session

#### Scenario: Checkpoint questionnaire interrupts normal entry
- **WHEN** a student opens the Mini Program during week 4, week 8, or week 12 and the required long questionnaire is still incomplete
- **THEN** the system SHALL open the long questionnaire immediately instead of the normal home page

### Requirement: Long questionnaire submission SHALL produce a student-facing result page
After each required long questionnaire submission, the system SHALL calculate the configured assessment result and SHALL present a result page that summarizes the student’s current assessment outcome using score-based or percentage-based feedback.

#### Scenario: Long questionnaire shows assessment result
- **WHEN** a student submits a required long questionnaire
- **THEN** the system SHALL display a result page before returning the student to the normal app flow

### Requirement: Completed training sessions SHALL require a short post-training questionnaire
The system SHALL require a short questionnaire immediately after each completed training session and before the session feedback flow is finalized.

#### Scenario: Short questionnaire follows training completion
- **WHEN** a student finishes a training session
- **THEN** the system SHALL present the short questionnaire before the final training feedback page

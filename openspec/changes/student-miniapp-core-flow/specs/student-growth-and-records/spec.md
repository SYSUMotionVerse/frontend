## ADDED Requirements

### Requirement: Completed training sessions SHALL end with a feedback page
After the short post-training questionnaire is submitted, the system SHALL show a feedback page that summarizes the completed session, including completion confirmation, modality-specific score or quality feedback, and encouragement cues such as badges or progress prompts.

#### Scenario: Training completion leads to a feedback page
- **WHEN** a student completes training and submits the short questionnaire
- **THEN** the system SHALL display the training feedback page for that session

### Requirement: Students SHALL have a personal growth center with trend visualizations
The system SHALL provide a student growth center that shows personal training and assessment history using student-friendly charts and summaries. The growth center SHALL support trend views for adherence, questionnaire outcomes, and training activity over time.

#### Scenario: Growth center shows trend views
- **WHEN** a student opens the growth center
- **THEN** the system SHALL display chart-based summaries of the student’s recorded activity and assessment history

### Requirement: Students SHALL see an adherence calendar or heatmap
The system SHALL provide a visual adherence history such as a calendar or heatmap that shows whether the student met training goals across recent days.

#### Scenario: Adherence view shows daily completion history
- **WHEN** a student opens the adherence history area
- **THEN** the system SHALL show a day-level visual record of completed and incomplete training days

### Requirement: The growth center SHALL surface motivational achievement elements
The system SHALL include motivational achievement elements such as badges, trophy-style milestones, streak indicators, or other encouragement markers tied to adherence and participation.

#### Scenario: Student earns a visible achievement
- **WHEN** a student satisfies an achievement condition defined by the product
- **THEN** the system SHALL display the achievement in the student growth experience

### Requirement: The growth center SHALL display imported physical metrics when available
If external body-test or physical-metric data has been associated with the student account, the system SHALL display those metrics and their trends inside the growth center. If such data is not available, the system SHALL provide a non-error empty or unavailable state.

#### Scenario: Imported metrics are available
- **WHEN** a student with associated body-test records opens the growth center
- **THEN** the system SHALL display those metrics and trend views together with other student records

#### Scenario: Imported metrics are unavailable
- **WHEN** a student without associated body-test records opens the physical metrics area
- **THEN** the system SHALL show an empty or unavailable state instead of a broken view

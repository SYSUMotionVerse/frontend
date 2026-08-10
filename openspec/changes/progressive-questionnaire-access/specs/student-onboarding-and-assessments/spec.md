## MODIFIED Requirements

### Requirement: Required assessments SHALL use progressive validated questionnaire presentation

The system SHALL present one backend-defined questionnaire at a time and one item at a time. It SHALL render the questionnaire's reviewed instructions, response legend, question wording, and option wording without inventing scoring semantics or instrument boundaries.

#### Scenario: Student begins the assessment plan

- **WHEN** a student opens a required assessment checkpoint
- **THEN** the system SHALL explain the total number of questionnaires and estimated total time without showing the study-wide item count
- **AND** the system SHALL open the first incomplete questionnaire

#### Scenario: Student answers a Likert item

- **WHEN** the active questionnaire defines a numeric response legend
- **THEN** the system SHALL show what each numeric value means
- **AND** the system SHALL submit the backend option identifier rather than a client-invented score

#### Scenario: Student completes one questionnaire

- **WHEN** every item in the active questionnaire is answered and server submission succeeds
- **THEN** the system SHALL mark that questionnaire complete
- **AND** the system SHALL advance to the next incomplete questionnaire

### Requirement: Questionnaire work SHALL be recoverable

The system SHALL save answer drafts after each response and SHALL retain them until confirmed submission.

#### Scenario: Student returns after leaving the page

- **WHEN** a matching local draft exists
- **THEN** the system SHALL restore answers and the last active item

#### Scenario: Submission times out

- **WHEN** final submission fails or times out
- **THEN** the system SHALL preserve all answers
- **AND** the student SHALL be able to retry without re-answering completed items

#### Scenario: Answers are missing

- **WHEN** the student attempts to submit with unanswered items
- **THEN** the system SHALL report the number remaining
- **AND** the system SHALL navigate directly to the first unanswered item

### Requirement: Incomplete assessments SHALL permit browse-only product preview

The system SHALL allow students with incomplete required assessments to browse motivating product content while preventing training execution and protected result actions.

#### Scenario: Student previews the training catalog

- **WHEN** a required questionnaire remains incomplete
- **THEN** the student SHALL be able to view available training modes and product explanations
- **AND** all training start actions SHALL remain locked with a clear path back to the questionnaire

#### Scenario: Student opens a protected session route

- **WHEN** the student has browse-only access
- **THEN** the system SHALL prevent session execution
- **AND** the system SHALL return the student to an unlock explanation or the current questionnaire


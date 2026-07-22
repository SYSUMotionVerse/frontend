## MODIFIED Requirements

### Requirement: Visual training provides local action-quality feedback

The Mini Program SHALL derive movement angles from live pose inference, SHALL group those angles by active arrangement item, and SHALL compute a deterministic score after each scorable action ends.

#### Scenario: An action has a valid standard and pose sequence

- **WHEN** the active action ends with usable pose angle frames and a valid matching standard action file
- **THEN** the client computes the action score and angle-specific feedback locally
- **AND** no backend scoring round trip is required before the next workout phase begins

#### Scenario: An action cannot be scored

- **WHEN** the standard action file is unavailable or the active action has no usable angle frames
- **THEN** that action is marked unavailable for scoring
- **AND** the guided session continues and may still count as completed

### Requirement: Session score aggregates valid action scores

The Mini Program SHALL aggregate successfully scored actions using their configured expected durations and SHALL omit unavailable actions from the denominator.

#### Scenario: At least one action is scored

- **WHEN** a visual training session finishes with one or more valid action scores
- **THEN** the session result contains a 0-100 aggregate score, summary, per-action results, and the scoring implementation version

#### Scenario: No action is scored

- **WHEN** no visual action yields a valid score
- **THEN** the session remains completed with no quality score
- **AND** the result explains that usable scoring data was unavailable

### Requirement: Backend persists but does not invent visual scores

The backend SHALL validate and store an optional client-computed visual score and SHALL NOT generate a random replacement score.

#### Scenario: Client submits a valid score

- **WHEN** the client submits a finite score between 0 and 100
- **THEN** the exercise record stores that score and its client scoring metadata

#### Scenario: Client submits no score

- **WHEN** a completed guided session has no available score
- **THEN** the exercise record is completed with a null score
- **AND** the session still contributes to training completion according to the existing completion rules

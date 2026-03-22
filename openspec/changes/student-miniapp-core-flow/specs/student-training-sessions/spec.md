## ADDED Requirements

### Requirement: Students SHALL be able to freely choose a training modality for each session
The system SHALL let the student choose among Wushu, HIIT, and stair-climbing every time a new training session starts. The system SHALL NOT lock the student into a permanent modality assignment within the student-side flow.

#### Scenario: Student selects a modality before training
- **WHEN** a student starts a new training session from the home flow
- **THEN** the system SHALL present Wushu, HIIT, and stair-climbing as selectable options

### Requirement: Wushu and HIIT sessions SHALL use guided split-screen training
For Wushu and HIIT sessions, the system SHALL provide a guided training layout that shows the teacher’s standard video in one panel and the student’s live camera view in another panel. The system SHALL support motion-analysis feedback during or after the session.

#### Scenario: Visual training session shows guidance and live participation
- **WHEN** a student starts a Wushu or HIIT session
- **THEN** the system SHALL show the teacher guidance video together with the student camera view in the same training experience

#### Scenario: Visual training session provides analysis feedback
- **WHEN** a Wushu or HIIT session ends
- **THEN** the system SHALL provide motion-analysis scoring, comments, or corrective feedback based on the captured session data

### Requirement: Stair-climbing sessions SHALL use a guided sensor-based training flow
For stair-climbing sessions, the system SHALL run a guided training flow centered on a 30-second exercise period and SHALL capture the configured device motion sensor data during the session. This change SHALL NOT require barometer or step-count integrations for stair-climbing completion or feedback.

#### Scenario: Stair-climbing session starts a timed sensor flow
- **WHEN** a student starts a stair-climbing session
- **THEN** the system SHALL present the guided stair-climbing flow and begin the configured timed training period

#### Scenario: Stair-climbing session captures sensor data
- **WHEN** a stair-climbing session is active
- **THEN** the system SHALL capture the configured motion sensor data for later analysis and feedback

### Requirement: Interrupted guided sessions SHALL restart from the beginning
If a student leaves, closes, or interrupts a guided training session before it reaches the end, the next attempt SHALL begin from the start of that session rather than resuming from the interruption point.

#### Scenario: Interrupted visual session restarts
- **WHEN** a student exits a Wushu or HIIT session before completion and later starts it again
- **THEN** the system SHALL restart that session from the beginning

#### Scenario: Interrupted stair-climbing session restarts
- **WHEN** a student exits a stair-climbing session before completion and later starts it again
- **THEN** the system SHALL restart that session from the beginning

### Requirement: Guided-session completion SHALL define whether a training session is completed
The system SHALL count a training session as completed when the student reaches the end of the guided training flow for the selected modality. AI recognition quality, sensor-derived quality, or score thresholds SHALL NOT be required for the session to count as completed.

#### Scenario: Session completes when guided flow reaches the end
- **WHEN** a student follows a selected training session until the video or guided timer finishes
- **THEN** the system SHALL record the session as completed

#### Scenario: Low recognition quality does not cancel completion
- **WHEN** a session finishes but AI or sensor analysis reports poor quality or incomplete confidence
- **THEN** the system SHALL still mark the session as completed while showing the quality feedback separately

## ADDED Requirements

### Requirement: The stair session SHALL guide the complete five-minute ES protocol
The student stair-training flow SHALL run the supplied 300-second protocol and show the current warm-up, preparation, sprint, recovery, stretching, or completion phase.

#### Scenario: Student starts stair training
- **WHEN** the student confirms the pre-start safety notice and starts training
- **THEN** the session SHALL begin at 05:00 remaining and advance through the documented phase boundaries

### Requirement: The stair session SHALL provide hands-free spoken guidance
The client SHALL play the supplied narration at 00:00, 00:45, 01:30, 01:50, 02:00, 02:15, 02:25, 02:30, 03:30, 04:00, 04:30, and 05:00.

#### Scenario: Adjacent prompts are scheduled
- **WHEN** the five-minute session runs normally
- **THEN** each prompt SHALL finish before the next prompt begins

#### Scenario: Session leaves the foreground
- **WHEN** the stair page is hidden, interrupted, or unmounted
- **THEN** pending and active stair narration SHALL stop

### Requirement: Stair evidence SHALL cover only the sprint interval
The client SHALL collect stair motion and horizontal evidence from 02:00 through 02:30, independently of the surrounding guided warm-up and recovery.

#### Scenario: Sprint begins
- **WHEN** elapsed session time reaches 02:00
- **THEN** stair sensor and horizontal evidence capture SHALL start

#### Scenario: Sprint ends
- **WHEN** elapsed session time reaches 02:30
- **THEN** capture SHALL stop with a 30-second measured duration while the guided session continues

### Requirement: Completion SHALL preserve the existing stair submission flow
The client SHALL sync the completed guided session through the existing stair endpoint and then open the short questionnaire.

#### Scenario: Five-minute protocol completes
- **WHEN** elapsed session time reaches 05:00
- **THEN** the client SHALL submit a 300-second stair session using sprint-derived quality and eligibility, play completion feedback, and open the short questionnaire

## ADDED Requirements

### Requirement: The home experience SHALL reflect progress toward the daily training target
The student home flow SHALL show the student’s current progress toward the daily target of three valid check-ins, together with the current daily completion status and weekly adherence status.

#### Scenario: Home shows daily progress
- **WHEN** a student opens the Mini Program during a normal training day
- **THEN** the system SHALL show the student’s current valid daily training count and progress toward the three-check-in target

### Requirement: Reminder handling SHALL follow the documented 18:00 daily scan
The system SHALL support reminder-driven re-entry through WeChat notifications using the documented daily reminder rule. At 18:00, if the student’s valid daily training count is below three, the system SHALL treat the student as reminder-eligible.

#### Scenario: Daily reminder eligibility is determined at 18:00
- **WHEN** the system evaluates a student’s daily valid training count at 18:00 and the count is below three
- **THEN** the system SHALL mark the student as eligible for a WeChat reminder

#### Scenario: Reminder return opens the daily progress context
- **WHEN** a student returns to the Mini Program from a daily reminder
- **THEN** the system SHALL show the student’s current incomplete daily progress and a clear action to start training

### Requirement: Completed sessions SHALL record valid daily check-ins
When a student completes a training session, the system SHALL record one valid daily check-in until the student reaches the daily maximum of three valid check-ins.

#### Scenario: Completed session increments valid daily count
- **WHEN** a student completes a training session and has fewer than three valid check-ins recorded for the day
- **THEN** the system SHALL increment the valid daily training count by one

### Requirement: Daily valid check-ins SHALL be capped at three
The system SHALL record no more than three valid daily check-ins for adherence purposes. Additional completed training sessions after the third valid check-in SHALL NOT increase the daily valid count.

#### Scenario: Additional session does not increase valid count past three
- **WHEN** a student completes a fourth training session on the same day
- **THEN** the system SHALL keep the daily valid training count capped at three

### Requirement: Weekly adherence SHALL be derived from active days
The system SHALL evaluate the weekly adherence goal based on whether the student achieved the daily goal on at least three separate days within the week.

#### Scenario: Weekly adherence becomes achieved after three qualifying days
- **WHEN** a student reaches the effective daily goal on three different days in the same week
- **THEN** the system SHALL mark the weekly adherence target as achieved

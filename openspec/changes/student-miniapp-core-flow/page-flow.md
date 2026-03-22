# Student Mini Program Page Flow

This document translates the OpenSpec change into page-level flows for product, design, and frontend planning.

Scope: WeChat Mini Program student side only.  
Student-side stack: `uni-app + Vue 3 + TypeScript`
Student-side styling: `UnoCSS + unocss-preset-weapp + SCSS`

## 1. High-Level Flow Map

```text
                    ┌────────────────────┐
                    │  Open Mini Program │
                    └─────────┬──────────┘
                              │
                  ┌───────────┴───────────┐
                  │                       │
            No completed profile      Completed profile
                  │                       │
                  ▼                       ▼
      ┌────────────────────┐   ┌──────────────────────────┐
      │ A1 Registration    │   │ Check active long survey │
      └─────────┬──────────┘   └────────────┬─────────────┘
                │                           │
                ▼                           ▼
      ┌────────────────────┐     Incomplete checkpoint?
      │ A2 Long Survey     │           │
      └─────────┬──────────┘      ┌────┴────┐
                │                 │         │
                ▼                Yes        No
      ┌────────────────────┐      │         │
      │ A3 Survey Result   │      ▼         ▼
      └─────────┬──────────┘  ┌──────────┐ ┌──────────────┐
                │             │ A2 Long  │ │ B1 Home      │
                │             │ Survey   │ │ Daily Hub    │
                │             └────┬─────┘ └──────┬───────┘
                │                  │              │
                └──────────────────┴──────────────┘
                                               │
                                               ▼
                                      ┌──────────────────┐
                                      │ B2 Training Pick │
                                      └────────┬─────────┘
                                               │
                             ┌─────────────────┼─────────────────┐
                             │                 │                 │
                             ▼                 ▼                 ▼
                    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
                    │ B3 Wushu     │  │ B3 HIIT      │  │ B4 Stair     │
                    │ / HIIT       │  │ / HIIT       │  │ Training     │
                    └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
                           │                 │                 │
                           └─────────────────┴─────────────────┘
                                               │
                                               ▼
                                      ┌──────────────────┐
                                      │ B5 Short Survey  │
                                      └────────┬─────────┘
                                               │
                                               ▼
                                      ┌──────────────────┐
                                      │ B6 Session       │
                                      │ Feedback         │
                                      └───────┬──────────┘
                                              │
                        ┌─────────────────────┴─────────────────────┐
                        │                                           │
                        ▼                                           ▼
               ┌──────────────────┐                       ┌──────────────────┐
               │ B1 Home          │                       │ C1 Growth Center │
               └──────────────────┘                       └────────┬─────────┘
                                                                   │
                              ┌────────────────────────────────────┼────────────────────────────────────┐
                              ▼                                    ▼                                    ▼
                     ┌──────────────────┐                ┌──────────────────┐                ┌──────────────────┐
                     │ C2 Calendar /    │                │ C3 Trend Charts  │                │ C4 Badges /      │
                     │ Heatmap          │                └──────────────────┘                │ Achievements     │
                     └──────────────────┘                                                    └──────────────────┘
                                                                   │
                                                                   ▼
                                                          ┌──────────────────┐
                                                          │ C5 Physical      │
                                                          │ Metrics          │
                                                          └──────────────────┘
```

## 2. Access and Assessment Flow

```text
Open App
  │
  ├─ If no completed profile
  │    → A1 Registration
  │    → A2 Long Survey
  │    → A3 Survey Result
  │    → B1 Home
  │
  └─ If completed profile exists
       → Check whether week 4 / 8 / 12 survey is incomplete
            ├─ Yes → A2 Long Survey → A3 Survey Result → B1 Home
            └─ No  → B1 Home
```

### Access Rules
- Registration is mandatory before any training.
- Long survey is mandatory at baseline, week 4, week 8, and week 12.
- If the active long survey is incomplete, the app goes directly to it.
- The student cannot enter training until the active long survey is submitted.

## 3. Daily Training Flow

```text
B1 Home
  │
  └─ Start Training
       │
       ▼
    B2 Training Selection
       │
       ├─ Wushu → B3 Wushu / HIIT Training
       ├─ HIIT  → B3 Wushu / HIIT Training
       └─ Stair → B4 Stair Training
                    │
                    ▼
              Guided session reaches end
                    │
                    ▼
               B5 Short Survey
                    │
                    ▼
               B6 Session Feedback
                    │
                    ├─ Back to B1 Home
                    └─ Go to C1 Growth Center
```

### Training Rules
- Students freely choose Wushu, HIIT, or stair-climbing each time.
- Wushu / HIIT use teacher video + student camera split-screen.
- Stair-climbing uses a guided 30-second sensor flow.
- Stair-climbing does not require barometer or step-count integration in this change.
- A session counts as completed when the guided flow reaches the end.
- AI/sensor quality affects feedback, not completion.

## 4. Interrupted Session Flow

```text
During B3 or B4
  │
  ├─ Student finishes guided flow
  │    → B5 Short Survey
  │
  └─ Student exits / interrupts early
       → Session is not completed
       → Next attempt starts from the beginning
```

### Interruption Rules
- There is no resume-from-progress behavior in this change.
- Restart behavior applies to both visual and stair-climbing sessions.

## 5. Reminder Flow

```text
Daily 18:00 system check
  │
  ├─ If valid daily count >= 3
  │    → No reminder needed
  │
  └─ If valid daily count < 3
       → Student is reminder-eligible
       → WeChat subscription reminder is sent
       → Student reopens app
       → B1 Home shows incomplete daily progress
```

### Reminder Rules
- Reminder eligibility is based on the 18:00 check.
- Daily target is 3 valid check-ins.
- Weekly target is at least 3 qualifying days.
- Daily valid count is capped at 3 for adherence purposes.

## 6. Growth and Records Flow

```text
From B1 Home or B6 Session Feedback
  │
  ▼
C1 Growth Center
  │
  ├─ C2 Calendar / Heatmap
  ├─ C3 Trend Charts
  ├─ C4 Badges / Achievements
  └─ C5 Physical Metrics
```

### Growth Rules
- Growth Center is the student-side history hub.
- Calendar / Heatmap shows daily adherence history.
- Trend Charts show training and assessment trends.
- Achievements show badges, milestones, or streak-like motivation.
- Physical Metrics displays imported data only when available; otherwise it shows an empty state.

## 7. Maintenance Notes

For frontend implementation and maintenance, the flow can be managed in these route groups:

- `access/*`
  - Registration
  - Long Survey
  - Long Survey Result

- `training/*`
  - Home
  - Training Selection
  - Wushu / HIIT Training
  - Stair Training
  - Short Survey
  - Session Feedback

- `growth/*`
  - Growth Center
  - Calendar / Heatmap
  - Trend Charts
  - Badges / Achievements
  - Physical Metrics

Suggested Vue implementation baseline:
- `uni-app`
- Vue 3
- `<script setup lang="ts">`
- Composition API
- UnoCSS with `unocss-preset-weapp`
- SCSS for page-specific complex styles

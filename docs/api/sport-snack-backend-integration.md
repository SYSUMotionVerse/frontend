# Sport Snack Backend Integration

This document records the backend contract currently used by the student mini-program frontend. It is based on the backend repository at `/Users/pi-dal/sport-snack-backend`, with the API surface cross-checked against the Django view and serializer code.

## Base URL and auth

- Configure `VITE_API_BASE_URL` with the backend API root, for example `http://127.0.0.1:8000/api`.
- The backend uses WeChat login plus a server-side session. The frontend sync layer calls `uni.login()`, then `POST /users/wechat_login/`, and reuses the returned cookie on later requests when available.
- This cookie flow still needs WeChat DevTools confirmation because mini-program cookie behavior can differ from the browser-based test environment.

## Endpoints used by the frontend

| Flow | Method | Path | Notes |
| --- | --- | --- | --- |
| WeChat session bootstrap | `POST` | `/users/wechat_login/` | Required before authenticated calls. |
| Registration profile sync | `PATCH` | `/users/update_profile/` | The backend has no separate profile `POST`. |
| Long questionnaire sync | `POST` | `/psychology/records/submit/` | Stores scale version, raw per-question answers, and score snapshot. |
| Visual session video lookup | `GET` | `/exercises/videos/?exercise_type=...` | Picks the first backend video for the current modality. |
| Visual session record sync | `POST` | `/exercises/records/` | Sends `video` and `duration`. |
| Stair session record sync | `POST` | `/exercises/stairs/` | Sends duration plus lightweight sensor summary JSON. |

## Registration mapping

### Direct `update_profile` mapping

| Frontend field | Backend field | Strategy |
| --- | --- | --- |
| `name` | `name` | Direct mapping |
| `gender` | `gender` | `'男' -> 1`, `'女' -> 2`, other values omitted |
| `studentId` | `student_id` | Direct mapping |
| `major` | `major` | Direct mapping |
| `heightCm` | `height` | Direct mapping |
| `weightKg` | `weight` | Direct mapping |
| `age` | `age` | Direct mapping |
| `grade` | `grade` | Direct mapping |
| `restingHeartRate` | `resting_heart_rate` | Direct mapping |

### Structured registration fields

Research registration fields are stored directly on the backend user profile:

- `age`
- `grade`
- `restingHeartRate`

Registration is not considered synchronized unless the profile update succeeds. The mini-program
also keeps the completed profile in durable local storage, while `/users/me/` restores the
authoritative structured fields on another device.

## Long questionnaire mapping

Startup treats `GET /psychology/scales/next_scale/` as the authoritative due-checkpoint signal
and cross-checks it against the completed psychology records. An unknown message, a skipped
baseline, a duplicate completed checkpoint, or non-sequential records block entry instead of
silently routing to training. When the backend reports all configured scales complete, a
sequential record set beginning at baseline is accepted; the frontend does not assume that four
scales are configured.

The long questionnaire is loaded from the backend psychology scale definition and submitted to
`POST /psychology/records/submit/` with the scale ID, completion time, and answers keyed by backend
question ID. The backend stores an immutable scale/question snapshot and the raw selected answers
alongside the optional calculated score.

## Training session mapping

### Visual sessions (`wushu` / `hiit`)

The visual-session page does not yet hold a backend video ID or a recorded user video file. The frontend currently:

1. Maps modality to backend exercise type:
   - `wushu -> MARTIAL_ARTS`
   - `hiit -> HIIT`
2. Fetches `/exercises/videos/?exercise_type=...`
3. Chooses the first returned video
4. Creates `/exercises/records/` with `{ video, duration }`

This is a compatibility bridge. It should be replaced once the training flow is driven by actual backend exercise content and real captured media.

### Stair sessions

The frontend sends:

```json
{
  "duration": 28,
  "speed_data": {
    "completedIntervals": 1
  },
  "acceleration_data": {
    "qualityScore": 83,
    "summary": "传感器采集很稳定。"
  },
  "steps_count": null,
  "calories": null
}
```

This payload is intentionally minimal because the current mini-program flow only keeps a short local summary, not the raw sensor stream.

## Known gaps and mismatches

### Backend docs vs backend code

- `API_DOCUMENTATION.md` describes a nested `profile` object for the user response.
- The actual Django code in `users/models.py` and `users/serializers.py` stores most profile fields directly on the `User` model.
- `exercises/views.py` references `request.user.profile.exercise_group`, but the current user model exposes `exercise_group` directly on `User`.

Treat the Django code as the source of truth when docs and implementation disagree.

### Missing backend support

- No dedicated student-side POST endpoint exists for the short post-training questionnaire.
  The frontend therefore writes each response to the durable mini-program storage key
  `sport-snack:pending-short-questionnaires` and reports it as pending; it does not claim a
  server sync until a typed backend submission dependency is available.
- No dedicated student-side POST endpoint exists for physical test entry; the documented write path is teacher-only batch upload.
- The frontend register flow still collects `grade` and `restingHeartRate`, but the backend user model does not currently store them as first-class fields.

## Current frontend files

- `src/uni-app/api/backendClient.ts`
- `src/uni-app/api/studentBackend.ts`
- `src/uni-app/pages/access/register.vue`
- `src/uni-app/pages/access/questionnaire.vue`
- `src/uni-app/pages/training/visual-session.vue`
- `src/uni-app/pages/training/stair-session.vue`

## Validation checklist

- Run `pnpm test`
- Run `npx vue-tsc --noEmit`
- In WeChat DevTools, confirm session-cookie reuse after `wechat_login`
- In WeChat DevTools, confirm the configured backend domain is allowed by the mini-program request whitelist

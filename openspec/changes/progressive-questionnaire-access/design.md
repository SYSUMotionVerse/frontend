## Context

The frontend currently receives one `BackendPsychologyScale` containing ordered questions and options. It can submit the complete scale but cannot save partial server progress or identify multiple instruments inside a 119-item payload. Startup routes incomplete students directly to the questionnaire, so none of the product value is visible before completion.

## Goals / Non-Goals

**Goals:**

- Reduce fatigue by showing one item at a time with clear progress inside the current questionnaire.
- Preserve answers across navigation, reload, timeout, and retry.
- Keep validated questionnaire semantics authoritative and auditable.
- Let students browse motivating product content before completing the required assessment while preventing training execution.
- Make missing answers directly locatable.

**Non-Goals:**

- Inventing questionnaire boundaries from question position or prompt keywords.
- Inventing what scores 1 through 5 mean.
- Rewriting research-owned question wording or scoring without reviewed backend data.
- Treating local draft persistence as confirmed research-data submission.

## Decisions

### 1. Questionnaire boundaries come from backend metadata

The backend SHALL provide a questionnaire plan for the active checkpoint. Each plan contains the total questionnaire count, estimated total minutes, current questionnaire, ordered instrument IDs, and completion state. A scale/instrument includes its own title, instructions, response legend, questions, and estimated minutes.

Until this contract exists, the frontend presents the current backend scale as one questionnaire. It SHALL NOT split 119 items into invented thematic questionnaires.

### 2. One item is visible at a time

The runner shows the current prompt, the reviewed response legend, the exact backend options, and previous/next controls. Selecting an answer saves immediately and advances only through an explicit next action so accidental taps can be corrected.

The item header shows current position inside the current questionnaire, not the intimidating study-wide total.

### 3. Drafts use local durable storage immediately

The client stores an envelope keyed by student/checkpoint/scale with scale ID, answer map, current question index, and update time. Invalid or mismatched drafts are ignored. Confirmed submission clears the draft. Failed submission leaves it intact.

Server-side per-questionnaire draft sync is a follow-up backend capability; local persistence must never be described as server completion.

### 4. Response semantics are rendered, not inferred

For Likert items, the backend supplies the exact numeric legend, for example `1 = 从不` through `5 = 总是`, if that is the validated instrument definition. The frontend displays the legend consistently above the options.

For duration or range questions, the backend supplies reviewed non-overlapping intervals such as `15分钟 ≤ t < 30分钟` and `30分钟 ≤ t < 1小时`. The frontend does not normalize or guess missing intervals.

### 5. Preview mode separates discovery from execution

Incomplete students may open home, the training catalog, and growth education pages with a persistent “完成问卷后解锁训练” notice. Training session navigation, reminder authorization, and personal result actions remain disabled.

Preview state is derived from authoritative bootstrap access status. Query parameters may carry navigation intent but are not trusted as proof of eligibility.

### 6. Submission failure keeps context

If validation finds unanswered items, the runner jumps directly to the first unanswered item and shows the remaining count. If the network request times out, all local answers and the current position remain. Retry submits the same answer map without requiring re-entry.

## Backend Contract Required

- `GET /psychology/questionnaire-plan/`
  - active checkpoint
  - questionnaire count
  - estimated total minutes
  - ordered questionnaire summaries and completion state
- Scale detail metadata:
  - validated instrument title and instructions
  - estimated minutes
  - response legend
  - reviewed question and option text
- Optional server draft endpoint keyed by questionnaire and student.
- Existing final scale submission remains the completion boundary until per-questionnaire endpoints are introduced.

## Reviewed baseline definition (2026-07-30)

The authoritative source is `0730 ES干预研究最终量表 李.docx`
(SHA-256 `b541bad3e32e8da5e665387f69aa4dae5eeae498238994281b38a19ee0cc4b32`).
The baseline contains 10 separately submitted questionnaires in this order:
TAPAS, FFMQ-SF, SRSS, GMS-20, BRS, DASS-21, GPAQ, TPB, CSCCS, and PASS-10.
Together they contain 165 source-numbered items and have an estimated total
duration of 34 minutes. FS and FAS remain exercise pre/post measures and are
not part of the onboarding baseline.

The previous 119-item aggregate is retained as inactive legacy data so its
existing records and answer identifiers remain auditable. It is not treated as
equivalent to the reviewed baseline.

## Risks / Trade-offs

- Local drafts can be lost if WeChat storage is cleared. The UI must call them “已保存在本机”, not “已提交”.
- Preview access adds more route states. A shared access guard is required so training cannot be started from a deep link.
- Existing backend option data may contain ambiguous intervals. Those records must be corrected at the source rather than patched only in the client.

# PRD：训练提醒完整交付链路

## Problem Statement

测试参与者每天需要完成武术跟练、HIIT 跟练和楼梯训练三种不同训练，并在一周内至少有 3 个达标日。当前小程序虽然显示“18:00 提醒”并能识别模拟的提醒回流参数，但不会请求微信订阅授权，也没有实际发送微信消息。后端现有提醒接口只为当前登录用户创建一条站内数据库记录，不具备全量定时扫描、微信发送、可靠幂等或完整审计能力。

当前每日训练统计还只计算视觉跟练，不计算楼梯训练，也无法表达“同一种训练重复完成不增加当日有效进度”的规则。如果直接基于现状发送提醒，已经训练的参与者可能被误判，重复执行定时任务也可能造成重复通知。

项目需要一条可验证的完整提醒链路：以统一训练完成事实计算进度，在北京时间 12:00 和 18:00 扫描活跃参与者，同时生成站内提醒并在获得授权和配置后发送微信长期订阅消息，记录所有结果并支持从提醒回到训练首页。

## Solution

建立统一的训练完成事件，作为每日三种训练进度与每周达标日的唯一事实来源。每次完整训练保存一个带唯一会话 ID 的完成事件；同一种训练在同一天只有第一次贡献有效进度，后续重复训练仍保存但不增加进度。

后端在 `Asia/Shanghai` 时区使用 Linux cron 触发 Django management command：12:00 时仅提醒当天尚未完成任何训练的活跃参与者；18:00 时提醒尚未完成三种训练的活跃参与者。每周已有 3 个达标日的参与者在当周剩余日期不再接收训练提醒。

每次符合条件的扫描创建一条幂等提醒任务和站内通知。微信发送通过可替换的发送器完成：长期订阅权限或模板尚未配置时明确记录“未配置”，已授权并配置后调用微信接口。网络临时错误最多重试 3 次；永久错误不重试。学生点击微信提醒后进入训练首页，查看三种训练的完成状态与未完成项目；系统记录提醒回流以供研究评估。

第一版使用训练首页提醒入口和站内通知列表向学生呈现通知，使用现有 Django Admin 能力提供研究管理员审计，不开发独立管理后台。微信提醒模板只包含提醒时间、今日进度、未完成项目和简短提示，不包含动作评分、心理量表或其他健康数据。

## User Stories

1. As a test participant, I want to receive a reminder at 12:00 when I have not completed any training, so that I remember to begin the day's exercise plan.
2. As a test participant, I want to receive another reminder at 18:00 when I have not completed all three training types, so that I can finish the remaining work.
3. As a test participant, I want the evening reminder to tell me which training types remain, so that I know what to do next.
4. As a test participant, I want completing martial-arts follow-along training to update today's progress, so that the reminder reflects my actual activity.
5. As a test participant, I want completing HIIT follow-along training to update today's progress, so that the reminder reflects my actual activity.
6. As a test participant, I want completing stair training to update today's progress, so that stair activity is not ignored.
7. As a test participant, I want repeated completion of one training type to remain in my history without counting as another distinct daily training type, so that my record is complete without distorting progress.
8. As a test participant, I want my first completion of each training type to count regardless of its quality score, so that reminder eligibility is based on completion rather than model accuracy.
9. As a test participant, I want network retries of the same completion submission to count only once, so that my progress is not inflated.
10. As a test participant, I want reminders to stop for the rest of a week after I have completed three qualifying days, so that the app does not imply a seven-day requirement.
11. As a test participant, I want weekly reminder eligibility to reset on Monday, so that each study week has a predictable boundary.
12. As a test participant, I want to understand why the app requests WeChat reminder permission, so that I can make an informed choice.
13. As a test participant, I want to continue using the app if I decline WeChat subscription permission, so that notification consent is not a training access gate.
14. As a test participant, I want a visible way to retry WeChat authorization after declining it, so that I can opt in later without repeated startup prompts.
15. As a test participant, I want station notifications even when WeChat delivery is unavailable, so that reminders remain visible inside the app.
16. As a test participant, I want an unread indicator and notification list, so that I can find reminders after opening the app manually.
17. As a test participant, I want clicking a WeChat reminder to open today's training overview, so that I can choose an unfinished training type.
18. As a test participant, I want today's overview to show the completion state of all three training types, so that the reminder is actionable.
19. As a test participant, I want the app to avoid repeated authorization popups on every launch, so that declining once does not make the app unusable.
20. As a research administrator, I want only active test participants to be scanned, so that people who leave the study receive no further reminders.
21. As a research administrator, I want station reminders to remain enabled for active participants, so that the test protocol is applied consistently.
22. As a research administrator, I want to see whether each participant qualified for the 12:00 and 18:00 reminders, so that I can audit protocol execution.
23. As a research administrator, I want to see the participant's daily distinct-training progress and weekly qualifying-day count at decision time, so that reminder decisions are explainable.
24. As a research administrator, I want to distinguish station notification creation from WeChat delivery, so that one channel cannot hide failure in the other.
25. As a research administrator, I want to see WeChat states including pending, sent, failed, unauthorized, and unconfigured, so that operational gaps are visible.
26. As a research administrator, I want to see send attempts, timestamps, and failure reasons, so that transient and permanent failures can be diagnosed.
27. As a research administrator, I want to know whether a participant returned through a reminder, so that reminder effectiveness can be evaluated.
28. As a research administrator, I want to view reminder audit data through the existing administration surface, so that the first version does not require a new management application.
29. As an operator, I want the 12:00 and 18:00 scans to run from explicit management commands, so that Linux cron can schedule and observe them simply.
30. As an operator, I want repeated or concurrent execution of a scan to produce at most one reminder per participant, date, and slot, so that operational retries are safe.
31. As an operator, I want transient WeChat failures retried without duplicating the reminder, so that delivery is resilient.
32. As an operator, I want permanent WeChat failures recorded without pointless retries, so that bad configuration or missing consent is actionable.
33. As an operator, I want late retries to stop after the reminder window expires, so that stale reminders are not delivered hours later.
34. As a developer, I want a fake WeChat sender, so that eligibility, delivery state, retries, and idempotency can be tested before long-term subscription access is approved.
35. As a developer, I want missing template configuration to skip WeChat delivery explicitly rather than report success, so that test environments do not create false confidence.
36. As a developer, I want one reminder template for both daily slots, so that template management stays simple.
37. As a privacy-conscious stakeholder, I want reminder messages to omit scores, psychology results, and health measurements, so that lock-screen notifications expose minimal information.
38. As a project owner, I want the repository documentation to identify long-term subscription approval and real-device verification as release blockers, so that incomplete platform setup is not mistaken for production readiness.

## Implementation Decisions

- Introduce a unified training completion event as the authoritative fact for reminder progress. It records the participant, globally unique training session ID, one of the three supported training types, completion time, local training date, and whether it contributed the first completion of that type for the day.
- Preserve existing modality-specific records for detailed history and analysis. Creation of a successfully completed modality record and its unified completion event must be one reliable application operation.
- Enforce idempotency for training completion by unique session ID. Enforce at most one progress contribution per participant, local date, and training type while retaining duplicate-type completion history.
- Define a qualifying day as a local date on which all three distinct training types have contributed progress. Define the study week as Monday through Sunday in `Asia/Shanghai`.
- At 12:00, a participant qualifies only when today's distinct-training count is zero. At 18:00, a participant qualifies when today's count is below three. A participant with three qualifying days in the current week does not qualify for further reminders that week.
- Scan only active test participants. Active participants cannot disable station reminders in the student app. WeChat delivery always respects platform authorization and subscription availability.
- Represent 12:00 and 18:00 as explicit reminder slots. Persist one reminder delivery record per participant, local date, and slot, protected by a database unique constraint.
- Create the station notification as part of the persisted reminder workflow. Track station creation and WeChat delivery as separate statuses.
- Use a WeChat delivery interface with production and fake implementations. The production implementation owns access-token retrieval and caching, template payload validation, API calls, and provider error classification.
- Use one configurable long-term subscription template for both slots. Keep the template ID and credentials in server-side environment configuration, never in frontend business code.
- Treat absent template configuration, missing authorization, and exhausted subscription availability as explicit non-success outcomes.
- Retry only transient provider or network failures, at most three times within a short configurable delivery window. Reuse the same delivery record and idempotency key for every attempt. Do not deliver after the slot window closes.
- Trigger the reminder use case with a Django management command scheduled by Linux cron at 12:00 and 18:00. Do not introduce Celery, Redis, or Celery Beat in the first version.
- After registration and baseline questionnaire completion, show a reminder explanation before the first training-home visit. Invoke the WeChat authorization prompt only after an explicit user action.
- If authorization is declined, allow normal app use and expose a retry action from the training-home reminder status. Do not prompt again automatically on every startup.
- Add a training-home reminder entry with unread state and a station notification list. A reminder opens the training overview rather than a specific modality.
- Include a reminder record or opaque tracking identifier and the reminder slot in the WeChat page target. Treat all incoming query values as untrusted and resolve progress from authenticated backend state.
- Record reminder-driven return once the authenticated app resolves a valid tracking identifier. Return tracking does not itself mark a station message read unless the user views that message.
- Extend the existing Django Admin for participant activation, subscription state, reminder decisions, delivery attempts, and return status. A separate administrator application is not part of this version.
- Retain reminder audit data for the duration of the study. Do not add automated deletion until the study's retention policy is formally specified; exports and later deletion must follow the approved research data policy.
- Document long-term subscription eligibility, template approval, configuration, and real-device acceptance as release blockers. Until they are complete, the feature may be described only as station reminders plus a tested WeChat integration seam.
- The frontend repository remains the issue-tracking home for this cross-repository initiative. Issues that require the separate backend repository must say so explicitly and remain end-to-end vertical slices rather than frontend-only placeholders.

## Testing Decisions

- The primary behavioral seam is a reminder scan use case invoked with a slot, current time, persisted participant/training state, and a fake WeChat sender.
- High-level backend tests prepare active and inactive participants, authorization state, unified completion events, and prior reminder records; run one scan; then assert eligibility, station notification creation, WeChat outcome, attempts, idempotency, and return-audit state.
- Test the 12:00 zero-completion rule, 18:00 incomplete-three-types rule, three-distinct-type requirement, repeated modality behavior, Monday-to-Sunday boundaries, and weekly three-day stop condition.
- Test repeated and concurrent scan execution against the database uniqueness boundary rather than mocking internal helper calls.
- Test transient failures, permanent failures, missing configuration, missing authorization, retry exhaustion, and delivery-window expiry through the sender interface.
- Test each training completion flow at the API/application seam to prove that visual and stair training both create the same authoritative completion fact and that retrying a session ID is idempotent.
- Frontend behavior tests cover the explanation and authorization states, refusal and retry, three-type progress rendering, unread station notification behavior, notification navigation, and reminder return parameters.
- Frontend tests do not duplicate server-side reminder eligibility rules. They consume backend-provided progress and notification state.
- Follow the repository's existing behavior-focused Vitest conventions for the mini-program frontend and the backend repository's Django API/test conventions for server behavior.
- Avoid snapshot-heavy assertions and direct assertions on private implementation details.
- Before completion, run frontend Vitest and Vue TypeScript checks, backend reminder and training tests, an integration scan against a test database, and WeChat DevTools plus real-device acceptance with the approved long-term template.

## Out of Scope

- Student-selected weekly training days.
- Student control for disabling station reminders while remaining an active test participant.
- A custom research-administrator frontend.
- More than two reminder slots per day or per-user reminder times.
- Different WeChat templates for midday and evening.
- Celery, Redis, Celery Beat, or a general-purpose distributed task queue.
- Using quality scores to determine whether a completed training type counts.
- Including psychology, health measurements, or action scores in notification content.
- Automatically resuming or launching a specific training modality from a reminder.
- Defining the study's final data-deletion policy; this requires an approved research retention requirement.
- Claiming production WeChat delivery before long-term subscription access, template approval, configuration, and real-device acceptance are complete.

## Further Notes

- The current AppID has not yet been granted long-term subscription message access. The project owner intends to enable it later; this must remain visible in project documentation and release checks.
- Long-term subscription access is generally restricted to eligible public-service categories. The project must confirm the approved education category and available template fields in the WeChat public platform rather than assuming eligibility from the app's research purpose.
- The existing backend deployment documentation refers to a reminder-sending function that is absent from the code. Replace that example with the implemented management command during delivery.
- The current frontend contains three untracked multipart RAR files unrelated to this initiative. They are not part of this PRD and must not be modified or committed as reminder work.

# 前后端 API 未衔接项清单（2026-04-12）

以下清单基于 `docs/api/sport-snack-backend-integration.md` 中的缺口描述，并对照当前前端实现（`src/uni-app/**`）整理。

| 序号 | 未衔接项 | API 文档依据 | 前端现状依据 | 影响 |
| --- | --- | --- | --- | --- |
| 1 | 头像上传没有统一后端接口 | `docs/api/sport-snack-backend-integration.md:108` 明确写到“无后端头像上传 endpoint” | `src/uni-app/composables/useRegistrationAvatar.ts:17` 依赖 `VITE_AVATAR_UPLOAD_URL`；`83-113` 走 `uni.uploadFile` 到外部 URL；`84-86` 未配置时直接回填本地路径 | 头像资产无法通过统一业务 API 管理，环境切换和数据落库一致性风险高 |
| 2 | 训练后短问卷没有后端提交接口 | `docs/api/sport-snack-backend-integration.md:109` 明确写到“无学生端短问卷 POST endpoint” | `src/uni-app/pages/training/short-questionnaire.vue:10-13` 仅写本地 store（`submitShortQuestionnaireForLatestSession`），无 API 调用 | 训练后主观反馈无法落库，无法用于后续评估与推荐 |
| 3 | 体测数据缺少学生端写入接口 | `docs/api/sport-snack-backend-integration.md:110` 说明当前写入链路为教师侧批量上传 | `src/uni-app/api/backendClient.ts:288-290` 仅有 `GET /physical-tests/trend/`；`src/uni-app/pages/growth/metrics.vue:15-18` 仅做读取 | 学生端无法自助补录体测，数据采集闭环不完整 |
| 4 | 注册字段与后端用户模型未完全衔接（`grade`、`restingHeartRate`） | `docs/api/sport-snack-backend-integration.md:111` 指出用户模型无一等字段 | `src/components/access/RegistrationForm.vue:23,26` 采集了 `grade`、`restingHeartRate`；`src/uni-app/api/studentBackend.ts:75-82` 未写入 `update_profile`；`85-97` 仅作为 `survey-records.analysis` 兜底 JSON | 关键注册字段不可结构化查询，后续统计和画像会受限 |
| 5 | 视觉训练记录仍是过渡桥接，不是完整媒体链路 | `docs/api/sport-snack-backend-integration.md:64-74` 标注“兼容桥接，应替换为真实训练内容和媒体” | `src/uni-app/api/studentBackend.ts:365-375` 取第一条视频后仅上报 `{ video, duration }`；`src/uni-app/pages/training/visual-session.vue:26-45` 训练分析仍在前端本地生成 | 后端训练记录颗粒度不足，难以支撑回放、质检和精细化评估 |

## 额外发现：文档契约与当前前端路径不一致

这部分不属于“未衔接”，但会直接影响联调效率，建议和上面缺口一起修正：

- `docs/api/sport-snack-backend-integration.md:15-16` 写的是 `/users/wechat_login/`、`/users/update_profile/`
- 当前前端实际调用是 `/users/users/wechat_login/`、`/users/users/update_profile/`（`src/uni-app/api/backendClient.ts:217-232`）

建议在后续迭代中将 API 文档路径统一到当前真实路由，避免联调时出现“按文档调不通”的假故障。

# 前后端 API 缺口校验（2026-05-04）

这份文档记录了 2026-05-04 对 `sport-snack` 前端仓库与 `sport-snack-backend` 后端仓库做的静态代码校验结果。

校验目标不是复述旧文档，而是直接对照：

- 前端实际调用了哪些 API
- 后端实际暴露了哪些路由和 action
- 哪些能力是真缺接口
- 哪些问题是字段建模或契约不一致，而不是接口不存在

## 校验范围

- 前端仓库：`/Users/pi-dal/Developer/sport-snack`
- 后端仓库：`/Users/pi-dal/Developer/sport-snack-backend`

本次主要核对了以下文件：

- 前端：
  - `src/uni-app/api/backendClient.ts`
  - `src/uni-app/api/studentBackend.ts`
  - `src/uni-app/composables/useRegistrationAvatar.ts`
  - `src/uni-app/pages/training/short-questionnaire.vue`
- 后端：
  - `sport_snack/urls.py`
  - `users/urls.py`
  - `users/views.py`
  - `users/models.py`
  - `users/serializers.py`
  - `users/tests.py`
  - `exercises/urls.py`
  - `exercises/views.py`
  - `psychology/urls.py`
  - `psychology/views.py`
  - `physical_tests/urls.py`
  - `physical_tests/views.py`
  - `physical_tests/serializers.py`

## 结论摘要

- 前端当前实际接入的主干 API，后端都已经提供。
- 真实缺失的后端能力主要有 2 项：
  - 头像上传接口未真正实现
  - 训练后短问卷提交接口未提供
- 另外还有 2 类非接口缺失问题：
  - 注册字段 `grade`、`restingHeartRate` 没有后端一等字段
  - 视觉训练记录虽然有接口，但仍是最小桥接，不是完整训练媒体链路
- 旧文档里“体测数据缺少学生端写入接口”这条，按当前后端代码看不成立，因为 `POST /api/physical-tests/` 已存在。

## 一、真实缺失的 API

### 1. 头像上传接口未真正实现

前端现状：

- 前端头像上传依赖 `VITE_AVATAR_UPLOAD_URL`，见 `src/uni-app/composables/useRegistrationAvatar.ts:17`
- 上传时直接调用 `uni.uploadFile` 到该地址，见 `src/uni-app/composables/useRegistrationAvatar.ts:83`
- 如果没有配置上传地址，则直接把本地文件路径当作头像地址回填，见 `src/uni-app/composables/useRegistrationAvatar.ts:84`

后端现状：

- 后端测试中明确假设存在 `POST /api/users/users/upload_avatar/`，见 `users/tests.py:39`
- 但 `users/views.py` 中的 `UserViewSet` 只实现了：
  - `wechat_login`
  - `me`
  - `update_profile`
- 没有 `upload_avatar` action，见 `users/views.py:19`

结论：

- `POST /api/users/users/upload_avatar/` 目前属于“测试里预期存在，但代码里并未实现”的接口。
- 这是一个真实缺失接口。

### 2. 训练后短问卷提交接口未提供

前端现状：

- 训练后短问卷页面只把结果写入本地 store，见 `src/uni-app/pages/training/short-questionnaire.vue:10`
- 页面没有任何 API 调用。

后端现状：

- `users`、`psychology`、`exercises`、`physical-tests` 模块中均没有“训练后短反馈/短问卷”的提交接口。

结论：

- 训练后短问卷提交能力目前没有后端 API 支撑。
- 这是一个真实缺失接口。

## 二、不是缺接口，但存在数据或契约缺口

### 1. 注册字段 `grade`、`restingHeartRate` 没有后端一等字段

前端现状：

- 注册同步到后端用户资料时，只写入：
  - `name`
  - `gender`
  - `student_id`
  - `major`
  - `height`
  - `weight`
- 见 `src/uni-app/api/studentBackend.ts:49`
- `grade`、`restingHeartRate` 会被塞进 `survey-records.analysis` 的 JSON 兜底存储，见 `src/uni-app/api/studentBackend.ts:67`

后端现状：

- `User` 模型没有 `grade`、`restingHeartRate` 字段，见 `users/models.py:5`
- `UserUpdateSerializer` 也没有这两个字段，见 `users/serializers.py:19`

结论：

- 这不是“接口没提供”，而是“后端没有结构化字段承接这些数据”。
- 当前可落库，但只能进 `SurveyRecord.analysis`，后续统计、筛选、画像都不友好。

### 2. 视觉训练记录接口存在，但仍是最小桥接

前端现状：

- 前端先请求 `/exercises/videos/`
- 再选第一条视频
- 然后只提交 `{ video, duration }` 到 `/exercises/records/`
- 见 `src/uni-app/api/backendClient.ts:243` 和 `src/uni-app/api/backendClient.ts:248`

后端现状：

- `ExerciseRecordViewSet` 的创建接口是存在的，见 `exercises/views.py`

结论：

- 这里不是缺接口。
- 但当前训练记录链路仍不足以支撑真实媒体、动作回放、完整分析结果等能力。

## 三、已经校验通过、后端已提供的接口

以下接口是前端当前真实会调用，且后端代码中能找到对应实现的。

### 1. 用户与注册相关

前端调用位置：`src/uni-app/api/backendClient.ts:217`

后端实现位置：`users/views.py:29`

接口清单：

- `POST /api/users/users/wechat_login/`
- `GET /api/users/users/me/`
- `PATCH /api/users/users/update_profile/`
- `POST /api/users/survey-records/`

### 2. 训练相关

前端调用位置：`src/uni-app/api/backendClient.ts:243`

后端实现位置：`exercises/views.py`

接口清单：

- `GET /api/exercises/videos/?exercise_type=...`
- `POST /api/exercises/records/`
- `POST /api/exercises/stairs/`
- `GET /api/exercises/records/my_records/`
- `GET /api/exercises/stairs/my_records/`

### 3. 心理量表相关

前端调用位置：`src/uni-app/api/backendClient.ts:260`

后端实现位置：`psychology/views.py`

接口清单：

- `GET /api/psychology/scales/`
- `GET /api/psychology/scales/next_scale/`
- `POST /api/psychology/records/submit/`
- `GET /api/psychology/records/my_records/`

### 4. 体测相关

前端当前调用位置：`src/uni-app/api/backendClient.ts:289`

后端实现位置：`physical_tests/views.py:43`

接口清单：

- `GET /api/physical-tests/trend/`

补充说明：

- 后端实际上还提供了学生端创建体测记录的入口，即 `POST /api/physical-tests/`
- 这是 `PhysicalTestViewSet` 的标准 `create` 能力，序列化器为 `PhysicalTestCreateSerializer`
- 见 `physical_tests/views.py:16` 和 `physical_tests/serializers.py:22`

因此，旧结论“体测数据缺少学生端写入接口”在当前代码状态下应视为过期。

## 四、建议更新的旧文档结论

现有文档 `docs/api/frontend-backend-unlinked-items-2026-04-12.md` 中，以下内容建议更新：

- 保留：
  - 头像上传没有统一后端接口
  - 训练后短问卷没有后端提交接口
  - 注册字段与后端用户模型未完全衔接
  - 视觉训练记录仍是过渡桥接
- 建议删除或改写：
  - “体测数据缺少学生端写入接口”

原因：

- 按当前后端 `PhysicalTestViewSet`，学生端可通过 `POST /api/physical-tests/` 写入体测数据。

## 五、推荐下一步

如果要继续收敛缺口，建议按优先级处理：

1. 补上 `POST /api/users/users/upload_avatar/`
2. 为训练后短问卷设计并实现单独提交接口
3. 决定 `grade`、`restingHeartRate` 是否进入 `User` 一等字段
4. 明确视觉训练记录是否要升级为真实媒体链路

## 六、校验方式说明

本次是静态代码校验，不是运行态联调。

已完成：

- 对照前端 API 调用点
- 对照 Django 路由、ViewSet、action、serializer、model
- 对照后端测试中显式引用的接口路径

未完成：

- 未实际启动后端并逐条发起 HTTP 请求
- 未在 WeChat DevTools 中验证上传、鉴权和 cookie 行为

因此，这份文档可用于接口盘点和开发排期；若要用于联调验收，还需要补一轮运行态验证。

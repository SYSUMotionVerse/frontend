# 微信小程序生产发布

## 发布架构

- 小程序代码通过微信开发者工具上传到微信平台。
- 业务 API 通过 HTTPS 域名反向代理到 `119.91.74.187`。
- BlazePose 模型存放在腾讯云 COS，并通过 `cdn.sysusports.cn` 加速。
- 姿态推理完全在用户手机上执行，摄像头帧不会上传服务器。
- 每个模型版本首次下载约 8.5 MB，随后从微信用户文件目录读取。

## 1. 上传 BlazePose 模型到腾讯云 COS

模型文件位于 `models/pose`。建议给上传凭据只授予目标 Bucket 和 `pose/` 前缀的写权限，不要使用主账号密钥。

```bash
COS_REGION=ap-guangzhou
COS_BUCKET=sysusports-1442740064
COS_SECRET_ID=
COS_SECRET_KEY=
COS_PUBLIC_BASE_URL=https://cdn.sysusports.cn
COS_MODEL_PREFIX=pose
POSE_MODEL_VERSION=blazepose-lite-v1
```

这些值已放入本机 `.env`；只需填写 `COS_SECRET_ID` 和 `COS_SECRET_KEY`，然后运行：

```bash
pnpm pose:cos:upload
```

上传目录为：

```text
pose/blazepose-lite-v1/
├── detector/
│   ├── model.json
│   ├── group1-shard1of2.bin
│   └── group1-shard2of2.bin
└── landmark_lite/
    ├── model.json
    └── group1-shard1of1.bin
```

模型属于公开客户端资源。目标对象必须能通过 HTTPS 匿名读取，可通过限定 `pose/` 前缀的 Bucket Policy 或公开 CDN 域名实现。不要把 SecretId、SecretKey 放入小程序环境变量或提交到 Git。

## 2. 配置生产环境

复制示例配置：

```bash
cp .env.production.example .env.production
```

填写真实 HTTPS 地址：

```dotenv
VITE_API_BASE_URL=https://api.example.com/api
VITE_POSE_MODEL_VERSION=blazepose-lite-v1
VITE_POSE_MODEL_BASE_URL=https://cdn.sysusports.cn/pose/blazepose-lite-v1

# 短问卷端点（后端已实现，部署顺序：先后端迁移/上线接口，再启用此变量并构建小程序）
VITE_SHORT_QUESTIONNAIRE_ENDPOINT=/exercises/short-questionnaires
```

模型版本变化时同时修改 `VITE_POSE_MODEL_VERSION` 和模型 URL。小程序会使用新的缓存目录重新下载；同版本后续训练直接读取本地文件。

### 短问卷后端接口契约

后端已实现 `/api/exercises/short-questionnaires/` 接口，满足以下契约：

- 接口以 `(user, training_session_id)` 为幂等键，对同一用户同一 `training_session_id` 的重复提交（相同评分）返回 200 和已有记录，不创建重复记录。
- 同一 `training_session_id` 但评分不同（冲突）的重复提交返回 409，不修改原始记录。
- 不同用户可以独立使用相同的 `training_session_id`。
- 小程序在认证启动/bootstrap 成功后会非阻塞地重试待同步的短问卷。后端能安全处理重复请求。

生产环境需填写 `VITE_SHORT_QUESTIONNAIRE_ENDPOINT=/exercises/short-questionnaires` 以启用端到端同步。部署顺序：先在后端执行数据库迁移并上线 `/api/exercises/short-questionnaires/` 接口，再启用此环境变量并构建小程序。

## 3. 微信公众平台配置

在小程序后台的“开发管理 → 开发设置 → 服务器域名”中，至少添加：

- API HTTPS 域名到 `request` 合法域名。
- COS/CDN HTTPS 域名 `https://cdn.sysusports.cn` 同时加入 `request` 与 `downloadFile` 合法域名；动作视频缓存和教练语音都依赖下载域名。

域名必须与生产环境变量完全一致；不要填写路径 `/api` 或 `/pose/...`。

## 4. 构建并上传

```bash
pnpm test
pnpm exec vue-tsc --noEmit
pnpm audit:production
pnpm build:mp-weixin:production
```

生产构建会拒绝缺少配置、HTTP 地址、`localhost`、IP 地址、保留占位域名、
`touristappid` 和关闭 `urlCheck` 的配置。构建完成后还会检查生成的
`dist/build/mp-weixin/project.config.json`，避免源清单和上传产物不一致。
之后在微信开发者工具导入 `dist/build/mp-weixin`，执行真机预览，再点击“上传”。

### 注册资料本地缓存

注册时填写的学号、姓名、性别、身高、体重、年龄、年级、静息心率等字段
均由后端 `/users/me/` 返回并持久化在后端 User 模型上。后端字段是权威的。

本机 `registrationProfileStorage` 仅作为后端不可用或缺少这些字段时的
回退/缓存（30 天 TTL）。TTL 过期不会强制已正确注册的后端用户重新注册；
bootstrap 流程优先读取后端字段，仅在后端缺少时回退到本地缓存。

### 依赖审计例外

`pnpm-workspace.yaml` 精确记录了当前允许的 high 级 GHSA。它们由固定版本的
DCloud/uni-app 工具链传递引入，直接 override `jpeg-js`、`@intlify/*`、
`picomatch`、`ws` 或 `adm-zip` 可能破坏编译器内部兼容性，因此当前不跨版本
强制替换。`pnpm audit:production` 仍会让任何新增、未列入清单的 high 或
critical 漏洞失败。

**复查截止日：2026-10-18。** 无论是否升级了 `@dcloudio/*`，到该日期必须重新运行不带例外的 `pnpm audit --prod`，删除已修复的 GHSA，并复审剩余项。升级 `@dcloudio/*` 时也必须执行同样的复审。若这些依赖开始处理不可信的构建输入、开放开发服务器到公网，或进入小程序运行时代码，则现有例外立即失效，必须在发布前解决。

当前受控的 high 级 GHSA 清单：

| GHSA | 包 | 漏洞 | 构建路径 |
|------|-----|------|---------|
| GHSA-xvf7-4v9q-58w6 | jpeg-js | 无限循环 | @dcloudio/uni-mp-weixin → jimp → @jimp/jpeg |
| GHSA-p2ph-7g93-hw3m | @intlify/core-base, @intlify/message-resolver | 原型污染 | @dcloudio/uni-app → uni-cli-shared → @intlify/* |
| GHSA-c2c7-rcm5-vvqj | picomatch | ReDoS | @dcloudio/uni-app → uni-cli-shared → @rollup/pluginutils / anymatch |
| GHSA-96hv-2xvq-fx4p | ws | 内存耗尽 DoS | @dcloudio/uni-mp-weixin → ws |
| GHSA-xcpc-8h2w-3j85 | adm-zip | 4GB 内存分配 | @dcloudio/uni-app → uni-cli-shared → adm-zip |

以上漏洞仅影响构建时依赖。通过对 `dist/build/mp-weixin/` 生成包的搜索确认，`jpeg-js`、`jimp`、`@intlify/*`、`picomatch`、`adm-zip` 以及 `ws` npm 包均未出现在运行时代码中（`vendor.js` 中的 `WebSocket` 引用来自微信小程序原生 API，不是 `ws` 包）。升级 `@dcloudio/*` 后如果某个 GHSA 不再被报告，应立即从 `pnpm-workspace.yaml` 中删除。

## 5. 上线验收

至少验证：

1. 新用户微信登录、注册和问卷正常。
2. 首次进入可视化训练能够下载并初始化模型。
3. 退出后再次进入训练，不再产生模型网络请求。
4. 训练过程中服务器不接收图片或视频，只接收训练结果 JSON。
5. 管理后台和媒体资源均通过 HTTPS 正常访问。

当前服务器 `119.91.74.187` 已有 HTTP 后端，但正式发布仍需为 API 配置可登记到微信公众平台的 HTTPS 域名。

# 微信小程序生产发布

## 发布架构

- 小程序代码通过微信开发者工具上传到微信平台。
- 业务 API 通过 HTTPS 域名反向代理到 `119.91.74.187`。
- BlazePose 模型存放在阿里云 OSS 或其 CDN 域名。
- 姿态推理完全在用户手机上执行，摄像头帧不会上传服务器。
- 每个模型版本首次下载约 8.5 MB，随后从微信用户文件目录读取。

## 1. 上传 BlazePose 模型到 OSS

模型文件位于 `models/pose`。建议给上传凭据只授予目标 Bucket 和前缀的写权限，不要使用主账号 AccessKey。

```bash
export OSS_REGION=oss-cn-shenzhen
export OSS_BUCKET=your-bucket
export OSS_ACCESS_KEY_ID=your-access-key-id
export OSS_ACCESS_KEY_SECRET=your-access-key-secret
export OSS_MODEL_PREFIX=pose
export POSE_MODEL_VERSION=blazepose-lite-v1

pnpm pose:oss:upload
```

如果使用自定义 Endpoint，可额外设置：

```bash
export OSS_ENDPOINT=https://oss-cn-shenzhen.aliyuncs.com
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

模型属于公开客户端资源。目标对象必须能通过 HTTPS 匿名读取，可通过 Bucket 公共读、限定前缀的 Bucket Policy，或公开 CDN 域名实现。不要把 AccessKey 放入小程序环境变量。

## 2. 配置生产环境

复制示例配置：

```bash
cp .env.production.example .env.production
```

填写真实 HTTPS 地址：

```dotenv
VITE_API_BASE_URL=https://api.example.com/api
VITE_POSE_MODEL_VERSION=blazepose-lite-v1
VITE_POSE_MODEL_BASE_URL=https://models.example.com/pose/blazepose-lite-v1
```

模型版本变化时同时修改 `VITE_POSE_MODEL_VERSION` 和模型 URL。小程序会使用新的缓存目录重新下载；同版本后续训练直接读取本地文件。

## 3. 微信公众平台配置

在小程序后台的“开发管理 → 开发设置 → 服务器域名”中，至少添加：

- API HTTPS 域名到 `request` 合法域名。
- OSS/CDN HTTPS 域名到 `request` 合法域名。

域名必须与生产环境变量完全一致；不要填写路径 `/api` 或 `/pose/...`。

## 4. 构建并上传

```bash
pnpm test
pnpm exec vue-tsc --noEmit
pnpm build:mp-weixin:production
```

生产构建会拒绝缺少配置、HTTP 地址、`localhost` 和 `127.0.0.1`。构建完成后，在微信开发者工具导入 `dist/build/mp-weixin`，执行真机预览，再点击“上传”。

## 5. 上线验收

至少验证：

1. 新用户微信登录、注册和问卷正常。
2. 首次进入可视化训练能够下载并初始化模型。
3. 退出后再次进入训练，不再产生模型网络请求。
4. 训练过程中服务器不接收图片或视频，只接收训练结果 JSON。
5. 管理后台和媒体资源均通过 HTTPS 正常访问。

当前服务器 `119.91.74.187` 已有 HTTP 后端，但正式发布仍需为 API 配置可登记到微信公众平台的 HTTPS 域名。

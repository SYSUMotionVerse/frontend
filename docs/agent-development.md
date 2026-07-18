# Agent Development Guide

这份文档给进入本仓库执行任务的 agent 使用，目标是让 agent 能够稳定完成微信小程序前端开发、联调和交付。

## 项目定位

- 仓库类型：学生端微信小程序前端原型。
- 技术栈：`uni-app + Vue 3 + TypeScript + Vitest + UnoCSS`。
- 当前主要目标平台：`mp-weixin`。
- 默认构建输出目录：`dist/build/mp-weixin`。

## Agent 进入仓库后的最小动作

1. 阅读 `README.md` 和本文件，确认项目脚本、输出目录和联调方式。
2. 安装依赖：`pnpm install`。
3. 如需本地联调微信小程序，启动：`pnpm dev`。
4. 如需验证改动，优先运行：
   - `pnpm test`
   - `npx vue-tsc --noEmit`
5. 如需在微信开发者工具中查看效果，导入 `dist/build/mp-weixin`。

## 开发流程

### 1. 安装依赖

```bash
pnpm install
```

### 2. 启动微信小程序目标

```bash
pnpm dev
```

这个命令等价于：

```bash
pnpm dev:mp-weixin
```

开发命令会持续把 `mp-weixin` 产物输出到 `dist/build/mp-weixin`，微信开发者工具应始终指向这个目录，而不是仓库根目录。

### 3. 运行测试和类型检查

当改动涉及业务逻辑、页面结构、组件交互或路由时，至少执行：

```bash
pnpm test
npx vue-tsc --noEmit
```

如果只修改文档，也应至少做一次基础自检，例如检查 Markdown 链接、命令和路径是否与仓库现状一致。

## 安装微信开发者工具

微信开发者工具请以官方页面为准：

- 下载页：<https://developers.weixin.qq.com/miniprogram/en/dev/devtools/download.html>
- 工具概览：<https://developers.weixin.qq.com/miniprogram/en/dev/devtools/devtools.html>

截至 2026-04-01，官方下载页提供稳定版、RC 版和 Nightly 版。日常联调建议优先安装稳定版；只有在需要验证特定新特性时，再考虑 RC 或 Nightly。

### 安装建议

1. 打开官方下载页。
2. 按本机系统选择安装包：
   - Windows 64 / Windows 32
   - macOS x64 / macOS ARM64
3. 完成安装并登录微信开发者工具。
4. 首次启动后，确认能够创建或导入小程序项目。

### 将本项目导入微信开发者工具

1. 先在仓库内执行 `pnpm dev`。
2. 打开微信开发者工具，选择“导入项目”。
3. 项目目录选择：`dist/build/mp-weixin`。
4. `AppID` 处理规则：
   - 以唯一清单 [`src/manifest.json`](../src/manifest.json) 中的 `mp-weixin.appid` 为准。
   - 如果配置为 `touristappid`，仅适合本地页面调试或游客模式。
   - 如果需要真机预览、上传或调用受限能力，即使清单中已配置非游客 AppID，也必须确认当前发布账号拥有该 AppID，并完成请求域名白名单和相应平台能力配置。
5. 导入后，保持 `pnpm dev` 进程运行，让微信开发者工具自动读取增量产物。

## Agent 开发约束

- 任何页面开发都默认以微信小程序规范为第一约束，不优先按 Web 语义实现。
- 导航、表单、滚动和样式能力应优先使用已在项目中验证过的 `uni-app` 写法。
- 若 UI 改动需要人工确认，优先给出明确的页面路径、组件路径和验证步骤。
- 若联调依赖微信开发者工具，说明“先跑 `pnpm dev`，再打开 `dist/build/mp-weixin`”。
- 若无法完成真机链路，明确说明是否受限于 `touristappid` 或本地缺少微信开发者工具。

## Tunnel 真机预览

BlazePose 模型文件不要放在 `src/`，否则微信开发者工具预览会因为源码包过大失败。当前模型文件放在 `models/pose`，真机预览建议通过 Cloudflare Tunnel 暴露模型服务和后端 API。

```bash
pnpm pose:tunnel:start
pnpm dev:tunnel
```

`pnpm pose:tunnel:start` 会：

- 按需启动 `models/pose` 本地静态服务。
- 给姿态模型服务创建一个 `trycloudflare.com` 地址。
- 给本地后端 `http://127.0.0.1:8000` 创建一个 `trycloudflare.com` 地址。
- 把运行状态写入 `.tmp/pose-model-tunnel.json`。

`pnpm dev:tunnel` 会读取上面的状态，并自动注入：

- `VITE_POSE_MODEL_BASE_URL`
- `VITE_API_BASE_URL`

常用管理命令：

```bash
pnpm pose:tunnel:status
pnpm pose:tunnel:stop
```

微信开发者工具仍然导入 `dist/dev/mp-weixin` 或 `dist/build/mp-weixin`，不要导入仓库根目录。

## 微信训练提醒授权

提醒链路只使用一个已审批的长期订阅消息模板。模板 ID 和 `test` / `production` 运行模式由后端环境配置，并通过已认证的授权状态接口提供给小程序；前端不保存 AppSecret 或其他微信凭据，也不需要为模板配置变化重新构建。

后端默认使用 `test` 模式。测试授权只显示“测试授权已记录”，不会宣称生产提醒可用。只有完成教育类长期订阅能力开通、正式模板审批，并准备使用真实 AppID 真机验收时，后端才可切换到 `production`。配置不可用时，小程序会提示联系研究管理员；`touristappid` 无法完成生产验收链路。

## 生产发布

生产包使用 `pnpm build:mp-weixin:production`。该命令要求 API 和姿态模型均为 HTTPS 地址，并阻止本地地址进入上传包。BlazePose 模型应放在 OSS/CDN，通过 `pnpm pose:oss:upload` 上传；小程序首次下载后会保存到微信用户文件目录，同一模型版本后续直接本地读取。详细步骤见 [`mini-program-production-release.md`](mini-program-production-release.md)。

## 推荐交付格式

当 agent 完成任务时，建议在结果中至少覆盖：

- 改了哪些页面或组件。
- 改动文件路径。
- 运行了哪些验证命令。
- 是否需要在微信开发者工具里继续确认。
- 是否受 `AppID`、真机预览或平台能力限制。

## 可直接复用的 Agent Prompt

下面这段 prompt 可以直接给新的 agent：

```text
你在 sport-snack 仓库中工作。请先阅读 README.md 和 docs/agent-development.md。

这个项目是一个基于 uni-app + Vue 3 + TypeScript 的微信小程序前端，默认目标平台是 mp-weixin。开发时请遵守以下要求：
1. 任何页面和交互都优先符合微信小程序规范，而不是 Web 站点习惯。
2. 先使用仓库现有脚本和组件模式，不要擅自改动基础运行方式。
3. 本地开发先执行 pnpm install，再执行 pnpm dev。
4. 需要在微信开发者工具联调时，导入 dist/build/mp-weixin，而不是仓库根目录。
5. 修改业务逻辑、页面结构、路由或组件后，至少运行 pnpm test 和 npx vue-tsc --noEmit。
6. 如果需要真机预览或上传，请先检查 src/manifest.json 里的 mp-weixin.appid 是否仍为 touristappid。
7. 输出结果时请说明修改文件、验证命令，以及是否还需要微信开发者工具确认。

在开始实施前，先用一句话概括你的理解，再执行。
```

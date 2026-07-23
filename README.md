# Sport Snack Frontend

## Project Overview / 项目简介

This repository contains the student-side frontend for the Sport Snack mini-program prototype. The app is built with `uni-app + Vue 3 + TypeScript`, and the primary runtime target is the WeChat Mini Program platform.

本仓库是 Sport Snack 学生端小程序原型的前端代码库。项目基于 `uni-app + Vue 3 + TypeScript` 开发，当前主要运行目标为微信小程序。

The current product flow is organized around three feature areas:

当前产品流程主要围绕三个业务域组织：

- `access`: registration and onboarding questionnaires / 注册与接入问卷
- `training`: daily training, mode selection, session feedback / 日常训练、模式选择与训练反馈
- `growth`: adherence, achievements, metrics, and history / 坚持情况、成长徽章、体能指标与历史记录

## Tech Stack / 技术栈

- Framework / 框架: `uni-app`, `Vue 3`
- Language / 语言: `TypeScript`
- Build Tool / 构建工具: `Vite`, `@dcloudio/vite-plugin-uni`
- Styling / 样式: `UnoCSS`
- Testing / 测试: `Vitest`, `@vue/test-utils`, `jsdom`
- Package Manager / 包管理: `pnpm`

## Prerequisites / 环境准备

Install [mise](https://mise.jdx.dev/) first, then let the checked-in
`mise.toml` install the exact runtime and package-manager versions:

```bash
mise install
```

The pinned toolchain is:

开始前请准备以下工具：

- `Node.js 24.6.0`
- `pnpm 11.12.0`
- WeChat DevTools for previewing generated mini-program bundles / 用于预览生成后的小程序产物的微信开发者工具

## Project Structure / 项目结构

The repository uses a feature-oriented structure with a small platform bridge for uni-app:

仓库采用面向功能的目录组织，并额外保留了一层 uni-app 平台桥接代码：

- `src/pages/`: page-level screens grouped by `access`, `training`, and `growth` / 按 `access`、`training`、`growth` 分组的页面入口
- `src/components/`: reusable UI components grouped by feature / 按业务域拆分的可复用组件
- `src/features/`: feature-level presentation logic and styles / 贴近业务流程的特性层逻辑与样式
- `src/domain/`: student-domain state, types, and data helpers / 学生端领域状态、类型与数据辅助逻辑
- `src/composables/`: shared Vue composables / 通用 Vue 组合式逻辑
- `src/uni-app/`: uni-app specific entry files, platform adapters, and runtime helpers / uni-app 平台相关入口、适配器与运行时辅助逻辑
- `src/tests/`: Vitest test suite / Vitest 测试目录

## Key Files / 关键文件

- `package.json`: project scripts and dependency declarations / 项目脚本与依赖声明
- `vite.config.ts`: Vite, uni-app, and Vitest configuration / Vite、uni-app 与 Vitest 配置
- `src/main.ts`: shared app entry for local app assembly / 通用应用入口
- `src/App.vue`: root app shell / 根应用壳层
- `src/pages.json`: page routing and navigation titles / 页面路由与导航标题
- `src/manifest.json`: mini-program manifest and `mp-weixin` settings / 小程序清单与 `mp-weixin` 配置
- `src/uni-app/main.ts`: uni-app runtime entry / uni-app 运行时入口
- `src/uni-app/platform/*.ts`: platform integrations such as sensors, reminders, and camera access / 传感器、提醒、摄像头等平台能力适配

## Install Dependencies / 安装依赖

Install project dependencies with:

使用以下命令安装依赖：

```bash
pnpm install
```

## Start Local Development / 本地开发

Start the WeChat Mini Program target with:

使用以下命令启动微信小程序目标：

```bash
pnpm dev
```

This command currently maps to:

当前该命令对应：

```bash
uni -p mp-weixin
```

You can also run the target explicitly:

你也可以显式执行同一目标：

```bash
pnpm dev:mp-weixin
```

The development bundle is emitted under `dist/dev/mp-weixin`. Open WeChat DevTools and import that directory for local preview.

开发产物会输出到 `dist/dev/mp-weixin`。本地调试时请使用微信开发者工具导入该目录进行预览。

## Run Tests / 运行测试

Run the automated test suite with:

使用以下命令运行自动化测试：

```bash
pnpm test
```

This command runs:

对应脚本为：

```bash
vitest run
```

## Build The Mini-Program / 构建小程序

Build the WeChat Mini Program bundle with:

使用以下命令构建微信小程序产物：

```bash
pnpm build:mp-weixin
```

For a release build, configure `.env.production` from
`.env.production.example` and run:

生产发布时，请先根据 `.env.production.example` 配置 `.env.production`，再执行：

```bash
pnpm build:mp-weixin:production
```

This release command requires HTTPS API and pose-model origins and rejects
local development URLs. Pose models can be uploaded to Tencent Cloud COS with
`pnpm pose:cos:upload`. See
[`docs/mini-program-production-release.md`](docs/mini-program-production-release.md).

该命令会校验 API 与姿态模型地址必须适合微信正式环境。姿态模型可通过
`pnpm pose:cos:upload` 上传至腾讯云 COS，完整流程见
[`docs/mini-program-production-release.md`](docs/mini-program-production-release.md)。

The production-ready bundle is written to `dist/build/mp-weixin`.

构建产物会输出到 `dist/build/mp-weixin`。

The shorter `pnpm build` script currently maps to the same target, but `pnpm build:mp-weixin` makes the platform explicit.

较短的 `pnpm build` 当前也会指向同一目标，但 `pnpm build:mp-weixin` 能更明确地表达平台目标。

After the build completes, open WeChat DevTools and import `dist/build/mp-weixin` to run or inspect the package.

构建完成后，可在微信开发者工具中导入 `dist/build/mp-weixin` 进行运行或检查。

## Delivery Notes / 交付说明

The checked-in production-readiness workflow installs from the frozen lockfile,
runs tests and TypeScript checks, validates production configuration, audits
the production dependency graph, and builds the `mp-weixin` bundle. Uploading
still happens manually through WeChat DevTools.

仓库内的生产门禁工作流会以 frozen lockfile 安装依赖，运行测试、类型检查、
生产配置校验、生产依赖审计与 `mp-weixin` 构建。上传仍需通过微信开发者工具手工完成。

## Common Commands / 常用命令

```bash
pnpm install
pnpm dev
pnpm dev:action-tool
pnpm test
pnpm build:mp-weixin
pnpm build:action-tool
```

## Appendix: Action Standard File Tool / 附录：动作标准文件工具

The repository includes a local browser tool that extracts pose angles from standard-action videos and exports one schema 0.4 JSON file per video. The start/build command downloads the BlazePose model from the project CDN into the ignored `.tmp/action-tool-models/` cache, with `models/pose/` available as an offline fallback. Video decoding, BlazePose inference, and ZIP generation all run locally; the tool does not upload videos or results to the backend, OSS, or COS.

仓库内置了一个本地浏览器工具，可从标准动作视频提取姿态角度，并为每个视频导出一个 schema 0.4 JSON 文件。启动或构建命令会先从项目 CDN 下载 BlazePose 模型到 Git 忽略的 `.tmp/action-tool-models/` 缓存，`models/pose/` 目录作为离线回退。视频解码、BlazePose 推理和 ZIP 生成全部在本机完成，不会把视频或结果上传到后端、OSS 或 COS。

Start the tool from the repository root:

在仓库根目录启动工具：

```bash
pnpm dev:action-tool
```

Then open `http://127.0.0.1:4174/action-tool.html`. Import one or more videos, complete the action metadata and trim range, run the analysis, and use the export button to download all completed JSON files in one ZIP archive.

然后打开 `http://127.0.0.1:4174/action-tool.html`。导入一个或多个视频，填写动作信息和截取范围，运行分析，再通过导出按钮将所有已完成的 JSON 文件下载为一个 ZIP 压缩包。

The tool is independent of the WeChat Mini Program runtime. It does not require WeChat DevTools and is not limited by `touristappid`.

该工具独立于微信小程序运行时，不需要微信开发者工具，也不受 `touristappid` 限制。

See the complete Chinese guide: [`docs/action-standard-tool.md`](docs/action-standard-tool.md).

完整中文使用手册：[`docs/action-standard-tool.md`](docs/action-standard-tool.md)。

## Agent Prompt / 给 Agent 的 Prompt

Use the following prompt when you want another agent to continue development in this repository:

如果你想让新的 agent 继续在这个仓库里开发，可以直接使用下面这段 prompt：

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

## Agent Guide / Agent 补充文档

- [`docs/frontend-backend-collaboration.md`](docs/frontend-backend-collaboration.md)
- [`docs/agent-development.md`](docs/agent-development.md)
- [`AGENTS.md`](AGENTS.md)

# Sport Snack Frontend And Backend Collaboration Guide

## Overview / 概览

This document explains how to run the Sport Snack frontend and backend together during local development. It is written for day-to-day collaboration between mini-program, API, and data-model work.

这份文档说明了在本地开发时，如何把 Sport Snack 前端和后端一起跑起来。它主要面向日常的前后端协作开发、小程序联调和接口验证。

The recommended path is:

推荐路径如下：

- run the backend with Docker
- run the frontend from source with `pnpm`
- preview the mini-program in WeChat DevTools

也就是：

- 后端优先使用 Docker 启动
- 前端使用源码方式通过 `pnpm` 启动
- 在微信开发者工具里联调小程序

## Repositories / 仓库位置

This guide assumes the two repositories live side by side:

本文默认两个仓库并排放在本地：

- frontend: `/Users/pi-dal/Developer/sport-snack`
- backend: `/Users/pi-dal/Developer/sport-snack-backend`

## Responsibilities / 前后端分工

### Frontend repository / 前端仓库

- WeChat Mini Program UI and interaction flow
- uni-app runtime entry and page routing
- local state and backend integration adapters

负责：

- 微信小程序界面与交互流程
- uni-app 运行时入口与页面路由
- 本地状态和后端接口适配层

### Backend repository / 后端仓库

- Django and Django REST Framework APIs
- exercise, psychology, and physical-test data models
- admin pages, migration scripts, and initialization commands

负责：

- Django 与 Django REST Framework API
- 训练、心理量表、体测等数据模型
- 管理后台、迁移脚本和初始化命令

## Recommended Workflow / 推荐协作流程

Use this order for daily collaboration:

建议日常协作按下面顺序执行：

1. Start the backend with Docker.
2. Confirm the backend is reachable at `http://127.0.0.1:8000/api/`.
3. Point the frontend to that backend with `VITE_API_BASE_URL`.
4. Start the frontend with `pnpm dev`.
5. Open the generated mini-program bundle in WeChat DevTools.
6. Test one full flow end to end.

## Backend Setup With Docker / 后端 Docker 启动

The backend repository already includes:

后端仓库已经提供了这些文件：

- `docker-compose.yml`
- `Dockerfile`
- `.env.example`

### 1. Prepare environment variables / 准备环境变量

In the backend repository:

在后端仓库中执行：

```bash
cd /Users/pi-dal/Developer/sport-snack-backend
cp .env.example .env
```

Then edit `.env` and set at least:

然后编辑 `.env`，至少确认这些变量：

```bash
DEBUG=True
SECRET_KEY=your-local-secret
ALLOWED_HOSTS=localhost,127.0.0.1
WECHAT_APPID=your_wechat_appid
WECHAT_SECRET=your_wechat_secret
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
ADMIN_EMAIL=admin@example.com
```

Notes:

说明：

- `WECHAT_APPID` and `WECHAT_SECRET` matter if you want real mini-program login behavior.
- If you only need basic API startup and not real WeChat login, placeholder values can still let the server boot, but login-related flows will not behave correctly.

### 2. Start the backend service / 启动后端服务

```bash
cd /Users/pi-dal/Developer/sport-snack-backend
docker-compose up --build
```

This repository’s `docker-compose.yml` starts the `web` service and automatically runs:

当前仓库的 `docker-compose.yml` 会自动执行：

- `python manage.py migrate`
- `python manage.py collectstatic --noinput`
- `python manage.py create_admin_from_env`
- `python manage.py runserver 0.0.0.0:8000`

### 3. Check that the backend is ready / 检查后端是否就绪

Open these URLs in a browser:

在浏览器中检查：

- dashboard: `http://127.0.0.1:8000/dashboard/`
- API root: `http://127.0.0.1:8000/api/`

### 4. Optional: initialize demo data / 可选：初始化演示数据

If you need seeded exercise videos and psychology scales:

如果需要初始化动作视频和心理量表数据：

```bash
cd /Users/pi-dal/Developer/sport-snack-backend
docker-compose exec web python manage.py init_data
```

This is useful before testing:

这一步对下面这些场景很有帮助：

- exercise video lookup
- psychology scale loading
- growth history reads

### 5. Common Docker commands / 常用 Docker 命令

```bash
cd /Users/pi-dal/Developer/sport-snack-backend
docker-compose up --build
docker-compose up -d
docker-compose down
docker-compose logs -f web
docker-compose exec web bash
```

## Frontend Setup / 前端启动

### 1. Install dependencies / 安装依赖

```bash
cd /Users/pi-dal/Developer/sport-snack
pnpm install
```

### 2. Configure backend API base URL / 配置前端后端地址

The frontend reads `VITE_API_BASE_URL` from Vite env files.

前端通过 Vite 环境变量读取 `VITE_API_BASE_URL`。

Create or update `.env.local` in the frontend repository:

在前端仓库里创建或更新 `.env.local`：

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

### 3. Start frontend development / 启动前端开发

```bash
cd /Users/pi-dal/Developer/sport-snack
pnpm dev
```

This runs:

它当前对应：

```bash
uni -p mp-weixin
```

### 4. Open WeChat DevTools / 打开微信开发者工具

For live local development:

用于实时本地开发时：

- keep `pnpm dev` running
- import the generated mini-program bundle

请保持 `pnpm dev` 持续运行，并在微信开发者工具里导入对应产物目录。

In the current frontend README:

按当前前端 README 的说明：

- development bundle: `dist/dev/mp-weixin`
- production-style build bundle: `dist/build/mp-weixin`

Recommended usage:

推荐用法：

- use `dist/dev/mp-weixin` when iterating with `pnpm dev`
- use `dist/build/mp-weixin` when you explicitly run `pnpm build:mp-weixin`

## End-To-End Collaboration Loop / 日常联调闭环

Once both sides are running, use this loop:

前后端都启动后，建议按这个闭环联调：

1. Update backend model or API code in `/Users/pi-dal/Developer/sport-snack-backend`.
2. Let Docker reload or restart the backend service if needed.
3. Update frontend integration or UI code in `/Users/pi-dal/Developer/sport-snack`.
4. Keep `pnpm dev` running so the mini-program bundle stays current.
5. Re-open or refresh the page in WeChat DevTools.
6. Verify the API payload and the page behavior together.

## Current Integration Contract / 当前联调契约

The current frontend-to-backend contract is documented in:

当前前后端接口契约已经整理在：

- `docs/api/sport-snack-backend-integration.md`

That document is the source of truth for:

它主要记录了这些内容：

- backend base URL
- actual API paths used by the frontend
- registration field mapping
- training sync payloads
- current backend gaps

### Important path note / 重要路径说明

The backend route layout is not the same as the old API examples in every markdown file. For example, the current Django router exposes:

后端当前真实路由和部分旧文档示例并不完全一致。例如现在 Django 路由实际暴露的是：

- `POST /api/users/users/wechat_login/`
- `PATCH /api/users/users/update_profile/`
- `POST /api/psychology/records/submit/`

Do not assume older docs are accurate. Check backend code or the integration doc when in doubt.

不要只凭旧文档猜接口；有疑问时，以后端代码和集成文档为准。

## Source-Based Backend Development / 后端源码启动备选方案

Docker is the recommended path, but source-based startup is still useful when you need:

虽然推荐 Docker，但源码启动在这些场景下仍然有用：

- faster one-off backend debugging
- direct `manage.py` command work
- local Python breakpoint debugging

### 1. Create and activate a virtual environment / 创建并激活虚拟环境

```bash
cd /Users/pi-dal/Developer/sport-snack-backend
python -m venv venv
source venv/bin/activate
```

### 2. Install Python dependencies / 安装 Python 依赖

```bash
cd /Users/pi-dal/Developer/sport-snack-backend
pip install -r requirements.txt
```

### 3. Prepare environment variables / 准备环境变量

```bash
cd /Users/pi-dal/Developer/sport-snack-backend
cp .env.example .env
```

### 4. Run migrations / 执行迁移

```bash
cd /Users/pi-dal/Developer/sport-snack-backend
python manage.py makemigrations
python manage.py migrate
```

### 5. Optional: create admin and seed data / 可选：创建管理员并初始化数据

```bash
cd /Users/pi-dal/Developer/sport-snack-backend
python manage.py createsuperuser
python manage.py init_data
```

### 6. Start the backend server / 启动后端服务

```bash
cd /Users/pi-dal/Developer/sport-snack-backend
python manage.py runserver
```

## Suggested Team Workflow / 建议团队协作方式

### When backend changes first / 当后端先改

- update Django view, serializer, or model
- restart or refresh the backend service
- update `docs/api/sport-snack-backend-integration.md` if the contract changed
- tell frontend exactly which path, request fields, and response fields changed

### When frontend changes first / 当前端先改

- confirm whether the backend already supports the intended payload
- if not, record the gap before coding around it
- avoid inventing backend-only fields in the frontend
- keep page-level components thin and move mapping logic into `src/uni-app/api/`

### When both sides move together / 当前后端一起改

- agree on one real example payload first
- make the backend route work with that payload
- add frontend mapper tests before wiring page code
- verify the final flow in WeChat DevTools, not only in unit tests

## Verification Checklist / 联调检查清单

Before claiming a flow is connected, verify:

在说“前后端已经接上”之前，至少检查这些项目：

- backend container or server is running
- `VITE_API_BASE_URL` points to `http://127.0.0.1:8000/api`
- the target API route responds from the backend
- frontend page can load or submit without a runtime error
- `pnpm test` passes after frontend logic changes
- `npx vue-tsc --noEmit` passes after frontend logic changes
- WeChat DevTools confirms the real request path and payload

## Common Problems / 常见问题

### Backend starts but mini-program cannot call it / 后端起来了，但小程序调不到接口

Check:

排查：

- `VITE_API_BASE_URL` is correct
- backend is really listening on `127.0.0.1:8000`
- the mini-program request domain is allowed in WeChat DevTools
- the request path includes the `/api` prefix

### WeChat login works in theory but not in DevTools / 理论上能登录，但开发者工具里不通

Check:

排查：

- `WECHAT_APPID` and `WECHAT_SECRET` in backend `.env`
- current mini-program `AppID`
- cookie or session reuse behavior in the mini-program runtime

### Psychology scale page shows no questions / 心理量表页面没有题目

Check:

排查：

- whether `python manage.py init_data` has been run
- whether the backend actually has scale questions in the database
- whether `/api/psychology/scales/next_scale/` or `/api/psychology/scales/` returns any questions

## Common Commands / 常用命令

### Backend / 后端

```bash
cd /Users/pi-dal/Developer/sport-snack-backend
cp .env.example .env
docker-compose up --build
docker-compose exec web python manage.py init_data
docker-compose logs -f web
```

### Frontend / 前端

```bash
cd /Users/pi-dal/Developer/sport-snack
pnpm install
pnpm dev
pnpm test
npx vue-tsc --noEmit
pnpm build:mp-weixin
```

## Related Documents / 相关文档

- frontend overview: `README.md`
- backend overview: `/Users/pi-dal/Developer/sport-snack-backend/README.md`
- backend integration contract: `docs/api/sport-snack-backend-integration.md`
- agent handbook: `docs/agent-development.md`

## Current Constraints / 当前限制

- The frontend primarily targets WeChat Mini Program, not a generic web client.
- Real mini-program verification still depends on WeChat DevTools.
- Some flows are limited if `src/manifest.json` still uses `touristappid`.
- Backend WeChat login depends on valid WeChat credentials in the backend environment.

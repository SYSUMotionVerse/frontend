# 启动误报 checkpoint state is inconsistent

## 原因与修复

`resolveCompletedPsychologyCheckpoints` 从历史作答推断阶段完成；历史记录粒度是一份量表，而一个阶段可以配置多份量表。此前只有 baseline plan 的数量检查能修正部分情况，随访阶段填写一份后仍有下一份时，会被 `resolveDueCheckpoint` 误判为状态冲突并阻断启动。较早的 baseline plan 与较新的 next_scale 响应不一致时也会触发同一异常。

修复后以 `next_scale` 返回的待填阶段为准，从本地推断的完成集中移除该阶段，不再把“同阶段还有量表”判为冲突。未完成基线仍进入问卷；未完成随访仍进入首页并提供问卷入口。保持现有资料检查、异常响应检查及训练执行门禁，不修改服务端作答记录。

## 回归

- baseline/week4/week8/week12 每个阶段均覆盖已有一份作答、后端返回同阶段另一份量表的情况。
- 覆盖 baseline plan 先返回完成、next_scale 随后返回剩余基线量表的情况。
- 检查分流目标及本地完成集，避免仅隐藏异常但错误解锁基线。

微信真机验收：使用只完成阶段内部分问卷的账号重新启动；基线应继续下一份问卷，随访应进入首页并可继续填写。需上传更新的小程序包后测试；仅更新 Git 仓库不会替换测试员手机里的旧包。

本地验证：Vitest 全量 101 文件、731 项通过；`vue-tsc --noEmit`、生产构建脚本 `node scripts/build-production.mjs --direct-uni` 及 `git diff --check` 通过。主包 634.58 KB、训练分包 1335.38 KB，通过发布配置和体积检查。

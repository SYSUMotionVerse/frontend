# 训练音频 Web Audio 时钟：真机挂起问题修复方案调研

**调研日期：** 2026-09-04
**适用范围：** 视觉训练会话（visual-session）的音频时钟、秒脉冲音效与语音引导（TTS）
**相关提交：** 失迹 `d4a40b0`（引入锚定音频时钟 + Web Audio 音效轨道）；pi-dal `3905c46`/`8e353f7`、`0ba500d`/`ff4fefa`/`e74972e`、`86b6fc0`（2026-09-03 晚真机修复迭代，最终在 `86b6fc0` 中以 `createTrainingAudioClock(() => undefined)` 关闭 Web Audio 路径）

## 结论摘要

1. 挂起问题的根因是 `WebAudioContext` 在**页面 setup 阶段（无任何用户手势）创建**。pi-dal 当晚验证的是「提前创建 + 手势内 `resume()`」这条路，两次落地又两次回退，说明该组合在真机上不可靠；但**「手势内首次创建」从未被尝试过**，而官方文档的销毁重建示例恰好证明：音频会话被首次交互解锁后，后续程序化创建可以正常运行。
2. 即使保留 Web Audio，时钟也必须具备**停摆自检 + 单调时钟兜底**：把「上下文冻结导致训练流程挂死」降级为「精度回落到 `performance.now` 锚定调度」，任何平台怪癖都不应能中断训练。
3. 建议分两阶段：Phase 1 安全恢复时钟与音效轨道（TTS 仍走 InnerAudio）；Phase 2 把 TTS 迁入同一 Web Audio 上下文，根治 pi-dal 在 `3905c46` 中发现的「音效与 TTS 在小程序音频通道上互相争用」问题，真正完成「一个时钟驱动全部训练音频」的目标。

## 1. 现状与目标

失迹方案（`d4a40b0`）的设计意图：用 `wx.createWebAudioContext()` 的 `currentTime` 作为整个训练系统的唯一权威时钟（phase 切换、倒计时、TTS 调度、秒脉冲音效全部锚定其上），`setTimeout` 只负责唤醒调度器，避免 InnerAudioContext 原生播放状态机导致的「时快时慢」。

当前 HEAD（`86b6fc0` 之后）的状态：

- `useVisualTrainingSession.ts:325` `createTrainingAudioClock(() => undefined)` —— 时钟永久退化为 `performance.now()/Date.now()` 兜底；
- `trainingSoundscape` 的 `webAudioRuntime` 传 `null` —— 秒脉冲音效全部走 InnerAudioContext 双缓冲路径；
- `createDefaultTrainingWebAudioRuntime` 在全仓库已无调用方（仅剩 `trainingSoundscape.ts` 内的默认参数），失迹的 Web Audio 代码在运行时是死代码。

目标：恢复统一精确时钟，同时保证真机上任何挂起/打断/重建失败都不会卡死训练或造成音频异常。

## 2. 真机故障模式复盘（三个，不是一个问题）

### 2.1 setup 期创建 → 上下文挂起 → 时钟冻结 → 训练挂死

`d4a40b0` 的接线是 `createTrainingAudioClock()`（默认工厂在 composable setup 时同步执行 `wx.createWebAudioContext()`），`trainingSoundscape.preload()` 也在 setup 期就持有该共享上下文。真机上无手势创建的上下文停留在 `suspended`，`currentTime` 冻结在 0：

- `clockNowMs()`（`useVisualTrainingSession.ts:369`）恒返回 0；
- `startPhaseTimer` 把 `phaseDeadlineMs` 锚在冻结时钟上（`useVisualTrainingSession.ts:751`），`updatePhaseClock` 永远算不出进度 → 训练流程挂死。

这解释了为什么当晚必须回退：挂起的时钟比「时快时慢」严重得多，是流程级的不可用。

### 2.2 音效 Web Audio 路径缺少健康门控

`trainingSoundscape.ts` 的 `scheduleWebAudioTrack` 只判断「上下文与缓冲存在」，不判断上下文是否在前进；挂起时它照样返回 `true`，把整条轨道的脉冲 `start()` 到冻结的时间轴上（`startAt` 全部塌缩到 `Math.max(now, …)` = 0 附近）——真机表现是静音，或 resume 成功后所有脉冲倾泻齐鸣。而 `startTrack` 只在**资源缺失**时才走 InnerAudio + anchored timeline 兜底分支，健康问题永远不会触发兜底。

### 2.3 Web Audio 音效与 InnerAudio TTS 双通道争用

pi-dal `3905c46`（虽已自 revert）的提交说明记录了这一发现：秒脉冲音效与 TTS 在小程序音频通道上互相竞争，语音引导优先级更高。这是独立于挂起的第二个真机问题，也是 Phase 2 的动机。

## 3. 平台事实（官方文档与社区）

以下事实来自微信官方文档（见文末链接）：

- `wx.createWebAudioContext`：基础库 **2.19.0** 起支持；Windows/Mac 端支持；插件不支持。低版本必须做兼容处理（保留 InnerAudio 兜底即可）。
- `WebAudioContext` 有 **`state` 属性**（`suspended` / `running` / `closed`），且可设置状态变化监听——可以做确定性的健康判断，而不是只靠 `currentTime` 是否前进。
- `resume()` 同步恢复并返回 Promise；`suspend()`、`close()` 均可用。
- 官方小游戏音频适配指南明确：
  - **iOS 17.5+ 退后台后无法恢复音频播放，官方示例的补救是在 `wx.onShow` 中 `close()` 后重新 `wx.createWebAudioContext()`（销毁重建）**；示例代码不在手势内，说明首次交互解锁音频会话后，程序化重建可以运行。
  - 基础库 ≥ 2.25.3 的旧版本客户端，**创建上下文后须主动调用一次 `resume()`**（官方示例用一个约 2 秒的定时器补调）。
  - Android 系统限制最多约 10 路并发音频。
  - 官方定位：WebAudio 适合「短音频、播放频繁的音效」（正与秒脉冲吻合）；InnerAudio 适合较大/流式音频（正与 TTS MP3 现状吻合）。
- `wx.onAudioInterruptionBegin` / `wx.onAudioInterruptionEnd`：来电等音频焦点打断事件；官方建议在 End 中恢复播放（这是官方认可的恢复时机，虽不是用户手势）。
- `wx.setInnerAudioOption({ obeyMuteSwitch, mixWithOther })` 文档口径只治理 InnerAudioContext；WebAudioContext 是否遵循 iOS 静音键**无官方文档**（风险项，见 4.3）。
- Web Audio 规范层面，iOS 存在 `interrupted` 状态：打断期间所有 `resume()` 请求被拒（解释了当晚 resume 实验的部分失败）。

## 4. 修复设计

### 4.1 Phase 1：安全恢复时钟与音效（不动 TTS 通道）

**A. 手势内首次创建（核心改动）**

- `createTrainingAudioClock` 改为惰性：setup 期不创建，新增 `ensureContext()`（创建 + 立即 `resume()` 一次，覆盖 ≥2.25.3 旧客户端的官方要求 + 能力探测）。
- `startTraining()` 的**同步序言**（`configureTrainingAudioOutput()` 旁边、任何 `await` 之前）调用 `ensureContext()`——该函数由「开始训练」按钮 tap 直接触发（`VisualTrainingPanel.vue:992`），是真实手势点。
- `trainingSoundscape` 预载拆分：网络下载（`loadArrayBuffer`）保持在 setup/教程期尽早做（网络慢），`createContext + decodeAudioData` 推迟到 `ensureContext()` 之后（两个短 MP3 解码开销毫秒级；若真机验证 suspended 上下文可 `decodeAudioData`，可再提前，见 4.3-3）。

**B. 时钟停摆自检（把挂死变成降级）**

- `now()` 内部维护最后一次有效读数 `(lastAudioSec, wallAnchorMs)`：`currentTime` 在前进 → 返回 `currentTime * 1000` 并刷新锚点；不前进（context 存在但冻结/挂起/closed）→ 返回 `fallbackNowMs() - (wallAnchorMs - lastAudioSec * 1000)`，即以最后一次有效偏移继续走单调墙钟，**保证读数永不回跳、永不停摆**。
- 音频时钟恢复前进时，只有与兜底读数偏差小于阈值才重新采纳，避免时间轴跳变冲击已锚定的 phase deadline。
- 效果：Web Audio 无论以何种方式失效，行为都精确退化为今天上线的行为（单调时钟 + 锚定调度器）——这是把 `86b6fc0` 的「永久放弃」改造成「按需降级」。

**C. 音效路径健康门控**

- `startTrack` / `scheduleWebAudioTrack` 进入 Web Audio 分支前检查：`state === 'running'`（可用时）且 `currentTime` 在前进；不健康 → 返回 `false` → 走**已有的** InnerAudio + anchored timeline 兜底分支。改动只是把门控条件从「资源存在」升级为「资源存在且上下文健康」。
- 删除 `scheduleWebAudioTrack` 里每轨道开头的 `void webAudioContext.resume?.()`——非手势点的 resume 平台不可靠，健康时无需、不健康时无效。

**D. 生命周期与音频打断（当前代码完全缺失）**

- `wx.onAudioInterruptionBegin` → 复用 `suspendSession()`；`wx.onAudioInterruptionEnd` → 复用 `resumeSession()`（官方认可的恢复点）。
- `resumeSession()` 中对时钟做健康判定：`resume()` 后短窗口内 `currentTime` 仍未前进（或 `state` 非 `running`）→ 按 iOS 17.5+ 官方模式 `close()` 后**重建上下文**，并以 B 的偏移机制重锚，phase 剩余时间不受影响。
- 训练中途没有手势可用：重建失败就停留在兜底时钟 + InnerAudio 音效，直到出现下一个手势（如暂停/继续按钮）再尝试升级回 Web Audio。

### 4.2 Phase 2：TTS 迁入同一 Web Audio 上下文（消除双通道争用）

> **状态（2026-09-05）：已实现。** TTS cue 经 `loadArrayBuffer + decodeAudioData` 解码后在共享上下文上以
> `BufferSourceNode.start(now)` 播放，`onended` 链承接队列；cue 调度沿用 anchored timeline。
> 压缩字节缓存（6MB LRU）在上下文重建后免网络重解码，解码缓存（20MB LRU）按 cue 淘汰；
> 预载挂进 `ttsReadyPromise`（`startTraining` await），Web Audio 启用时跳过 temp-file 预载避免双份下载，
> 兜底直接播放远程 URL。每 cue 保留 InnerAudio 降级（上下文不健康 / 解码失败 / start 异常 / 45s watchdog）。
> 挂起时记录播放偏移、恢复后 `source.start(now, offset)` 续播。独立开关
> `trainingWebAudioTtsEnabled`（`useVisualTrainingSession.ts`）可单独关闭 TTS 的 Web Audio 路径。

- 预加载挂进现有 `ttsReadyPromise`（`startTraining` 已 `await` 它）与 `trainingAudioPlan.speechAudioUrls` 预载点；按 phase 做 LRU 解码缓存（预算约 20MB，淘汰非当前 phase）。
- 每 cue 保留 InnerAudio 降级（decode 失败/播放错误/上下文不健康时），沿用现有 45s watchdog 思路。
- 收益：全训练只有一路音频会话，秒脉冲与语音永不互相打断（直接回应 `3905c46` 的发现），TTS 起播也获得采样级精度。
- 风险：内存占用、低端 Android 解码耗时、静音键行为（见 4.3）。

### 4.3 必须真机验证的风险项

1. **静音键**：WebAudioContext 是否遵循 iOS 静音键无官方文档。若遵循且无法配置，训练中静音不可接受，需要预案（`obeyMuteSwitch: false` 的 InnerAudio 超短引导音维持会话活跃，或向用户提示）。`wx.setInnerAudioOption` 对 WebAudio 是否生效同样需验证。
2. 手势内首次创建在目标机型（iOS 15–18、主流 Android 微信版本）是否直接进入 `running`。
3. `decodeAudioData` 在 suspended 上下文上是否可用（决定预解码时机能否提前）。
4. `onAudioInterruptionEnd` 中 resume / 重建的可靠性与延迟。
5. Phase 2：TTS MP3 在各端 `decodeAudioData` 的格式兼容性与内存占用。
6. Phase 1 期间 Web Audio 音效与 InnerAudio TTS 并存的争用范围（是否只在高音量/特定机型出现）。

### 4.4 测试与验收

单测（扩展 `trainingAudioPrecision.spec.ts`、`trainingSoundscape.spec.ts`、`visualWorkoutSessionWiring.spec.ts`）：

- 冻结上下文 → `now()` 走兜底且单调；恢复前进 → 重新采纳且不回跳。
- 挂起上下文 → `startTrack` 选择 native 分支（对应现有 "uses native InnerAudio players when WebAudio is explicitly disabled" 用例的扩展）。
- setup 期不创建上下文；`startTraining` 后恰好创建一次且 `resume()` 一次。
- 打断 → suspend/resume 重锚后 timeline 无重复或丢失事件。

真机矩阵与场景：冷启动 → 点开始；训练中锁屏/切后台回前台；来电打断；蓝牙耳机插拔；静音键开/关；低端 Android。成功标准：phase 边界误差 ≤ 一次定时器唤醒（约 50–100ms）；秒脉冲与墙钟对齐；打断恢复后无齐鸣、无丢拍；任何 Web Audio 故障下训练流程不中断。

回滚安全性：所有新路径失败时的行为即当前线上行为（纯 InnerAudio + 单调时钟），实现时应保留整体开关（如环境变量或常量），可一键回到 `86b6fc0` 状态。

## 5. 实现涉及文件

| 文件 | 改动 |
| --- | --- |
| `src/uni-app/platform/trainingAudioClock.ts` | 惰性创建、停摆自检、偏移重锚、重建、`state` 监听 |
| `src/uni-app/platform/trainingSoundscape.ts` | 预载拆分（下载早/解码晚）、Web Audio 分支健康门控 |
| `src/subpackages/training/composables/useVisualTrainingSession.ts` | `startTraining` 手势内解锁、打断/前后台接线、移除 `() => undefined` 旁路 |
| `src/uni-app/platform/trainingTts.ts` | 仅 Phase 2 触碰 |
| `src/tests/*.spec.ts` | 上述用例扩展 |

## 6. 参考资料

- [WebAudioContext（微信开放文档）](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/WebAudioContext.html)：`state` 属性、`resume`/`suspend`/`close`、`decodeAudioData`
- [wx.createWebAudioContext（微信开放文档）](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/wx.createWebAudioContext.html)：基础库 2.19.0 起支持
- [WebAudioContext.resume（微信开放文档）](https://developers.weixin.qq.com/miniprogram/dev/api/media/audio/WebAudioContext.resume.html)
- [小游戏音频基础能力（微信开放文档）](https://developers.weixin.qq.com/minigame/dev/guide/base-ability/audio)：iOS 17.5+ 退后台销毁重建示例、旧基础库创建后补 resume、Android 并发上限、WebAudio/InnerAudio 适用场景
- [WebAudio 规范 Issue #2392：interrupted 状态](https://github.com/WebAudio/web-audio-api/issues/2392)：打断期间 resume 被拒
- [火山引擎：iOS 下 AudioContext 无法从 suspended 恢复](https://www.volcengine.com/article/60714)：resume 必须由用户输入触发的常见误区与失效场景

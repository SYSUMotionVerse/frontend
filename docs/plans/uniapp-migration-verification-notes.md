# Uni-App Migration Verification Notes

## Verified on 2026-03-19

- `pnpm vitest run` passes with `25/25` tests green.
- `pnpm exec vue-tsc --noEmit` passes.
- `pnpm build` now completes and outputs the WeChat Mini Program bundle to `dist/build/mp-weixin`.
- The uni toolchain now uses the aligned Vue 3 track: `@dcloudio/vite-plugin-uni@3.0.0-5000420260318001`, `@dcloudio/uni-app@3.0.0-5000420260318001`, `@dcloudio/uni-mp-weixin@3.0.0-5000420260318001`, and `vite@5.2.8`.

## Flow checklist

- [x] Reminder return state is mapped through the uni-app reminder adapter and reflected in the training home entry flow.
- [x] Checkpoint gating resolves from the portable student state snapshot without relying on `vue-router`.
- [x] Three-check-in completion remains capped at three valid daily check-ins and still drives weekly adherence.
- [x] Growth physical-metrics empty state still renders the documented fallback message.

## Evidence

- `src/tests/studentApp.spec.ts` verifies the uni-app manifest and entry factory.
- `src/tests/accessFlow.spec.ts` verifies portable checkpoint gating and uni-app snapshot navigation.
- `src/tests/trainingFlow.spec.ts` verifies store adapter behavior plus camera/sensor/reminder adapter boundaries.
- `src/tests/growthFlow.spec.ts` verifies growth summaries and the physical-metrics empty state.
- `src/tests/uiReviewFixes.spec.ts` verifies preserved UI semantics plus uni-app access/training/growth navigation affordances.

## Build integration notes

- The uni CLI expects its canonical manifest and route files under `src/`, so the final integration places `src/manifest.json`, `src/pages.json`, and `src/uni.scss` at the project root.
- The uni runtime entry now lives at `src/main.ts` and `src/App.vue`.
- Thin wrapper pages under `src/pages/**` keep the canonical Mini Program paths stable while reusing the migrated uni-app page implementations under `src/uni-app/pages/**`.

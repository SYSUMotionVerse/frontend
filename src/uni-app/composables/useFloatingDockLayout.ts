import { onMounted, shallowRef } from 'vue'

type WindowInfoLike = {
  safeAreaInsets?: { bottom?: number }
  safeArea?: { bottom?: number }
  windowHeight?: number
  windowWidth?: number
}

const referenceWindowWidth = 375
const dockHeightRpx = 98
const dockBaseGapRpx = 16
const dockContentGapRpx = 18
const referenceSafeAreaBottomPx = 34

export function resolveFloatingDockLayout(windowInfo?: WindowInfoLike) {
  const windowWidth = windowInfo?.windowWidth ?? referenceWindowWidth
  const windowHeight = windowInfo?.windowHeight ?? 0
  const safeAreaBottom = Math.max(
    0,
    windowInfo?.safeAreaInsets?.bottom
      ?? (windowInfo?.safeArea?.bottom === undefined
        ? 0
        : windowHeight - windowInfo.safeArea.bottom)
  )
  const rpxScale = windowWidth / 750
  const baseGapPx = dockBaseGapRpx * rpxScale
  const targetTotalBottomPx = baseGapPx + referenceSafeAreaBottomPx
  const bottomGapPx = Math.max(baseGapPx, targetTotalBottomPx - safeAreaBottom)
  const contentClearancePx = (
    dockHeightRpx * rpxScale
    + bottomGapPx
    + safeAreaBottom
    + dockContentGapRpx * rpxScale
  )

  return { bottomGapPx, contentClearancePx }
}

function getRuntimeWindowInfo(): WindowInfoLike | undefined {
  if (typeof uni === 'undefined') return undefined
  if (typeof uni.getWindowInfo === 'function') return uni.getWindowInfo()
  if (typeof uni.getSystemInfoSync === 'function') return uni.getSystemInfoSync()
  return undefined
}

export function useFloatingDockLayout() {
  const initialLayout = resolveFloatingDockLayout()
  const bottomGapPx = shallowRef(initialLayout.bottomGapPx)
  const contentClearancePx = shallowRef(initialLayout.contentClearancePx)

  onMounted(() => {
    const layout = resolveFloatingDockLayout(getRuntimeWindowInfo())
    bottomGapPx.value = layout.bottomGapPx
    contentClearancePx.value = layout.contentClearancePx
  })

  return { bottomGapPx, contentClearancePx }
}

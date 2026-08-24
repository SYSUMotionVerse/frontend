import { defineConfig, type Plugin } from 'vite'
import uniPlugin from '@dcloudio/vite-plugin-uni'
import Vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import { resolve } from 'path'

const poseStub = (name: string) =>
  resolve(__dirname, `src/uni-app/components/pose/stubs/${name}`)
const uniIconsTestStub = resolve(__dirname, 'src/uni-app/components/stubs/UniIconsStub.vue')

const resolveUniUiScssImport = (url: string) =>
  url === './uni-app/uni.scss'
    ? { file: resolve(__dirname, 'src/uni-app/uni.scss') }
    : null

const trainingSubpackageRoot = `${resolve(
  __dirname,
  'src/subpackages/training'
).replace(/\\/g, '/')}/`

function normalizeModuleId(id: string) {
  return id.replace(/\\/g, '/').split('?')[0]
}

function isPoseRuntimeModule(id: string) {
  const normalizedId = normalizeModuleId(id)
  return (
    normalizedId.includes('/node_modules/@tensorflow-models/') ||
    normalizedId.includes('/node_modules/@tensorflow/') ||
    normalizedId.includes('/node_modules/@mediapipe/')
  )
}

function isTrainingOnlyVendorModule(
  id: string,
  getModuleInfo: (id: string) => {
    importers: readonly string[]
    dynamicImporters: readonly string[]
  } | null,
  cache: Map<string, boolean>
): boolean {
  const cached = cache.get(id)
  if (cached !== undefined) return cached

  const visited = new Set<string>()
  const pending = [id]

  while (pending.length > 0) {
    const currentId = pending.pop()
    if (!currentId || visited.has(currentId)) continue

    const currentCached = cache.get(currentId)
    if (currentCached === true) continue
    if (currentCached === false) {
      cache.set(id, false)
      return false
    }

    visited.add(currentId)
    const normalizedId = normalizeModuleId(currentId)
    if (normalizedId.startsWith(trainingSubpackageRoot)) continue
    if (!normalizedId.includes('/node_modules/')) {
      cache.set(id, false)
      return false
    }

    const moduleInfo = getModuleInfo(currentId)
    const importers = [
      ...(moduleInfo?.importers ?? []),
      ...(moduleInfo?.dynamicImporters ?? [])
    ]
    if (importers.length === 0) {
      cache.set(id, false)
      return false
    }

    pending.push(...importers)
  }

  visited.forEach(moduleId => cache.set(moduleId, true))
  return true
}

function splitTrainingSubpackageVendor(): Plugin {
  const trainingOnlyVendorCache = new Map<string, boolean>()

  return {
    name: 'sport-snack:training-subpackage-vendor',
    enforce: 'post',
    configResolved(config) {
      const output = config.build.rollupOptions.output
      if (!output || Array.isArray(output) || typeof output.manualChunks !== 'function') {
        return
      }

      const defaultManualChunks = output.manualChunks
      output.manualChunks = (id, context) => {
        const normalizedId = normalizeModuleId(id)
        if (
          isPoseRuntimeModule(id) &&
          isTrainingOnlyVendorModule(id, context.getModuleInfo, trainingOnlyVendorCache)
        ) {
          return 'subpackages/training/common/vendor'
        }

        return defaultManualChunks(id, context)
      }
    }
  }
}

export default defineConfig(() => {
  const isUniRuntime = Boolean(process.env.UNI_PLATFORM)
  const uniModule = uniPlugin as typeof uniPlugin & {
    default?: typeof uniModule
  }
  const uni = uniModule.default ?? uniModule

  return {
    plugins: isUniRuntime
      ? [uni(), splitTrainingSubpackageVendor(), UnoCSS()]
      : [UnoCSS(), Vue()],
    resolve: {
      alias: {
        // Stub @tensorflow/tfjs-backend-webgpu which is not supported in WeChat.
        // pose-detection statically imports it; the stub lets the bundle resolve without crashing.
        // The wechat-webgl backend registered by PoseDetectionView handles all actual execution.
        '@tensorflow/tfjs-backend-webgpu': poseStub('webgpu-stub.js'),
        ...(!isUniRuntime ? {
          '@dcloudio/uni-ui/lib/uni-icons/uni-icons.vue': uniIconsTestStub
        } : {}),
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          importer: [resolveUniUiScssImport]
        }
      }
    },
    test: {
      environment: 'jsdom',
      globals: true
    }
  }
})

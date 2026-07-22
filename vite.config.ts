import { defineConfig } from 'vite'
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

export default defineConfig(() => {
  const isUniRuntime = Boolean(process.env.UNI_PLATFORM)
  const uniModule = uniPlugin as typeof uniPlugin & {
    default?: typeof uniModule
  }
  const uni = uniModule.default ?? uniModule

  return {
    plugins: isUniRuntime ? [uni(), UnoCSS()] : [UnoCSS(), Vue()],
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

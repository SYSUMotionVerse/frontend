import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('mini-program package structure', () => {
  it('keeps the TensorFlow visual session out of the main package', () => {
    const pagesManifest = JSON.parse(
      readFileSync(resolve(process.cwd(), 'src/pages.json'), 'utf8')
    ) as {
      pages: Array<{ path: string }>
      subPackages: Array<{
        root: string
        pages: Array<{ path: string }>
      }>
    }
    const trainingPackage = pagesManifest.subPackages.find(
      subPackage => subPackage.root === 'subpackages/training'
    )

    expect(pagesManifest.pages.map(page => page.path)).not.toContain(
      'pages/training/visual-session'
    )
    expect(trainingPackage?.pages.map(page => page.path)).toContain(
      'visual-session'
    )
  })

  it('enables uni-app subpackage optimization and imports only BlazePose TFJS', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(process.cwd(), 'src/manifest.json'), 'utf8')
    ) as {
      'mp-weixin': {
        optimization?: { subPackages?: boolean }
        setting?: { lazyCodeLoading?: string }
      }
    }
    const poseDetectionSource = readFileSync(
      resolve(
        process.cwd(),
        'src/subpackages/training/components/pose/PoseDetectionView.vue'
      ),
      'utf8'
    )

    expect(manifest['mp-weixin'].optimization?.subPackages).toBe(true)
    expect(manifest['mp-weixin'].setting?.lazyCodeLoading).toBe('requiredComponents')
    expect(poseDetectionSource).toContain(
      "@tensorflow-models/pose-detection/dist/blazepose_tfjs/detector"
    )
    expect(poseDetectionSource).not.toContain(
      "from '@tensorflow-models/pose-detection'"
    )
  })
})

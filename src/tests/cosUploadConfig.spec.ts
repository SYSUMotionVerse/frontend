import { describe, expect, it } from 'vitest'
import {
  poseModelFiles,
  resolveCosUploadConfig
} from '../../scripts/cos-upload-config.mjs'

describe('COS pose-model upload configuration', () => {
  it('uses the configured Guangzhou bucket and CDN path', () => {
    expect(resolveCosUploadConfig({
      COS_REGION: 'ap-guangzhou',
      COS_BUCKET: 'sysusports-1442740064',
      COS_SECRET_ID: 'secret-id',
      COS_SECRET_KEY: 'secret-key',
      COS_PUBLIC_BASE_URL: 'https://cdn.sysusports.cn/',
      COS_MODEL_PREFIX: 'pose',
      POSE_MODEL_VERSION: 'blazepose-lite-v1'
    })).toEqual({
      missing: [],
      region: 'ap-guangzhou',
      bucket: 'sysusports-1442740064',
      publicBaseUrl: 'https://cdn.sysusports.cn',
      prefix: 'pose',
      version: 'blazepose-lite-v1'
    })
  })

  it('requires credentials without embedding them in source', () => {
    const config = resolveCosUploadConfig({
      COS_REGION: 'ap-guangzhou',
      COS_BUCKET: 'sysusports-1442740064',
      COS_SECRET_ID: '',
      COS_SECRET_KEY: '',
      COS_PUBLIC_BASE_URL: 'https://cdn.sysusports.cn'
    })

    expect(config.missing).toEqual(['COS_SECRET_ID', 'COS_SECRET_KEY'])
    expect(poseModelFiles).toHaveLength(5)
  })
})

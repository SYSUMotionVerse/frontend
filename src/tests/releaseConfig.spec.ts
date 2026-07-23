import { describe, expect, it } from 'vitest'
import {
  validateGeneratedProjectConfig,
  validateProductionManifest,
  validateReleaseConfig,
  validateShortQuestionnaireEndpoint,
} from '../../scripts/release-config.mjs'

describe('release configuration', () => {
  it('accepts HTTPS API and OSS model origins', () => {
    expect(
      validateReleaseConfig({
        VITE_API_BASE_URL: 'https://api.sport-snack.cn/api',
        VITE_POSE_MODEL_BASE_URL:
          'https://models.sport-snack.cn/pose/blazepose-lite-v1',
        VITE_POSE_MODEL_VERSION: 'blazepose-lite-v1',
      }),
    ).toEqual([])
  })

  it('rejects missing, local, or insecure production endpoints', () => {
    expect(
      validateReleaseConfig({
        VITE_API_BASE_URL: 'http://119.91.74.187/api',
        VITE_POSE_MODEL_BASE_URL: 'http://127.0.0.1:8765',
        VITE_POSE_MODEL_VERSION: '',
      }),
    ).toEqual([
      'VITE_API_BASE_URL must use HTTPS for a production mini-program',
      'VITE_API_BASE_URL must use a registrable domain instead of an IP address',
      'VITE_POSE_MODEL_BASE_URL must use HTTPS for a production mini-program',
      'VITE_POSE_MODEL_BASE_URL must use a registrable domain instead of an IP address',
      'VITE_POSE_MODEL_BASE_URL must not point to a local host',
      'VITE_POSE_MODEL_VERSION is required',
    ])
  })

  it('rejects HTTPS IP literals because WeChat requires a legal domain', () => {
    expect(
      validateReleaseConfig({
        VITE_API_BASE_URL: 'https://119.91.74.187/api',
        VITE_POSE_MODEL_BASE_URL: 'https://[2001:db8::1]/pose',
        VITE_POSE_MODEL_VERSION: 'blazepose-lite-v1',
      }),
    ).toEqual([
      'VITE_API_BASE_URL must use a registrable domain instead of an IP address',
      'VITE_POSE_MODEL_BASE_URL must use a registrable domain instead of an IP address',
    ])
  })

  it('rejects example placeholder domains', () => {
    expect(
      validateReleaseConfig({
        VITE_API_BASE_URL: 'https://api.example.com/api',
        VITE_POSE_MODEL_BASE_URL:
          'https://models.example.com/pose/blazepose-lite-v1',
        VITE_POSE_MODEL_VERSION: 'blazepose-lite-v1',
      }),
    ).toEqual([
      'VITE_API_BASE_URL must not use the example placeholder domain',
      'VITE_POSE_MODEL_BASE_URL must not use the example placeholder domain',
    ])
  })

  it('only permits reserved placeholder domains in explicitly opted-in CI builds', () => {
    const environment = {
      VITE_API_BASE_URL: 'https://api.ci.invalid/api',
      VITE_POSE_MODEL_BASE_URL: 'https://models.ci.invalid/pose',
      VITE_POSE_MODEL_VERSION: 'ci-model',
    }

    expect(validateReleaseConfig(environment)).toEqual([
      'VITE_API_BASE_URL must not use a reserved placeholder domain outside an explicit CI build',
      'VITE_POSE_MODEL_BASE_URL must not use a reserved placeholder domain outside an explicit CI build',
    ])
    expect(
      validateReleaseConfig({
        ...environment,
        CI: 'true',
        ALLOW_CI_RELEASE_PLACEHOLDERS: 'true',
      }),
    ).toEqual([])
  })

  it('requires domain checks and a real AppID in the source manifest', () => {
    expect(
      validateProductionManifest({
        'mp-weixin': {
          appid: 'touristappid',
          setting: { urlCheck: false },
        },
      }),
    ).toEqual([
      'mp-weixin.appid must be a real release AppID',
      'mp-weixin.setting.urlCheck must be true for production',
      'mp-weixin.setting.minified must be true for production',
      'mp-weixin.setting.minifyWXSS must be true for production',
      'mp-weixin.setting.minifyWXML must be true for production',
      'mp-weixin.setting.uploadWithSourceMap must be false for production',
    ])
  })

  it('rejects a source manifest appid that does not match the WeChat format', () => {
    expect(
      validateProductionManifest({
        'mp-weixin': {
          appid: 'wx-release-appid',
          setting: productionSettings,
        },
      }),
    ).toEqual([
      'mp-weixin.appid must match the WeChat format wx followed by 16 hex characters',
    ])
  })

  it('accepts a source manifest appid matching the WeChat format', () => {
    expect(
      validateProductionManifest({
        'mp-weixin': {
          appid: 'wx4305e8964a9093fc',
          setting: productionSettings,
        },
      }),
    ).toEqual([])
  })

  it('verifies domain checks again in the generated DevTools config', () => {
    expect(
      validateGeneratedProjectConfig({
        appid: 'wx4305e8964a9093fc',
        setting: productionSettings,
      }),
    ).toEqual([])
    expect(
      validateGeneratedProjectConfig({
        appid: 'touristappid',
        setting: { urlCheck: false },
      }),
    ).toEqual([
      'generated project.config.json must contain a real release AppID',
      'generated project.config.json must enable setting.urlCheck',
      'generated project.config.json must enable setting.minified',
      'generated project.config.json must enable setting.minifyWXSS',
      'generated project.config.json must enable setting.minifyWXML',
      'generated project.config.json must disable setting.uploadWithSourceMap',
    ])
  })

  it('rejects a generated project config appid that does not match the WeChat format', () => {
    expect(
      validateGeneratedProjectConfig({
        appid: 'wx-release-appid',
        setting: productionSettings,
      }),
    ).toEqual([
      'generated project.config.json appid must match the WeChat format wx followed by 16 hex characters',
    ])
  })

  it('leaves VITE_SHORT_QUESTIONNAIRE_ENDPOINT optional in release validation', () => {
    expect(
      validateReleaseConfig({
        VITE_API_BASE_URL: 'https://api.sport-snack.cn/api',
        VITE_POSE_MODEL_BASE_URL: 'https://models.sport-snack.cn/pose/blazepose-lite-v1',
        VITE_POSE_MODEL_VERSION: 'blazepose-lite-v1',
      }),
    ).toEqual([])
  })

  it('accepts a valid relative path for VITE_SHORT_QUESTIONNAIRE_ENDPOINT', () => {
    expect(
      validateReleaseConfig({
        VITE_API_BASE_URL: 'https://api.sport-snack.cn/api',
        VITE_POSE_MODEL_BASE_URL: 'https://models.sport-snack.cn/pose/blazepose-lite-v1',
        VITE_POSE_MODEL_VERSION: 'blazepose-lite-v1',
        VITE_SHORT_QUESTIONNAIRE_ENDPOINT: '/exercises/short-questionnaires',
      }),
    ).toEqual([])
  })

  it('rejects an endpoint without a leading slash', () => {
    expect(
      validateShortQuestionnaireEndpoint('exercises/short-questionnaires'),
    ).toContain('VITE_SHORT_QUESTIONNAIRE_ENDPOINT must begin with a single slash')
  })

  it('rejects a double-slash scheme-relative endpoint', () => {
    expect(
      validateShortQuestionnaireEndpoint('//api.example.com/short-questionnaires'),
    ).toContain('VITE_SHORT_QUESTIONNAIRE_ENDPOINT must not start with a double slash (scheme-relative URL)')
  })

  it('rejects an endpoint with a scheme', () => {
    expect(
      validateShortQuestionnaireEndpoint('https://api.example.com/short-questionnaires'),
    ).toContain('VITE_SHORT_QUESTIONNAIRE_ENDPOINT must not include a scheme')
  })

  it('rejects an endpoint with a query string', () => {
    expect(
      validateShortQuestionnaireEndpoint('/exercises/short-questionnaires?foo=bar'),
    ).toContain('VITE_SHORT_QUESTIONNAIRE_ENDPOINT must not include a query string')
  })

  it('rejects an endpoint with a fragment', () => {
    expect(
      validateShortQuestionnaireEndpoint('/exercises/short-questionnaires#section'),
    ).toContain('VITE_SHORT_QUESTIONNAIRE_ENDPOINT must not include a fragment')
  })

  it('rejects an endpoint with path traversal', () => {
    expect(
      validateShortQuestionnaireEndpoint('/exercises/../admin/short-questionnaires'),
    ).toContain('VITE_SHORT_QUESTIONNAIRE_ENDPOINT must not include path traversal')
  })

  it('rejects an endpoint with a backslash', () => {
    expect(
      validateShortQuestionnaireEndpoint('/exercises\\short-questionnaires'),
    ).toContain('VITE_SHORT_QUESTIONNAIRE_ENDPOINT must not include a backslash')
  })

  it('rejects an empty path ("/")', () => {
    expect(
      validateShortQuestionnaireEndpoint('/'),
    ).toContain('VITE_SHORT_QUESTIONNAIRE_ENDPOINT must not be an empty path ("/")')
  })

  it('rejects whitespace in the endpoint', () => {
    expect(
      validateShortQuestionnaireEndpoint('/exercises /short-questionnaires'),
    ).toContain('VITE_SHORT_QUESTIONNAIRE_ENDPOINT must not contain whitespace or control characters')
  })

  it('rejects control characters in the endpoint', () => {
    expect(
      validateShortQuestionnaireEndpoint('/exercises\u0001/short-questionnaires'),
    ).toContain('VITE_SHORT_QUESTIONNAIRE_ENDPOINT must not contain whitespace or control characters')
  })

  it('rejects percent-encoded path traversal (%2e)', () => {
    expect(
      validateShortQuestionnaireEndpoint('/exercises/%2e%2e/admin'),
    ).toContain('VITE_SHORT_QUESTIONNAIRE_ENDPOINT must not include percent-encoded path traversal or backslash')
  })

  it('rejects percent-encoded forward slash (%2f)', () => {
    expect(
      validateShortQuestionnaireEndpoint('/exercises%2fadmin'),
    ).toContain('VITE_SHORT_QUESTIONNAIRE_ENDPOINT must not include percent-encoded path traversal or backslash')
  })

  it('rejects percent-encoded backslash (%5c)', () => {
    expect(
      validateShortQuestionnaireEndpoint('/exercises%5cadmin'),
    ).toContain('VITE_SHORT_QUESTIONNAIRE_ENDPOINT must not include percent-encoded path traversal or backslash')
  })
})

const productionSettings = {
  urlCheck: true,
  minified: true,
  minifyWXSS: true,
  minifyWXML: true,
  uploadWithSourceMap: false,
}

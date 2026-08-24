import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('uno miniapp transform', () => {
  it('does not emit bound prop names into the miniapp wxss bundle', () => {
    const uniCli = resolve(
      'node_modules/@dcloudio/vite-plugin-uni/bin/uni.js'
    )
    execFileSync(process.execPath, [uniCli, 'build', '-p', 'mp-weixin'], {
      cwd: resolve('.'),
      stdio: 'pipe'
    })

    const appWxss = readFileSync(
      resolve('dist/build/mp-weixin/app.wxss'),
      'utf8'
    )

    expect(appWxss).not.toContain('.display-name')
  }, 120000)
})

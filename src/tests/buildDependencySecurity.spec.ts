import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

// Resolve the package actually used by DCloud's glob tooling, so this test
// verifies the installed pnpm patch rather than a copied or mocked function.
const require = createRequire(import.meta.url)
const pluginRequire = createRequire(require.resolve('@dcloudio/vite-plugin-uni'))
const compilerRequire = createRequire(pluginRequire.resolve('@dcloudio/uni-cli-shared'))
const globRequire = createRequire(compilerRequire.resolve('fast-glob'))
const micromatchRequire = createRequire(globRequire.resolve('micromatch'))

interface BraceAst {
  type: string
  value?: string
  nodes?: BraceAst[]
}

const braces = micromatchRequire('braces') as {
  parse: (input: string) => BraceAst
  compile: (input: string | BraceAst) => string
  expand: (input: string | BraceAst) => string[]
  stringify: (input: string | BraceAst) => string
}
const nestingError = 'Input nesting exceeds max depth (100)'

describe('installed build dependency security fixes', () => {
  it.each(['parse', 'compile', 'expand', 'stringify'] as const)(
    'rejects deeply nested brace patterns in %s before a stack overflow', method => {
      const pattern = '{'.repeat(3500) + 'x' + '}'.repeat(3500)
      expect(() => braces[method](pattern)).toThrow(nestingError)
    }
  )

  it.each(['{'.repeat(3500), '('.repeat(3500) + 'x' + ')'.repeat(3500)])(
    'also bounds unmatched braces and parentheses', pattern => {
      expect(() => braces.parse(pattern)).toThrow(nestingError)
    }
  )

  it.each(['compile', 'expand', 'stringify'] as const)(
    'bounds direct AST input in %s even when parsing was bypassed', method => {
      let node: BraceAst = { type: 'text', value: 'x' }
      for (let index = 0; index < 3500; index++) {
        node = { type: 'root', nodes: [node] }
      }
      expect(() => braces[method](node)).toThrow(nestingError)
    }
  )

  it('accepts normal glob alternatives and ranges', () => {
    expect(braces.compile('src/{pages,components}/*.{vue,ts}'))
      .toBe('src/(pages|components)/*.(vue|ts)')
    expect(braces.expand('asset-{1..3}.{png,jpg}'))
      .toEqual(['asset-1.png', 'asset-1.jpg', 'asset-2.png', 'asset-2.jpg', 'asset-3.png', 'asset-3.jpg'])
    expect(braces.stringify(braces.parse('src/{pages,components}/**/*.vue')))
      .toBe('src/{pages,components}/**/*.vue')
  })

  it('permits 100 nested containers and rejects the next level', () => {
    const valid = '{'.repeat(100) + 'x' + '}'.repeat(100)
    expect(braces.stringify(valid)).toBe(valid)
    expect(() => braces.compile(valid)).not.toThrow()
    expect(() => braces.expand(valid)).not.toThrow()
    expect(() => braces.parse('{' + valid + '}')).toThrow(nestingError)
  })

  it('does not treat quoted or escaped braces as nested containers', () => {
    expect(braces.stringify('"' + '{'.repeat(3500) + '"')).toBe('{'.repeat(3500))
    expect(braces.stringify('\\{'.repeat(3500))).toBe('{'.repeat(3500))
    expect(braces.compile('{a,b}'.repeat(500))).toBe('(a|b)'.repeat(500))
  })

  it('omits unsafe SSR attributes containing carriage returns', () => {
    const renderer = compilerRequire('@vue/server-renderer') as {
      ssrRenderAttrs: (attributes: Record<string, string>) => string
    }
    expect(renderer.ssrRenderAttrs({ 'data-test\ronclick': 'alert(1)' })).toBe('')
    expect(renderer.ssrRenderAttrs({ 'data-test': 'safe' })).toBe(' data-test="safe"')
  })

  it('rejects excessive indexed source-map offsets before blocking the event loop', () => {
    const coreRequire = createRequire(compilerRequire.resolve('@vue/compiler-core'))
    const { SourceMapConsumer } = coreRequire('source-map-js') as {
      SourceMapConsumer: new (map: unknown) => { sources: string[] }
    }
    const sectionMap = { version: 3, sources: ['source.ts'], names: [], mappings: 'AAAA' }
    expect(() => new SourceMapConsumer({
      version: 3,
      sections: [{ offset: { line: 1_000_000_000, column: 0 }, map: sectionMap }]
    })).toThrow('Section offset line must not exceed')
    expect(() => new SourceMapConsumer({
      version: 3,
      sections: [{ offset: { line: -1, column: 0 }, map: sectionMap }]
    })).toThrow('Section offset line and column must be non-negative integers')
    expect(new SourceMapConsumer({
      version: 3,
      sections: [{ offset: { line: 5, column: 0 }, map: sectionMap }]
    }).sources).toEqual(['source.ts'])
  })
})

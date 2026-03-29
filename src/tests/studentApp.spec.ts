describe('student miniapp route map', () => {
  it('defines the required student flow pages in the uni-app manifest', async () => {
    const pagesManifest = await import('../uni-app/pages.json')
    const routePaths = pagesManifest.pages.map(page => page.path)

    expect(routePaths).toEqual(
      expect.arrayContaining([
        'pages/access/register',
        'pages/access/questionnaire',
        'pages/access/questionnaire-result',
        'pages/training/home',
        'pages/training/select',
        'pages/training/visual-session',
        'pages/training/stair-session',
        'pages/training/short-questionnaire',
        'pages/training/feedback',
        'pages/growth/index'
      ])
    )
  })

  it('will expose shared student state models', async () => {
    const stateModule = await import('../composables/useStudentAppState')

    expect(stateModule.createInitialStudentState).toBeTypeOf('function')
  })

  it('wires a uni-app application entry factory', async () => {
    const uniAppModule = await import('../uni-app/main')
    const { app } = uniAppModule.createApp()

    expect(uniAppModule.createApp).toBeTypeOf('function')
    expect(app).toBeTruthy()
  })

  it('makes the mini-program runtime the only exposed app target', async () => {
    const packageManifest = await import('../../package.json')

    expect(packageManifest.scripts.dev).toContain('mp-weixin')
    expect(packageManifest.scripts.build).toContain('mp-weixin')
    expect(packageManifest.scripts).not.toHaveProperty('dev:web')
    expect(packageManifest.scripts).not.toHaveProperty('build:web')
  })
})

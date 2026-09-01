import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TrainingHomeCoachCard from '../components/training/TrainingHomeCoachCard.vue'
import {
  pickTrainingHomeQuote,
  TRAINING_HOME_QUOTES
} from '../features/training/trainingHomeQuotes'

describe('training home coach quotes', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('contains the complete reviewed quote library', () => {
    expect(TRAINING_HOME_QUOTES).toHaveLength(14)
    expect(new Set(TRAINING_HOME_QUOTES).size).toBe(14)
    expect(TRAINING_HOME_QUOTES).toContain('把运动拆小，把健康攒起来。')
    expect(TRAINING_HOME_QUOTES).toContain('给忙碌按个暂停，给身体按下启动，给健康按住refresh。')
    expect(TRAINING_HOME_QUOTES).toContain('这一小段时间，留给身体。')
    expect(TRAINING_HOME_QUOTES).toContain('深呼吸，然后动起来。')
  })

  it('selects deterministically and avoids repeating the current quote', () => {
    expect(pickTrainingHomeQuote('', () => 0)).toBe(TRAINING_HOME_QUOTES[0])
    expect(pickTrainingHomeQuote('', () => 0.999999)).toBe(TRAINING_HOME_QUOTES.at(-1))
    expect(pickTrainingHomeQuote(TRAINING_HOME_QUOTES[0], () => 0))
      .toBe(TRAINING_HOME_QUOTES[1])
  })

  it('rotates every minute and on refresh with a rolling text transition', () => {
    const home = readFileSync(resolve('src/uni-app/pages/training/home.vue'), 'utf8')
    const viewModel = readFileSync(
      resolve('src/uni-app/composables/useTrainingHomeProgressViewModel.ts'),
      'utf8'
    )
    const card = readFileSync(
      resolve('src/components/training/TrainingHomeCoachCard.vue'),
      'utf8'
    )

    expect(home).toContain('const coachQuote = ref(pickTrainingHomeQuote())')
    expect(home).toContain('setInterval(rotateCoachQuote, 60_000)')
    expect(home).toMatch(/async function handlePullDownRefresh\(\)[\s\S]*rotateCoachQuote\(\)/)
    expect(home).toContain('onBeforeUnmount(stopQuoteRotation)')
    expect(viewModel).toContain("footer: '屈萍老师'")
    expect(viewModel).not.toContain('Coach Harris')
    expect(card).not.toContain('<transition')
    expect(card).toContain('outgoingTitle.value = displayedTitle.value')
    expect(card).toContain('displayedTitle.value = nextTitle')
    expect(card).toContain("'coach-card__title--incoming': outgoingTitle")
    expect(card).toContain("'coach-card__title--rolling': quoteRolling")
    expect(card).toContain('transform: translateY(80%);')
    expect(card).toContain('transform: translateY(-80%);')
  })

  it('keeps both quote layers mounted while the replacement rolls through', async () => {
    vi.useFakeTimers()
    const wrapper = mount(TrainingHomeCoachCard, {
      props: {
        eyebrow: '教练金句',
        title: TRAINING_HOME_QUOTES[0],
        body: '',
        footer: '屈萍老师'
      },
      global: { stubs: { UniIcons: true } }
    })

    await wrapper.setProps({ title: TRAINING_HOME_QUOTES[1] })
    expect(wrapper.findAll('.coach-card__title')).toHaveLength(2)
    expect(wrapper.get('.coach-card__title--incoming').text()).toBe(TRAINING_HOME_QUOTES[1])

    await vi.advanceTimersByTimeAsync(16)
    expect(wrapper.findAll('.coach-card__title--rolling')).toHaveLength(2)

    await vi.advanceTimersByTimeAsync(304)
    expect(wrapper.findAll('.coach-card__title')).toHaveLength(1)
    expect(wrapper.get('.coach-card__title').text()).toBe(TRAINING_HOME_QUOTES[1])
  })
})

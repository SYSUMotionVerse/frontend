export const TRAINING_HOME_QUOTES = [
  '把运动拆小，把健康攒起来。',
  '每一个碎片时间，都能拼回更好的状态。',
  '运动不必长篇大论，开始就有意义。',
  '不必等有空，现在就动一动。',
  '几分钟，也值得身体认真回应。',
  '一次起身，就是一次健康重启。',
  '今天的几分钟，身体都会记得。',
  '让身体上线，让状态回来。',
  '不卷时长，动了就算数。',
  '不用练很久，只要现在抬抬脚。',
  '动作可以很短，改变可以很长。',
  '给忙碌按个暂停，给身体按下启动，给健康按住refresh。',
  '这一小段时间，留给身体。',
  '深呼吸，然后动起来。'
] as const

export function pickTrainingHomeQuote(
  previousQuote = '',
  random: () => number = Math.random
) {
  const candidates = TRAINING_HOME_QUOTES.filter(quote => quote !== previousQuote)
  const sample = random()
  const normalizedSample = Number.isFinite(sample)
    ? Math.min(Math.max(sample, 0), 0.9999999999999999)
    : 0
  return candidates[Math.floor(normalizedSample * candidates.length)]
    ?? TRAINING_HOME_QUOTES[0]
}

type UniWithTrainingFeedback = typeof uni & {
  vibrateShort?: (options?: { type?: 'light' | 'medium' | 'heavy' }) => Promise<unknown> | unknown
}

type InnerAudioContextLike = {
  src: string
  autoplay: boolean
  obeyMuteSwitch?: boolean
  play?: () => void
  stop?: () => void
  destroy?: () => void
  onEnded?: (callback: () => void) => void
  onError?: (callback: () => void) => void
}

type WechatAudioFactory = typeof wx & {
  createInnerAudioContext?: () => InnerAudioContextLike
}

const TRAINING_COMPLETE_BEEP =
  'data:audio/mpeg;base64,//uQZAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAFAAAJXgD///////////////////////////////////////////////8AAAAATGF2YzU5LjM3AAAAAAAAAAAAAAAAJAYAAAAAAAAJXktwDvK6AAAAAAAAAAAAAAAAAAAA//uQZAAABpFYBMAQBQMAAAAAAAAAAAAAAABJbmZvAAAADwAAAAUAAAlOAMnJycn///////////////////////////////////////////////////////8AAAAATGF2YzU5LjM3AAAAAAAAAAAAAAAAJAYAAAAAAAAJRLuk3hcrAAAAAAAAAAAAAAAAAAAA//uQZAAACRNYBMQgHAAAAAAAAAAAAAAAAAAA//sQxAADwAABpAAAAnMAABJYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhY'

export async function notifyTrainingComplete() {
  const playedAudio = playTrainingCompleteBeep()

  if (playedAudio) {
    return
  }

  await vibrateTrainingComplete()
}

function playTrainingCompleteBeep() {
  const wechatApi = typeof wx !== 'undefined' ? wx as WechatAudioFactory : null
  const audioContext = wechatApi?.createInnerAudioContext?.()

  if (!audioContext) {
    return false
  }

  audioContext.autoplay = false
  audioContext.obeyMuteSwitch = false
  audioContext.src = TRAINING_COMPLETE_BEEP

  const dispose = () => {
    audioContext.stop?.()
    audioContext.destroy?.()
  }

  audioContext.onEnded?.(dispose)
  audioContext.onError?.(dispose)
  audioContext.play?.()
  setTimeout(dispose, 1200)

  return true
}

async function vibrateTrainingComplete() {
  try {
    await (uni as UniWithTrainingFeedback).vibrateShort?.({
      type: 'medium'
    })
  } catch {
    // Ignore unsupported feedback APIs. Training completion should not be blocked.
  }
}

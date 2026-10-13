import type { SignaturePixels } from './signatureOcr'

export interface SignatureImage { imageBase64: string, pixels: SignaturePixels }
export interface SignatureCompletion { token: string }
type Channel = { pending?: { token: string, image: SignatureImage } }
const channels = new Map<string, Channel>()
let sequence = 0

// uni-app forwards component emits through native triggerEvent. Keep large
// typed pixel arrays in the service JS heap; only a short token crosses it.
export function createSignatureImageHandoff() {
  const id = `signature-${++sequence}`
  const channel: Channel = {}
  channels.set(id, channel)
  return {
    id,
    take(token: string): SignatureImage | undefined {
      if (typeof token !== 'string' || channels.get(id) !== channel || !channel.pending || channel.pending.token !== token) return undefined
      const image = channel.pending.image
      channel.pending = undefined
      return image
    },
    clear() { channel.pending = undefined },
    dispose() { channel.pending = undefined; channels.delete(id) }
  }
}

export function stageSignatureImage(id: string, image: SignatureImage): SignatureCompletion {
  const channel = channels.get(id)
  if (!channel) throw new Error('signature_handoff_closed')
  const token = `signature-image-${++sequence}`
  channel.pending = { token, image }
  return { token }
}

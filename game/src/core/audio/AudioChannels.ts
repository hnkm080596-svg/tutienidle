// Sound System W1 - channel ids + default channel volumes.
// Pure data: no Tone/Vue/Phaser imports (spec 1.1).

export type AudioChannelId = 'music' | 'sfx' | 'ui'

export const AUDIO_CHANNELS: readonly AudioChannelId[] = ['music', 'sfx', 'ui']

export const DEFAULT_CHANNEL_VOLUMES: Readonly<Record<AudioChannelId, number>> = {
  music: 0.5,
  sfx: 0.8,
  ui: 0.7,
}

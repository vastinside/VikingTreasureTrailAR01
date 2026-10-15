export const COOLDOWN_MS = 2500

export function createPlayback() {
  return { sessionIndex: null, cooldownIndex: null, cooldownUntil: 0 }
}

export function scanMarker(state, index, now) {
  if (state.sessionIndex !== null) return { state, action: 'ignore' }
  if (state.cooldownIndex === index && now < state.cooldownUntil) {
    return { state, action: 'ignore' }
  }
  return {
    state: { ...state, sessionIndex: index },
    action: 'start',
  }
}

export function markerLost(state) {
  return { state, action: 'keep' }
}

export function finishPlayback(state, index, now) {
  if (state.sessionIndex !== index) return { state, action: 'ignore' }
  return {
    state: {
      sessionIndex: null,
      cooldownIndex: index,
      cooldownUntil: now + COOLDOWN_MS,
    },
    action: 'finish',
  }
}

export function cancelPlayback(state, index, now) {
  if (state.sessionIndex === null) return { state, action: 'ignore' }
  return {
    state: {
      sessionIndex: null,
      cooldownIndex: index,
      cooldownUntil: now + COOLDOWN_MS,
    },
    action: 'cancel',
  }
}

export function clipFinished({ hasVoice, voiceEnded, hasVideo, videoEnded }) {
  if (hasVoice && !voiceEnded) return false
  if (hasVideo && !videoEnded) return false
  return true
}

export function clipSourceReady(currentSrc, expected, readyState) {
  if (readyState < 2 || !currentSrc || !expected) return false
  const fileName = (value) => value.split('?')[0].split('/').pop()
  return fileName(currentSrc) === fileName(expected)
}

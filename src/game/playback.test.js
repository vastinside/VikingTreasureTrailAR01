import assert from 'node:assert/strict'
import test from 'node:test'
import {
  COOLDOWN_MS,
  cancelPlayback,
  clipFinished,
  clipSourceReady,
  createPlayback,
  finishPlayback,
  markerLost,
  scanMarker,
} from './playback.js'

test('the first look starts one play', () => {
  const result = scanMarker(createPlayback(), 0, 1000)
  assert.equal(result.action, 'start')
  assert.equal(result.state.sessionIndex, 0)
})

test('another look while it is playing does not start again', () => {
  const started = scanMarker(createPlayback(), 0, 1000)
  const same = scanMarker(started.state, 0, 1100)
  const other = scanMarker(started.state, 3, 1100)
  assert.equal(same.action, 'ignore')
  assert.equal(other.action, 'ignore')
  assert.equal(same.state.sessionIndex, 0)
})

test('losing the picture does not stop the play', () => {
  const started = scanMarker(createPlayback(), 0, 1000)
  const lost = markerLost(started.state)
  assert.equal(lost.action, 'keep')
  assert.equal(lost.state.sessionIndex, 0)
})

test('finishing shows the reward and then waits', () => {
  const started = scanMarker(createPlayback(), 1, 1000)
  const done = finishPlayback(started.state, 1, 5000)
  assert.equal(done.action, 'finish')
  assert.equal(done.state.sessionIndex, null)
  const tooSoon = scanMarker(done.state, 1, 5000 + COOLDOWN_MS - 1)
  assert.equal(tooSoon.action, 'ignore')
  const later = scanMarker(done.state, 1, 5000 + COOLDOWN_MS)
  assert.equal(later.action, 'start')
})

test('a different picture can start after this one finishes', () => {
  const started = scanMarker(createPlayback(), 1, 1000)
  const done = finishPlayback(started.state, 1, 5000)
  const next = scanMarker(done.state, 2, 5001)
  assert.equal(next.action, 'start')
})

test('closing does not leave the play running', () => {
  const started = scanMarker(createPlayback(), 4, 1000)
  const closed = cancelPlayback(started.state, 4, 2000)
  assert.equal(closed.action, 'cancel')
  assert.equal(closed.state.sessionIndex, null)
  const again = scanMarker(closed.state, 4, 2000 + COOLDOWN_MS - 1)
  assert.equal(again.action, 'ignore')
})

test('a video clip is finished only when the voice and the picture are both done', () => {
  assert.equal(clipFinished({ hasVoice: true, voiceEnded: false, hasVideo: true, videoEnded: true }), false)
  assert.equal(clipFinished({ hasVoice: true, voiceEnded: true, hasVideo: true, videoEnded: false }), false)
  assert.equal(clipFinished({ hasVoice: true, voiceEnded: true, hasVideo: true, videoEnded: true }), true)
  assert.equal(clipFinished({ hasVoice: true, voiceEnded: true, hasVideo: false, videoEnded: false }), true)
})

test('a new video does not count as ready while the previous file is still loaded', () => {
  assert.equal(clipSourceReady('https://havelok.example/videos/viking.mp4', './videos/longship.mp4', 4), false)
  assert.equal(clipSourceReady('https://havelok.example/videos/longship.mp4', './videos/longship.mp4', 2), true)
  assert.equal(clipSourceReady('https://havelok.example/videos/longship.mp4', './videos/longship.mp4', 1), false)
  assert.equal(clipSourceReady('', './videos/longship.mp4', 4), false)
})

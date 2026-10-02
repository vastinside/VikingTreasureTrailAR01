import './styles.css'
import { treasures } from './config/treasures.js'
import { loadProgress, collectTreasure, resetProgress, countFound } from './game/progress.js'

const progressLabel = document.querySelector('#progress')
const panelCount = document.querySelector('#panel-count')
const collectButton = document.querySelector('#collect')
const resetButton = document.querySelector('#reset-trail')
const startButton = document.querySelector('#start-camera')
const cameraScene = document.querySelector('#camera-scene')
const viewer = document.querySelector('#viewer')
const treasureName = document.querySelector('#treasure-name')
const treasureFact = document.querySelector('#treasure-fact')
const closeButton = document.querySelector('#close-panel')
const keepTryingButton = document.querySelector('#keep-trying')
const viewTreasureButton = document.querySelector('#view-treasure')
const preparing = document.querySelector('#preparing')
const status = document.querySelector('#status')
const treasureModel = document.querySelector('#treasure-model')
const treasureImage = document.querySelector('#treasure-image')
const treasureVideo = document.querySelector('#treasure-video')
const treasureKey = document.querySelector('#treasure-key')
const keyCtx = treasureKey.getContext('2d', { willReadFrequently: true })
let keyFrame = 0
let keyContent = null
let keySeen = null
let keyStack = null
let playingIndex = null
let lostTimer = null
const completeList = document.querySelector('#complete-list')
const completeReset = document.querySelector('#complete-reset')

const HELP_AFTER_MS = 8000
let helpTimer = null
let audioContext = null
let active = null
let hearingTreasure = false
const voice = new Audio()

function render() {
  const progress = loadProgress()
  const found = countFound(progress)
  const total = treasures.length
  progressLabel.textContent = `${found} / ${total} Treasures Found`
  panelCount.textContent = `${found} / ${total}`

  const complete = found === total && total > 0
    document.body.classList.toggle('trail-complete', complete)
    if (complete) stopVoice()

    completeList.replaceChildren()
    treasures.forEach((item) => {
    const line = document.createElement('p')
    line.textContent = `${progress[item.id] ? '✓' : '○'} ${item.name}`
    completeList.appendChild(line)
    })

  treasureName.textContent = active.name
  treasureFact.textContent = active.fact

  if (progress[active.id]) {
    collectButton.textContent = 'Collected'
    collectButton.disabled = true
  } else {
    collectButton.textContent = 'Collect treasure'
    collectButton.disabled = false
  }
}

function showTreasure(treasure) {
  const previous = active
  active = treasure
  const kind = treasure.kind || 'model'
  const playsWebm = treasureVideo.canPlayType('video/webm; codecs="vp9"') !== ''

  viewer.hidden = kind !== 'model'
  treasureImage.hidden = kind !== 'image'
  treasureVideo.hidden = kind !== 'video'
  treasureKey.hidden = true
  treasureVideo.classList.remove('keying')
  treasureVideo.pause()
  cancelAnimationFrame(keyFrame)

  if (kind === 'model' && (!previous || previous.model !== treasure.model) && treasure.model) {
    treasureModel.setAttribute('rotation', treasure.rotation || '0 0 0')
    treasureModel.setAttribute('gltf-model', treasure.model)
  }
  if (kind === 'image') {
    treasureImage.src = treasure.image
    treasureImage.alt = treasure.name
  }
  if (kind === 'video') {
    treasureVideo.innerHTML = ''
    treasureVideo.removeAttribute('src')
    if (treasure.video) {
      treasureVideo.muted = true
      treasureVideo.loop = false
      treasureVideo.playsInline = true
      treasureVideo.classList.add('keying')
      treasureVideo.dataset.key = 'black'
      treasureVideo.src = treasure.video
      treasureKey.hidden = false
    } else if (treasure.videoMp4) {
      treasureVideo.muted = true
      treasureVideo.loop = false
      treasureVideo.playsInline = true
      treasureVideo.classList.add('keying')
      treasureVideo.dataset.key = 'green'
      treasureVideo.src = treasure.videoMp4
      treasureKey.hidden = false
    } else if (playsWebm && treasure.videoWebm) {
      const source = document.createElement('source')
      source.src = treasure.videoWebm
      source.type = 'video/webm'
      treasureVideo.appendChild(source)
    }
  }
  render()
}

function unlockAudio() {
  if (!audioContext) audioContext = new AudioContext()
  audioContext.resume()
  const primer = treasures.find((item) => item.voice)
  if (!primer) return
  voice.volume = 0
  voice.src = primer.voice
  voice.play().then(() => {
    voice.volume = 1
    if (hearingTreasure) return
    voice.pause()
    voice.currentTime = 0
  }).catch(() => {
    voice.volume = 1
  })
}

function playVoice() {
  if (document.body.classList.contains('trail-complete')) return
  if (!active || !active.voice) {
    stopVoice()
    return
  }
  hearingTreasure = true
  voice.volume = 1
  voice.src = active.voice
  voice.currentTime = 0
  voice.play().catch(() => {})
}

function stopVoice() {
  hearingTreasure = false
  voice.pause()
  voice.currentTime = 0
}

function scheduleHelp() {
  clearTimeout(helpTimer)
  helpTimer = setTimeout(() => {
    if (!document.body.classList.contains('target-found')) {
      document.body.classList.add('show-help')
    }
  }, HELP_AFTER_MS)
}

function fitTreasureModel() {
  const mesh = treasureModel.getObject3D('mesh')
  const camera = viewer.camera
  const canvas = viewer.canvas
  if (!mesh || !camera || !canvas) return
  if (canvas.clientWidth < 2 || canvas.clientHeight < 2) return

  const three = window.AFRAME.THREE
  const spin = treasureModel.object3D.parent
  treasureModel.object3D.position.set(0, 0, 0)
  treasureModel.object3D.scale.set(1, 1, 1)
  treasureModel.object3D.updateMatrixWorld(true)

  const box = new three.Box3().setFromObject(mesh)
  const localCenter = box.getCenter(new three.Vector3()).applyMatrix4(
    new three.Matrix4().copy(spin.matrixWorld).invert(),
  )
  treasureModel.object3D.position.copy(localCenter).multiplyScalar(-1)
  treasureModel.object3D.updateMatrixWorld(true)

  const fitted = new three.Box3().setFromObject(mesh)
  const corners = [
    [fitted.min.x, fitted.min.y, fitted.min.z],
    [fitted.min.x, fitted.min.y, fitted.max.z],
    [fitted.min.x, fitted.max.y, fitted.min.z],
    [fitted.min.x, fitted.max.y, fitted.max.z],
    [fitted.max.x, fitted.min.y, fitted.min.z],
    [fitted.max.x, fitted.min.y, fitted.max.z],
    [fitted.max.x, fitted.max.y, fitted.min.z],
    [fitted.max.x, fitted.max.y, fitted.max.z],
  ]
  let maxAbs = 0
  for (const [x, y, z] of corners) {
    const projected = new three.Vector3(x, y, z).project(camera)
    maxAbs = Math.max(maxAbs, Math.abs(projected.x), Math.abs(projected.y))
  }
  if (maxAbs === 0) return

  const scale = 0.72 / maxAbs
  treasureModel.setAttribute('scale', `${scale} ${scale} ${scale}`)
  treasureModel.setAttribute(
    'position',
    `${-localCenter.x * scale} ${-localCenter.y * scale} ${-localCenter.z * scale}`,
  )
}

function playActiveVideo() {
  if (!active || active.kind !== 'video') return
  const startDraw = () => {
    if (!active || active.kind !== 'video') return
    if (!treasureVideo.classList.contains('keying')) return
    cancelAnimationFrame(keyFrame)
    drawKey()
  }
  const start = () => {
    if (!active || active.kind !== 'video') return
    treasureVideo.play().then(startDraw).catch(() => {})
  }
  if (treasureVideo.readyState >= 2) start()
  else treasureVideo.addEventListener('loadeddata', start, { once: true })
}

function openPanel() {
  clearTimeout(helpTimer)
  document.body.classList.remove('show-help')
  document.body.classList.add('target-found')
  viewer.resize()
  fitTreasureModel()
  requestAnimationFrame(fitTreasureModel)
  if (active.kind === 'video') requestAnimationFrame(playActiveVideo)
  render()
  playVoice()
}

function keyOutBlack(data, w, h) {
  const count = w * h
  if (!keyContent || keyContent.length !== count) {
    keyContent = new Uint8Array(count)
    keySeen = new Uint8Array(count)
    keyStack = new Int32Array(count)
  } else {
    keySeen.fill(0)
  }
  const thresh = 42
  for (let p = 0, i = 0; p < count; p++, i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const max = r > g ? (r > b ? r : b) : (g > b ? g : b)
    keyContent[p] = max <= thresh ? 1 : 0
  }
  let top = 0
  const push = (p) => {
    if (keyContent[p] && !keySeen[p]) {
      keySeen[p] = 1
      keyStack[top++] = p
    }
  }
  for (let x = 0; x < w; x++) {
    push(x)
    push((h - 1) * w + x)
  }
  for (let y = 0; y < h; y++) {
    push(y * w)
    push(y * w + w - 1)
  }
  while (top) {
    const p = keyStack[--top]
    const x = p % w
    if (x > 0) push(p - 1)
    if (x + 1 < w) push(p + 1)
    if (p >= w) push(p - w)
    if (p + w < count) push(p + w)
  }
  for (let p = 0, i = 0; p < count; p++, i += 4) {
    if (!keySeen[p]) continue
    const x = p % w
    const y = (p / w) | 0
    const edge = (x > 0 && !keySeen[p - 1])
      || (x + 1 < w && !keySeen[p + 1])
      || (y > 0 && !keySeen[p - w])
      || (y + 1 < h && !keySeen[p + w])
    if (!edge) data[i + 3] = 0
  }
}

function drawKey() {
  if (!treasureVideo.classList.contains('keying')) return
  const w = treasureVideo.videoWidth
  const h = treasureVideo.videoHeight
  if (w && h) {
    const long = w > h ? w : h
    const scale = long > 480 ? 480 / long : 1
    const cw = Math.max(1, Math.round(w * scale))
    const ch = Math.max(1, Math.round(h * scale))
    if (treasureKey.width !== cw) treasureKey.width = cw
    if (treasureKey.height !== ch) treasureKey.height = ch
    keyCtx.drawImage(treasureVideo, 0, 0, cw, ch)
    const image = keyCtx.getImageData(0, 0, cw, ch)
    const data = image.data
    if (treasureVideo.dataset.key === 'green') {
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        const green = g - Math.max(r, b)
        if (green > 28 && g > 80) data[i + 3] = 0
      }
    } else {
      keyOutBlack(data, cw, ch)
    }
    keyCtx.putImageData(image, 0, 0)
  }
  keyFrame = requestAnimationFrame(drawKey)
}

function onTarget(index) {
  const treasure = treasures.find((item) => item.targetIndex === index)
  if (!treasure) return
  clearTimeout(lostTimer)
  lostTimer = null
  if (playingIndex === index) return
  const stillPlaying = active
    && active.id === treasure.id
    && treasure.kind === 'video'
    && !treasureVideo.paused
    && !treasureVideo.ended
  playingIndex = index
  if (stillPlaying) {
    document.body.classList.add('target-found')
    playVoice()
    return
  }
  document.body.classList.add('target-found')
  showTreasure(treasure)
  openPanel()
}

function onTargetLost(index) {
  if (playingIndex !== index) return
  clearTimeout(lostTimer)
  lostTimer = setTimeout(() => {
    if (playingIndex !== index) return
    playingIndex = null
    stopVoice()
  }, 400)
}

async function downloadTarget(onProgress) {
  const response = await fetch('./targets/targets.mind')
  if (!response.ok) throw new Error('Target file missing')

  const total = Number(response.headers.get('content-length'))
  if (!response.body || !total) {
    await response.arrayBuffer()
    onProgress(1)
    return
  }

  const reader = response.body.getReader()
  let received = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    received += value.length
    onProgress(received / total)
  }
}

async function beginTrail() {
  startButton.disabled = true
  document.body.classList.add('preparing-on')
  preparing.textContent = 'Preparing the trail…'

  try {
    if ('serviceWorker' in navigator) {
      await navigator.serviceWorker.ready
    }

    await downloadTarget((fraction) => {
      const percent = Math.round(fraction * 100)
      preparing.textContent = `Preparing the trail… ${percent}%`
    })

    document.body.classList.add('camera-on')
    await new Promise((resolve) => requestAnimationFrame(resolve))
    cameraScene.systems['mindar-image-system'].start()
  } catch (error) {
    document.body.classList.remove('preparing-on')
    document.body.classList.remove('camera-on')
    startButton.disabled = false
    status.textContent = 'The trail files could not download. Try again.'
  }
}

startButton.addEventListener('click', () => {
  unlockAudio()
  beginTrail()
})

cameraScene.addEventListener('arReady', () => {
  document.body.classList.remove('preparing-on')
  scheduleHelp()
})

cameraScene.addEventListener('arError', () => {
  document.body.classList.remove('preparing-on')
  document.body.classList.remove('camera-on')
  startButton.disabled = false
  status.textContent = 'The camera could not start. Allow the camera and try again.'
})

treasures.forEach((treasure) => {
  const entity = document.querySelector(`#target-${treasure.targetIndex}`)
  entity.addEventListener('targetFound', () => onTarget(treasure.targetIndex))
  entity.addEventListener('targetLost', () => onTargetLost(treasure.targetIndex))
})

collectButton.addEventListener('click', () => {
  collectTreasure(active.id)
  render()
})

resetButton.addEventListener('click', () => {
  resetProgress()
  render()
})

closeButton.addEventListener('click', () => {
  document.body.classList.remove('target-found')
  stopVoice()
  treasureVideo.pause()
  cancelAnimationFrame(keyFrame)
  scheduleHelp()
})

keepTryingButton.addEventListener('click', () => {
  document.body.classList.remove('show-help')
  scheduleHelp()
})

viewTreasureButton.addEventListener('click', () => {
  const progress = loadProgress()
  const next = treasures.find((item) => !progress[item.id]) || treasures[0]
  document.body.classList.add('target-found')
  showTreasure(next)
  openPanel()
})

completeReset.addEventListener('click', () => {
  resetProgress()
  render()
})

treasureModel.addEventListener('model-loaded', () => {
  requestAnimationFrame(fitTreasureModel)
})

showTreasure(treasures[0])

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
}
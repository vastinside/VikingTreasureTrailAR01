import './styles.css'
import { treasures } from './config/treasures.js'
import { loadProgress, collectTreasure, resetProgress } from './game/progress.js'
import {
  cancelPlayback,
  clipFinished,
  clipSourceReady,
  createPlayback,
  finishPlayback,
  scanMarker,
} from './game/playback.js'

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
const helpResetButton = document.querySelector('#help-reset')
const confirmReset = document.querySelector('#confirm-reset')
const confirmYes = document.querySelector('#confirm-yes')
const confirmNo = document.querySelector('#confirm-no')
const preparing = document.querySelector('#preparing')
const status = document.querySelector('#status')
const treasureModel = document.querySelector('#treasure-model')
const modelSpin = document.querySelector('#model-spin')
const spark = document.querySelector('#spark')
const turnHint = document.querySelector('#turn-hint')
const sparkCtx = spark.getContext('2d')
const treasureImage = document.querySelector('#treasure-image')
const treasureVideo = document.querySelector('#treasure-video')
const treasureKey = document.querySelector('#treasure-key')
const keyCtx = treasureKey.getContext('2d', { willReadFrequently: true })
const keyBuffer = document.createElement('canvas')
const keyBufferCtx = keyBuffer.getContext('2d', { willReadFrequently: true })
keyBuffer.className = 'key-buffer'
keyBuffer.setAttribute('aria-hidden', 'true')
document.body.appendChild(keyBuffer)
let keyFrame = 0
let videoToken = 0
let keyContent = null
let keySeen = null
let keyStack = null
let cropBox = null
let drawingVideo = false
let videoRetryAt = 0
let videoUnlock = 0
let playback = createPlayback()
let playToken = 0
let markVideoDone = () => {}
const completeList = document.querySelector('#complete-list')
const completeReset = document.querySelector('#complete-reset')

const HELP_AFTER_MS = 8000
// How much of the viewer a 3D model fills when it appears (1 = touches the edges).
const FRAME_FILL = 0.9
let helpTimer = null
let audioContext = null
let active = null
let hearingTreasure = false
const voice = new Audio()
const jackpotSound = new Audio('./audio/jackpot.mp3')
jackpotSound.muted = true
const endingMusic = new Audio('./audio/ending.mp3')
endingMusic.muted = true
const jackpotEl = document.querySelector('#jackpot')
const completeTotal = document.querySelector('#complete-total')
const scored = treasures.filter((item) => item.collectible !== false)
let jackpotTimer = null
let shownFound = -1
let awaitingModel = false
let wantsReveal = false
let revealFrame = 0
let revealToken = 0
let sparkFrame = 0
let dragging = false
let lastDragX = 0
let modelZoom = 1
let modelPanX = 0
let modelPanY = 0
let fittedScale = 1
let fittedCenter = { x: 0, y: 0, z: 0 }
const modelPointers = new Map()
let pinchStart = 0
let pinchZoomStart = 1
let panOrigin = null
const motionOk = !window.matchMedia('(prefers-reduced-motion: reduce)').matches

function hideHeadsetButtons() {
  document.querySelectorAll('.a-enter-vr, .a-enter-ar').forEach((button) => button.remove())
}

hideHeadsetButtons()
cameraScene.addEventListener('loaded', hideHeadsetButtons)
viewer.addEventListener('loaded', hideHeadsetButtons)

function playFindEffect() {
  document.body.classList.remove('treasure-arrive')
  void document.body.offsetWidth
  document.body.classList.add('treasure-arrive')
}

function scoredFound(progress) {
  return scored.filter((item) => progress[item.id]).length
}

function render() {
  const progress = loadProgress()
  const found = scoredFound(progress)
  const total = scored.length
  progressLabel.textContent = `${found} of ${total} treasures found`
  panelCount.textContent = `${found} of ${total} found`
  completeTotal.textContent = `Total coins collected: ${found}`

  if (shownFound >= 0 && found > shownFound) {
    panelCount.classList.remove('score-pop')
    void panelCount.offsetWidth
    panelCount.classList.add('score-pop')
  }
  shownFound = found

  const complete = found === total && total > 0
  document.body.classList.toggle('trail-complete', complete)
  if (complete) jackpotEl.hidden = true

  completeList.replaceChildren()
  scored.forEach((item) => {
    const line = document.createElement('p')
    line.className = progress[item.id] ? 'found' : ''
    line.textContent = `${progress[item.id] ? '✓' : '○'} ${item.name}`
    completeList.appendChild(line)
  })

  treasureName.textContent = active.name
  treasureFact.textContent = active.fact

  if (!active || active.collectible === false) {
    collectButton.hidden = true
    return
  }
  collectButton.hidden = false
  const collected = Boolean(progress[active.id])
  collectButton.classList.toggle('is-collected', collected)
  collectButton.disabled = collected
  collectButton.setAttribute('aria-label', collected ? 'Collected' : 'Collect treasure')
}

function hideJackpot() {
  clearTimeout(jackpotTimer)
  jackpotEl.hidden = true
  jackpotSound.muted = true
  jackpotSound.pause()
  jackpotSound.currentTime = 0
}

function showJackpot() {
  if (document.body.classList.contains('trail-complete')) return
  jackpotEl.hidden = false
  if (!voice.paused) voice.volume = 0.2
  jackpotSound.muted = false
  jackpotSound.volume = 1
  jackpotSound.currentTime = 0
  jackpotSound.play().catch(() => {})
  jackpotSound.onended = () => {
    voice.volume = 1
  }
  clearTimeout(jackpotTimer)
  jackpotTimer = setTimeout(() => {
    jackpotEl.hidden = true
    voice.volume = 1
  }, 5000)
}

function playEnding() {
  stopVoice()
  hideJackpot()
  endingMusic.muted = false
  endingMusic.volume = 1
  endingMusic.currentTime = 0
  endingMusic.play().catch(() => {})
}

function awardFind(treasure) {
  if (!treasure || treasure.collectible === false) return
  if (loadProgress()[treasure.id]) return
  collectTreasure(treasure.id)
  const finished = scoredFound(loadProgress()) === scored.length
  render()
  if (finished) playEnding()
  else showJackpot()
}

function stopRewards() {
  hideJackpot()
  endingMusic.pause()
  endingMusic.currentTime = 0
}

function showTreasure(treasure) {
  const previous = active
  active = treasure
  const kind = treasure.kind || 'model'
  const playsWebm = treasureVideo.canPlayType('video/webm; codecs="vp9"') !== ''

  viewer.hidden = kind !== 'model'
  turnHint.hidden = kind !== 'model'
  treasureImage.hidden = kind !== 'image'
  treasureVideo.hidden = kind !== 'video'
  treasureKey.hidden = true
  treasureVideo.classList.remove('keying')
  treasureVideo.pause()
  cancelAnimationFrame(keyFrame)

  if (kind === 'model' && (!previous || previous.model !== treasure.model) && treasure.model) {
    awaitingModel = true
    modelZoom = 1
    modelPanX = 0
    modelPanY = 0
    treasureModel.setAttribute('rotation', treasure.rotation || '0 0 0')
    treasureModel.setAttribute('gltf-model', treasure.model)
  } else if (kind === 'model') {
    awaitingModel = false
  }
  if (kind === 'image') {
    treasureImage.src = treasure.image
    treasureImage.alt = treasure.name
  }
  if (kind === 'video') {
    videoToken += 1
    cropBox = null
    drawingVideo = false
    cancelAnimationFrame(keyFrame)
    keyCtx.clearRect(0, 0, treasureKey.width, treasureKey.height)
    treasureKey.hidden = true
    const nextSrc = treasure.video || treasure.videoMp4 || ''
    const currentFile = (treasureVideo.currentSrc || treasureVideo.src || '').split('?')[0].split('/').pop()
    const nextFile = nextSrc.split('?')[0].split('/').pop()
    const alreadyLoaded = currentFile && currentFile === nextFile
    if (!alreadyLoaded) {
      treasureVideo.innerHTML = ''
      treasureVideo.removeAttribute('src')
    }
    treasureVideo.muted = true
    treasureVideo.playsInline = true
    treasureVideo.setAttribute('playsinline', '')
    treasureVideo.setAttribute('webkit-playsinline', '')
    treasureVideo.loop = Boolean(treasure.voice)
    if (treasure.voice) treasureVideo.setAttribute('loop', '')
    else treasureVideo.removeAttribute('loop')
    treasureVideo.classList.add('keying')
    if (treasure.video) {
      treasureVideo.dataset.key = 'black'
      if (!alreadyLoaded) treasureVideo.src = treasure.video
    } else if (treasure.videoMp4) {
      treasureVideo.dataset.key = 'green'
      if (!alreadyLoaded) treasureVideo.src = treasure.videoMp4
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
  jackpotSound.muted = true
  jackpotSound.volume = 0
  jackpotSound.play().catch(() => {})
  jackpotSound.pause()
  jackpotSound.currentTime = 0
  endingMusic.muted = true
  endingMusic.volume = 0
  endingMusic.play().catch(() => {})
  endingMusic.pause()
  endingMusic.currentTime = 0
  voice.muted = true
  voice.volume = 0
  voice.src = primer.voice
  const voicePlay = voice.play()
  voice.pause()
  voice.currentTime = 0
  if (voicePlay && voicePlay.then) {
    voicePlay.then(() => {
      if (hearingTreasure) return
      voice.pause()
      voice.currentTime = 0
    }).catch(() => {})
  }
  const unlock = ++videoUnlock
  treasureVideo.muted = true
  treasureVideo.playsInline = true
  treasureVideo.setAttribute('playsinline', '')
  treasureVideo.setAttribute('webkit-playsinline', '')
  const videoPlay = treasureVideo.play()
  if (videoPlay && videoPlay.then) {
    videoPlay.then(() => {
      if (unlock !== videoUnlock || drawingVideo) return
      treasureVideo.pause()
      try {
        treasureVideo.currentTime = 0
      } catch {
        // The phone may still be opening the file.
      }
    }).catch(() => {})
  }
}

function playVoice() {
  if (document.body.classList.contains('trail-complete')) return
  if (!active || !active.voice) {
    stopVoice()
    return
  }
  hearingTreasure = true
  voice.muted = false
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

function beginClip(treasure) {
  const token = ++playToken
  let voiceEnded = !treasure.voice
  let videoEnded = treasure.kind !== 'video'
  const tryFinish = () => {
    if (token !== playToken) return
    if (!clipFinished({
      hasVoice: Boolean(treasure.voice),
      voiceEnded,
      hasVideo: treasure.kind === 'video',
      videoEnded,
    })) return
    const result = finishPlayback(playback, treasure.targetIndex, Date.now())
    playback = result.state
    if (result.action === 'finish') awardFind(treasure)
  }
  markVideoDone = () => {
    if (token !== playToken) return
    videoEnded = true
    tryFinish()
  }
  const stopPicture = () => {
    if (treasure.kind !== 'video') return
    drawingVideo = false
    treasureVideo.loop = false
    treasureVideo.removeAttribute('loop')
    treasureVideo.pause()
    cancelAnimationFrame(keyFrame)
    videoEnded = true
  }
  if (treasure.voice) {
    const onVoice = () => {
      if (token !== playToken) return
      voice.removeEventListener('ended', onVoice)
      voice.removeEventListener('error', onVoice)
      voiceEnded = true
      stopPicture()
      tryFinish()
    }
    voice.addEventListener('ended', onVoice)
    voice.addEventListener('error', onVoice)
    setTimeout(() => {
      if (token !== playToken) return
      if (voice.paused && voice.currentTime === 0) onVoice()
    }, 1200)
  }
  if (treasure.kind === 'video' && !treasure.voice) {
    const onVideo = () => {
      if (token !== playToken) return
      treasureVideo.removeEventListener('ended', onVideo)
      videoEnded = true
      tryFinish()
    }
    treasureVideo.addEventListener('ended', onVideo)
  }
  tryFinish()
}

function stopPlayback() {
  playToken += 1
  markVideoDone = () => {}
  drawingVideo = false
  const index = active ? active.targetIndex : 0
  playback = cancelPlayback(playback, index, Date.now()).state
  stopVoice()
  treasureVideo.pause()
  cancelAnimationFrame(keyFrame)
}

function scheduleHelp() {
  clearTimeout(helpTimer)
  if (!document.body.classList.contains('camera-on')) {
    document.body.classList.remove('show-help')
    return
  }
  helpTimer = setTimeout(() => {
    if (!document.body.classList.contains('camera-on')) return
    if (!document.body.classList.contains('target-found')) {
      document.body.classList.add('show-help')
    }
  }, HELP_AFTER_MS)
}

function fitTreasureModel() {
  const mesh = treasureModel.getObject3D('mesh')
  const camera = viewer.camera
  const canvas = viewer.canvas
  if (!mesh || !camera || !canvas || viewer.hidden) return
  if (canvas.clientWidth < 2 || canvas.clientHeight < 2) {
    requestAnimationFrame(fitTreasureModel)
    return
  }

  const three = window.AFRAME.THREE
  camera.aspect = canvas.clientWidth / canvas.clientHeight
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld(true)
  const spin = treasureModel.object3D.parent
  treasureModel.object3D.position.set(0, 0, 0)
  treasureModel.object3D.scale.set(1, 1, 1)
  treasureModel.object3D.updateMatrixWorld(true)

  // Measure every vertex in the spin's own space, so the fit holds at any angle of the turn.
  const toSpin = new three.Matrix4().copy(spin.matrixWorld).invert()
  const points = []
  const point = new three.Vector3()
  const vertexMatrix = new three.Matrix4()
  mesh.traverse((child) => {
    const position = child.isMesh && child.geometry && child.geometry.attributes.position
    if (!position) return
    vertexMatrix.multiplyMatrices(toSpin, child.matrixWorld)
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i).applyMatrix4(vertexMatrix)
      points.push(point.x, point.y, point.z)
    }
  })
  if (!points.length) return

  const box = new three.Box3()
  for (let i = 0; i < points.length; i += 3) box.expandByPoint(point.set(points[i], points[i + 1], points[i + 2]))
  const localCenter = box.getCenter(new three.Vector3())
  let sweep = 0
  for (let i = 0; i < points.length; i += 3) {
    sweep = Math.max(sweep, Math.hypot(points[i] - localCenter.x, points[i + 2] - localCenter.z))
  }
  const halfHeight = (box.max.y - box.min.y) / 2

  // Largest scale where the turning model stays inside FRAME_FILL of the viewer, with perspective.
  const distance = Math.max(0.4, camera.position.distanceTo(spin.getWorldPosition(new three.Vector3())))
  const tanV = Math.tan((camera.fov * Math.PI) / 360) * FRAME_FILL
  const tanH = Math.tan((camera.fov * Math.PI) / 360) * camera.aspect * FRAME_FILL
  const byHeight = halfHeight + sweep > 0 ? (tanV * distance) / (halfHeight + tanV * sweep) : Infinity
  const byWidth = sweep > 0 ? (tanH * distance) / (sweep * Math.sqrt(1 + tanH * tanH)) : Infinity
  fittedScale = Math.min(byHeight, byWidth)
  if (!Number.isFinite(fittedScale) || fittedScale <= 0) fittedScale = 1
  fittedCenter = { x: localCenter.x, y: localCenter.y, z: localCenter.z }
  revealToken += 1
  cancelAnimationFrame(revealFrame)
  applyModelView()
  if (wantsReveal) {
    wantsReveal = false
    playModelReveal(fittedScale, localCenter.x, localCenter.y, localCenter.z)
  }
}

function applyModelView() {
  const size = fittedScale * modelZoom
  treasureModel.object3D.scale.set(size, size, size)
  treasureModel.object3D.position.set(
    -fittedCenter.x * size + modelPanX,
    -fittedCenter.y * size + modelPanY,
    -fittedCenter.z * size,
  )
}

function pointerSpan() {
  const points = [...modelPointers.values()]
  if (points.length < 2) return 0
  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
}

function pointerMid() {
  const points = [...modelPointers.values()]
  return {
    x: (points[0].x + points[1].x) / 2,
    y: (points[0].y + points[1].y) / 2,
  }
}

function playModelReveal(fullScale, cx, cy, cz) {
  const token = ++revealToken
  cancelAnimationFrame(revealFrame)
  burstStars()
  viewer.classList.remove('chest-open')
  void viewer.offsetWidth
  viewer.classList.add('chest-open')
  if (!motionOk) return

  const place = (size) => {
    if (token !== revealToken) return
    treasureModel.object3D.scale.set(size, size, size)
    treasureModel.object3D.position.set(-cx * size, -cy * size, -cz * size)
  }
  const start = performance.now()
  const dur = 780
  place(fullScale * 0.04)
  const tick = (now) => {
    if (token !== revealToken) return
    const t = Math.min(1, (now - start) / dur)
    const c1 = 1.70158
    const c3 = c1 + 1
    const eased = 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
    place(fullScale * Math.max(0.04, Math.min(1, eased)))
    if (t < 1) revealFrame = requestAnimationFrame(tick)
    else place(fullScale)
  }
  revealFrame = requestAnimationFrame(tick)
}

function burstStars() {
  if (!motionOk) return
  const box = viewer.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const width = Math.max(1, box.width)
  const height = Math.max(1, box.height)
  spark.width = Math.round(width * dpr)
  spark.height = Math.round(height * dpr)
  spark.hidden = false
  const stars = []
  const originX = spark.width / 2
  const originY = spark.height * 0.55
  for (let i = 0; i < 42; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = (50 + Math.random() * 140) * dpr
    stars.push({
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 30 * dpr,
      size: (2.2 + Math.random() * 3.4) * dpr,
      life: 0.65 + Math.random() * 0.35,
      spin: Math.random() * Math.PI,
      gold: Math.random() > 0.3,
    })
  }
  const start = performance.now()
  const dur = 1100
  cancelAnimationFrame(sparkFrame)
  const drawStar = (x, y, radius, rot) => {
    sparkCtx.beginPath()
    for (let point = 0; point < 8; point++) {
      const angle = rot + (point * Math.PI) / 4
      const arm = point % 2 === 0 ? radius : radius * 0.38
      const px = x + Math.cos(angle) * arm
      const py = y + Math.sin(angle) * arm
      if (point === 0) sparkCtx.moveTo(px, py)
      else sparkCtx.lineTo(px, py)
    }
    sparkCtx.closePath()
    sparkCtx.fill()
  }
  const tick = (now) => {
    const t = (now - start) / dur
    const step = 1 / 60
    sparkCtx.clearRect(0, 0, spark.width, spark.height)
    if (t < 0.28) {
      sparkCtx.fillStyle = `rgba(226, 197, 106, ${0.32 * (1 - t / 0.28)})`
      sparkCtx.beginPath()
      sparkCtx.arc(originX, originY, spark.width * 0.16 * (0.35 + t * 3), 0, Math.PI * 2)
      sparkCtx.fill()
    }
    for (const star of stars) {
      const age = t / star.life
      if (age >= 1) continue
      star.x += star.vx * step
      star.y += star.vy * step
      star.vy += 90 * dpr * step
      star.spin += 0.05
      sparkCtx.globalAlpha = 1 - age
      sparkCtx.fillStyle = star.gold ? '#e2c56a' : '#fff6d8'
      drawStar(star.x, star.y, star.size * (1 - age * 0.35), star.spin)
    }
    sparkCtx.globalAlpha = 1
    if (t < 1) sparkFrame = requestAnimationFrame(tick)
    else {
      spark.hidden = true
      sparkCtx.clearRect(0, 0, spark.width, spark.height)
    }
  }
  sparkFrame = requestAnimationFrame(tick)
}

function spinYaw() {
  return (modelSpin.object3D.rotation.y * 180) / Math.PI
}

function pauseSpin() {
  const yaw = spinYaw()
  modelSpin.removeAttribute('animation')
  modelSpin.object3D.rotation.set(0, (yaw * Math.PI) / 180, 0)
}

function resumeSpin() {
  const yaw = spinYaw()
  modelSpin.setAttribute(
    'animation',
    `property: rotation; from: 0 ${yaw} 0; to: 0 ${yaw + 360} 0; loop: true; dur: 6000; easing: linear`,
  )
}

function playActiveVideo() {
  if (!active || active.kind !== 'video') return
  videoUnlock += 1
  const token = videoToken
  const expected = active.video || active.videoMp4 || ''
  const startDraw = () => {
    if (token !== videoToken || !active || active.kind !== 'video') return
    if (!treasureVideo.classList.contains('keying')) return
    if (!clipSourceReady(treasureVideo.currentSrc, expected, treasureVideo.readyState)) return
    drawingVideo = true
    treasureKey.hidden = false
    cancelAnimationFrame(keyFrame)
    drawKey()
  }
  const begin = () => {
    if (token !== videoToken || !active || active.kind !== 'video') return
    treasureVideo.play().then(startDraw).catch(() => {
      if (token !== videoToken) return
      startDraw()
    })
  }
  const start = () => {
    if (token !== videoToken || !active || active.kind !== 'video') return
    if (!clipSourceReady(treasureVideo.currentSrc, expected, treasureVideo.readyState)) {
      treasureVideo.addEventListener('loadeddata', start, { once: true })
      treasureVideo.addEventListener('canplay', start, { once: true })
      return
    }
    if (treasureVideo.currentTime > 0.05) {
      treasureVideo.addEventListener('seeked', begin, { once: true })
      try {
        treasureVideo.currentTime = 0
      } catch {
        begin()
      }
      return
    }
    begin()
  }
  start()
}

function openPanel() {
  clearTimeout(helpTimer)
  document.body.classList.remove('show-help')
  document.body.classList.add('target-found')
  playFindEffect()
  if (active.kind === 'model' && !awaitingModel) wantsReveal = true
  viewer.resize()
  fitTreasureModel()
  requestAnimationFrame(() => {
    viewer.resize()
    fitTreasureModel()
  })
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
  const thresh = 24
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
    if (keySeen[p]) data[i + 3] = 0
  }
}

function contentBounds(data, w, h) {
  let minX = w
  let minY = h
  let maxX = -1
  let maxY = -1
  const step = 2
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      if (data[(y * w + x) * 4 + 3] > 16) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  const pad = 10
  return {
    x: Math.max(0, minX - pad),
    y: Math.max(0, minY - pad),
    r: Math.min(w - 1, maxX + pad + step),
    b: Math.min(h - 1, maxY + pad + step),
  }
}

function drawKey() {
  if (!drawingVideo) return
  if (!treasureVideo.classList.contains('keying')) return
  if (drawingVideo && (treasureVideo.paused || treasureVideo.ended)) {
    const now = performance.now()
    if (now >= videoRetryAt) {
      if (treasureVideo.ended) treasureVideo.currentTime = 0
      videoRetryAt = now + 400
      treasureVideo.play().catch(() => {})
    }
  } else {
    videoRetryAt = 0
  }
  try {
  const expected = active && (active.video || active.videoMp4)
  if (clipSourceReady(treasureVideo.currentSrc, expected, treasureVideo.readyState)) {
    const w = treasureVideo.videoWidth
    const h = treasureVideo.videoHeight
    if (w && h) {
      const long = w > h ? w : h
        const scale = long > 480 ? 480 / long : 1
      const cw = Math.max(1, Math.round(w * scale))
      const ch = Math.max(1, Math.round(h * scale))
      if (keyBuffer.width !== cw) keyBuffer.width = cw
      if (keyBuffer.height !== ch) keyBuffer.height = ch
      keyBufferCtx.drawImage(treasureVideo, 0, 0, cw, ch)
      const image = keyBufferCtx.getImageData(0, 0, cw, ch)
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
      keyBufferCtx.putImageData(image, 0, 0)
      const bounds = contentBounds(data, cw, ch)
      if (bounds) {
        if (!cropBox) cropBox = bounds
        else {
          cropBox.x = Math.min(cropBox.x, bounds.x)
          cropBox.y = Math.min(cropBox.y, bounds.y)
          cropBox.r = Math.max(cropBox.r, bounds.r)
          cropBox.b = Math.max(cropBox.b, bounds.b)
        }
      }
      const box = cropBox || { x: 0, y: 0, r: cw - 1, b: ch - 1 }
      const bw = Math.max(1, box.r - box.x + 1)
      const bh = Math.max(1, box.b - box.y + 1)
      if (treasureKey.width !== bw) treasureKey.width = bw
      if (treasureKey.height !== bh) treasureKey.height = bh
      keyCtx.clearRect(0, 0, bw, bh)
      keyCtx.drawImage(keyBuffer, box.x, box.y, bw, bh, 0, 0, bw, bh)
    }
  }
  } catch {
    // Keep drawing on the next frame if one frame fails.
  }
  if (drawingVideo) keyFrame = requestAnimationFrame(drawKey)
}

function onTarget(index) {
  const treasure = treasures.find((item) => item.targetIndex === index)
  if (!treasure) return
  const result = scanMarker(playback, index, Date.now())
  playback = result.state
  if (result.action !== 'start') return
  document.body.classList.add('target-found')
  showTreasure(treasure)
  beginClip(treasure)
  openPanel()
}

function onTargetLost() {}

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
  awardFind(active)
})

resetButton.addEventListener('click', askReset)

closeButton.addEventListener('click', () => {
  document.body.classList.remove('target-found')
  stopPlayback()
  scheduleHelp()
})

keepTryingButton.addEventListener('click', () => {
  document.body.classList.remove('show-help')
  scheduleHelp()
})

// Ask before a reset, because it throws away every collected coin.
let resetReturnFocus = null

function askReset() {
  resetReturnFocus = document.activeElement
  confirmReset.hidden = false
  confirmNo.focus()
}

function closeResetWarning() {
  confirmReset.hidden = true
  if (resetReturnFocus && document.contains(resetReturnFocus)) resetReturnFocus.focus()
  resetReturnFocus = null
}

helpResetButton.addEventListener('click', askReset)
completeReset.addEventListener('click', askReset)

confirmNo.addEventListener('click', closeResetWarning)

// After a reset, turn the camera off and go back to the start page.
function returnToStart() {
  clearTimeout(helpTimer)
  if (document.body.classList.contains('camera-on')) {
    try {
      cameraScene.systems['mindar-image-system'].stop()
    } catch {
      // The camera may still be starting up.
    }
  }
  document.body.classList.remove('camera-on', 'target-found', 'show-help', 'preparing-on')
  startButton.disabled = false
  status.textContent = 'Ready to look.'
  window.scrollTo(0, 0)
}

confirmYes.addEventListener('click', () => {
  closeResetWarning()
  resetProgress()
  stopPlayback()
  stopRewards()
  render()
  returnToStart()
})

confirmReset.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeResetWarning()
})

treasureModel.addEventListener('model-loaded', () => {
  awaitingModel = false
  wantsReveal = active && active.kind === 'model'
  requestAnimationFrame(fitTreasureModel)
})

viewer.addEventListener('pointerdown', (event) => {
  if (viewer.hidden || !active || active.kind !== 'model') return
  modelPointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  dragging = true
  lastDragX = event.clientX
  viewer.classList.add('turning')
  pauseSpin()
  try {
    viewer.setPointerCapture(event.pointerId)
  } catch {
    // The drag still follows the pointer if capture is unavailable.
  }
  if (modelPointers.size === 2) {
    pinchStart = pointerSpan()
    pinchZoomStart = modelZoom
    const mid = pointerMid()
    panOrigin = { x: modelPanX, y: modelPanY, mx: mid.x, my: mid.y }
  }
})

viewer.addEventListener('pointermove', (event) => {
  if (!modelPointers.has(event.pointerId)) return
  const previous = modelPointers.get(event.pointerId)
  modelPointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  if (modelPointers.size >= 2 && pinchStart > 0) {
    const span = pointerSpan()
    if (pinchStart > 8) {
      modelZoom = Math.min(2.2, Math.max(0.6, pinchZoomStart * (span / pinchStart)))
    }
    if (panOrigin) {
      const mid = pointerMid()
      modelPanX = Math.min(0.7, Math.max(-0.7, panOrigin.x + (mid.x - panOrigin.mx) * 0.004))
      modelPanY = Math.min(0.7, Math.max(-0.7, panOrigin.y - (mid.y - panOrigin.my) * 0.004))
    }
    applyModelView()
    return
  }
  const dx = event.clientX - previous.x
  lastDragX = event.clientX
  modelSpin.object3D.rotation.y += dx * 0.01
})

function endDrag(event) {
  if (!modelPointers.has(event.pointerId) && !dragging) return
  modelPointers.delete(event.pointerId)
  try {
    if (viewer.hasPointerCapture(event.pointerId)) viewer.releasePointerCapture(event.pointerId)
  } catch {
    // Capture was never taken.
  }
  if (modelPointers.size >= 2) return
  pinchStart = 0
  panOrigin = null
  if (modelPointers.size === 1) {
    const remaining = [...modelPointers.values()][0]
    lastDragX = remaining.x
    return
  }
  dragging = false
  viewer.classList.remove('turning')
  resumeSpin()
}

viewer.addEventListener('wheel', (event) => {
  if (viewer.hidden || !active || active.kind !== 'model') return
  event.preventDefault()
  const next = modelZoom * (event.deltaY > 0 ? 0.92 : 1.08)
  modelZoom = Math.min(2.2, Math.max(0.6, next))
  applyModelView()
}, { passive: false })

let refitFrame = 0
function refitOnResize() {
  cancelAnimationFrame(refitFrame)
  refitFrame = requestAnimationFrame(() => {
    if (!document.body.classList.contains('target-found') || !active || active.kind !== 'model') return
    viewer.resize()
    fitTreasureModel()
  })
}

window.addEventListener('resize', refitOnResize)
window.addEventListener('orientationchange', refitOnResize)

viewer.addEventListener('pointerup', endDrag)
viewer.addEventListener('pointercancel', endDrag)

showTreasure(treasures[0])

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
}
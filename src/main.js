import './styles.css'
import { treasures } from './config/treasures.js'
import { loadProgress, collectTreasure, resetProgress } from './game/progress.js'

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
const modelSpin = document.querySelector('#model-spin')
const spark = document.querySelector('#spark')
const turnHint = document.querySelector('#turn-hint')
const sparkCtx = spark.getContext('2d')
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
const jackpotSound = new Audio('./audio/jackpot.mp3')
const endingMusic = new Audio('./audio/ending.mp3')
const jackpotEl = document.querySelector('#jackpot')
const completeTotal = document.querySelector('#complete-total')
const scored = treasures.filter((item) => item.collectible !== false)
let jackpotTimer = null
let shownFound = -1
let awaitingModel = false
let wantsReveal = false
let revealFrame = 0
let sparkFrame = 0
let dragging = false
let lastDragX = 0
const motionOk = !window.matchMedia('(prefers-reduced-motion: reduce)').matches

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
  if (progress[active.id]) {
    collectButton.textContent = 'Collected'
    collectButton.disabled = true
  } else {
    collectButton.textContent = 'Collect treasure'
    collectButton.disabled = false
  }
}

let rewardFinish = null

function hideJackpot() {
  clearTimeout(jackpotTimer)
  jackpotEl.hidden = true
  jackpotSound.pause()
  jackpotSound.currentTime = 0
}

function showJackpot() {
  if (document.body.classList.contains('trail-complete')) return
  jackpotEl.hidden = false
  if (!voice.paused) voice.volume = 0.2
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
  if (!finished) {
    showJackpot()
    return
  }
  rewardFor = treasure.id
  rewardFinish = () => {
    if (rewardFor !== treasure.id) return
    rewardFor = null
    rewardFinish = null
    playEnding()
  }
  if (!treasure.voice) {
    rewardFinish()
    return
  }
  const onDone = () => {
    voice.removeEventListener('ended', onDone)
    voice.removeEventListener('error', onDone)
    if (rewardFinish) rewardFinish()
  }
  voice.addEventListener('ended', onDone)
  voice.addEventListener('error', onDone)
  setTimeout(() => {
    if (voice.paused && voice.currentTime === 0 && rewardFinish) rewardFinish()
  }, 1200)
}

function stopRewards() {
  rewardFor = null
  rewardFinish = null
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
  jackpotSound.volume = 0
  jackpotSound.play().then(() => {
    jackpotSound.pause()
    jackpotSound.currentTime = 0
    jackpotSound.volume = 1
  }).catch(() => {})
  endingMusic.volume = 0
  endingMusic.play().then(() => {
    endingMusic.pause()
    endingMusic.currentTime = 0
    endingMusic.volume = 1
  }).catch(() => {})
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
  if (rewardFinish) rewardFinish()
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
  if (!mesh || !camera || !canvas || viewer.hidden) return
  if (canvas.clientWidth < 2 || canvas.clientHeight < 2) {
    requestAnimationFrame(fitTreasureModel)
    return
  }

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
  if (wantsReveal) {
    wantsReveal = false
    playModelReveal(scale, localCenter.x, localCenter.y, localCenter.z)
  }
}

function playModelReveal(fullScale, cx, cy, cz) {
  cancelAnimationFrame(revealFrame)
  burstStars()
  viewer.classList.remove('chest-open')
  void viewer.offsetWidth
  viewer.classList.add('chest-open')
  if (!motionOk) return

  const place = (size) => {
    treasureModel.object3D.scale.set(size, size, size)
    treasureModel.object3D.position.set(-cx * size, -cy * size, -cz * size)
  }
  const start = performance.now()
  const dur = 780
  place(fullScale * 0.04)
  const tick = (now) => {
    const t = Math.min(1, (now - start) / dur)
    const c1 = 1.70158
    const c3 = c1 + 1
    const eased = 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
    place(fullScale * Math.max(0.04, eased))
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
  playFindEffect()
  if (active.kind === 'model' && !awaitingModel) wantsReveal = true
  viewer.resize()
  fitTreasureModel()
  requestAnimationFrame(fitTreasureModel)
  if (active.kind === 'video') requestAnimationFrame(playActiveVideo)
  render()
  playVoice()
}

function isLightLeak(r, g, b) {
  const max = r > g ? (r > b ? r : b) : (g > b ? g : b)
  const min = r < g ? (r < b ? r : b) : (g < b ? g : b)
  if (max < 78 && max - min < 26) return true
  if (max >= 155) return false
  const cyan = g > 40 && b > 40 && Math.abs(g - b) < 40 && r + 12 < g && r + 12 < b
  const red = r > 32 && r < 130 && g < 55 && b < 55 && r > g + 12 && r > b + 12
  return cyan || red
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
    if (keySeen[p]) data[i + 3] = 0
  }

  top = 0
  for (let p = 0; p < count; p++) {
    if (data[p * 4 + 3] === 0) keyStack[top++] = p
  }
  const clearLeak = (n) => {
    const i = n * 4
    if (data[i + 3] === 0) return
    if (!isLightLeak(data[i], data[i + 1], data[i + 2])) return
    data[i + 3] = 0
    keyStack[top++] = n
  }
  while (top) {
    const p = keyStack[--top]
    const x = p % w
    if (x > 0) clearLeak(p - 1)
    if (x + 1 < w) clearLeak(p + 1)
    if (p >= w) clearLeak(p - w)
    if (p + w < count) clearLeak(p + w)
  }

  for (let p = 0, i = 0; p < count; p++, i += 4) {
    if (data[i + 3] === 0) continue
    const x = p % w
    const y = (p / w) | 0
    const open = (x > 0 && data[(p - 1) * 4 + 3] === 0)
      || (x + 1 < w && data[(p + 1) * 4 + 3] === 0)
      || (y > 0 && data[(p - w) * 4 + 3] === 0)
      || (y + 1 < h && data[(p + w) * 4 + 3] === 0)
    if (!open) continue
    const max = Math.max(data[i], data[i + 1], data[i + 2])
    if (max >= 72) continue
    data[i + 3] = Math.round(((max - 28) / 44) * 255)
    if (data[i + 3] < 0) data[i + 3] = 0
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
  awardFind(treasure)
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
  awardFind(active)
})

resetButton.addEventListener('click', () => {
  resetProgress()
  stopRewards()
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
  const next = scored.find((item) => !progress[item.id]) || scored[0]
  document.body.classList.add('target-found')
  showTreasure(next)
  openPanel()
})

completeReset.addEventListener('click', () => {
  resetProgress()
  stopRewards()
  render()
})

treasureModel.addEventListener('model-loaded', () => {
  awaitingModel = false
  wantsReveal = active && active.kind === 'model'
  requestAnimationFrame(fitTreasureModel)
})

viewer.addEventListener('pointerdown', (event) => {
  if (viewer.hidden || !active || active.kind !== 'model') return
  dragging = true
  lastDragX = event.clientX
  viewer.classList.add('turning')
  pauseSpin()
  try {
    viewer.setPointerCapture(event.pointerId)
  } catch {
    // The drag still follows the pointer if capture is unavailable.
  }
})

viewer.addEventListener('pointermove', (event) => {
  if (!dragging) return
  const dx = event.clientX - lastDragX
  lastDragX = event.clientX
  modelSpin.object3D.rotation.y += dx * 0.01
})

function endDrag(event) {
  if (!dragging) return
  dragging = false
  viewer.classList.remove('turning')
  try {
    if (viewer.hasPointerCapture(event.pointerId)) viewer.releasePointerCapture(event.pointerId)
  } catch {
    // Capture was never taken.
  }
  resumeSpin()
}

viewer.addEventListener('pointerup', endDrag)
viewer.addEventListener('pointercancel', endDrag)

showTreasure(treasures[0])

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
}
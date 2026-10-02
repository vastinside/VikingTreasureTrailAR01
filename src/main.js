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
const completeList = document.querySelector('#complete-list')
const completeReset = document.querySelector('#complete-reset')

const HELP_AFTER_MS = 8000
let helpTimer = null
let audioContext = null
let active = null
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
  const modelChanged = !active || active.model !== treasure.model
  active = treasure
  if (modelChanged) treasureModel.setAttribute('gltf-model', treasure.model)
  render()
}

function unlockAudio() {
  if (!audioContext) audioContext = new AudioContext()
  audioContext.resume()
  const primer = treasures.find((item) => item.voice)
  if (!primer) return
  voice.src = primer.voice
  voice.play().then(() => {
    voice.pause()
    voice.currentTime = 0
  }).catch(() => {})
}

function playVoice() {
    if (document.body.classList.contains('trail-complete')) return
  if (!active.voice) {
    stopVoice()
    return
  }
  voice.src = active.voice
  voice.currentTime = 0
  voice.play().catch(() => {})
}

function stopVoice() {
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

function openPanel() {
  clearTimeout(helpTimer)
  document.body.classList.remove('show-help')
  document.body.classList.add('target-found')
  viewer.resize()
  render()
  playVoice()
}

function onTarget(index) {
  const treasure = treasures.find((item) => item.targetIndex === index)
  if (!treasure) return
  showTreasure(treasure)
  openPanel()
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
  scheduleHelp()
})

keepTryingButton.addEventListener('click', () => {
  document.body.classList.remove('show-help')
  scheduleHelp()
})

viewTreasureButton.addEventListener('click', () => {
  const progress = loadProgress()
  const next = treasures.find((item) => !progress[item.id]) || treasures[0]
  showTreasure(next)
  openPanel()
})

completeReset.addEventListener('click', () => {
  resetProgress()
  render()
})

showTreasure(treasures[0])

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
}
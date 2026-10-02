import './styles.css'
import { treasures } from './config/treasures.js'
import { loadProgress, collectTreasure, resetProgress, countFound } from './game/progress.js'

const axe = treasures[0]
const progressLabel = document.querySelector('#progress')
const panelCount = document.querySelector('#panel-count')
const collectButton = document.querySelector('#collect')
const resetButton = document.querySelector('#reset-trail')
const startButton = document.querySelector('#start-camera')
const cameraScene = document.querySelector('#camera-scene')
const cardTarget = document.querySelector('#card-target')
const viewer = document.querySelector('#viewer')
const treasureName = document.querySelector('#treasure-name')
const treasureFact = document.querySelector('#treasure-fact')
const closeButton = document.querySelector('#close-panel')
const keepTryingButton = document.querySelector('#keep-trying')
const viewTreasureButton = document.querySelector('#view-treasure')
const preparing = document.querySelector('#preparing')
const status = document.querySelector('#status')

const HELP_AFTER_MS = 8000
let helpTimer = null
let audioContext = null

function render() {
  const progress = loadProgress()
  const found = countFound(progress)
  progressLabel.textContent = `${found} / 5 Treasures Found`
  panelCount.textContent = `${found} / 5`

  treasureName.textContent = axe.name
  treasureFact.textContent = axe.fact

  if (progress[axe.id]) {
    collectButton.textContent = 'Collected'
    collectButton.disabled = true
  } else {
    collectButton.textContent = 'Collect treasure'
    collectButton.disabled = false
  }
}

function unlockAudio() {
  if (!audioContext) audioContext = new AudioContext()
  audioContext.resume()
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

cardTarget.addEventListener('targetFound', () => {
  openPanel()
})

collectButton.addEventListener('click', () => {
  collectTreasure(axe.id)
  render()
})

resetButton.addEventListener('click', () => {
  resetProgress()
  render()
})

closeButton.addEventListener('click', () => {
  document.body.classList.remove('target-found')
  scheduleHelp()
})

keepTryingButton.addEventListener('click', () => {
  document.body.classList.remove('show-help')
  scheduleHelp()
})

viewTreasureButton.addEventListener('click', () => {
  openPanel()
})

render()
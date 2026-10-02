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

const HELP_AFTER_MS = 8000
let helpTimer = null

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

startButton.addEventListener('click', () => {
  document.body.classList.add('camera-on')
  cameraScene.systems['mindar-image-system'].start()
  scheduleHelp()
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
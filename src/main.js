import './styles.css'

const status = document.querySelector('#status')
status.textContent = 'Step 4: start the camera and show the card.'

const startButton = document.querySelector('#start-camera')
const cameraScene = document.querySelector('#camera-scene')
const cardTarget = document.querySelector('#card-target')
const viewer = document.querySelector('#viewer')

startButton.addEventListener('click', () => {
  document.body.classList.add('camera-on')
  cameraScene.systems['mindar-image-system'].start()
})

cardTarget.addEventListener('targetFound', () => {
  document.body.classList.add('target-found')
  viewer.resize()
})
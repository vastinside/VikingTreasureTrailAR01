import './styles.css'

const status = document.querySelector('#status')
status.textContent = 'Step 3: compile the card, then start the camera.'

const startButton = document.querySelector('#start-camera')
const scene = document.querySelector('a-scene')
const cardTarget = document.querySelector('#card-target')

startButton.addEventListener('click', () => {
  document.body.classList.add('camera-on')
  scene.systems['mindar-image-system'].start()
})

cardTarget.addEventListener('targetFound', () => {
  document.body.classList.add('target-found')
})
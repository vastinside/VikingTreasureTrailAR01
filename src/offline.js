// First-visit loading screen. Registers the service worker (src/sw.js),
// shows its download progress, and hides once the whole trail is stored in
// the browser. Later visits skip straight to the trail and run offline.

const loaderFill = document.querySelector('#loader-fill')
const loaderText = document.querySelector('#loader-text')
const loaderRetry = document.querySelector('#loader-retry')

const MAX_AUTO_RETRIES = 3
let retries = 0

function finish() {
  document.documentElement.classList.add('offline-ready')
}

function showProgress(loaded, total) {
  const fraction = total ? Math.min(1, loaded / total) : 0
  const loadedMb = Math.round(loaded / 1048576)
  const totalMb = Math.round(total / 1048576)
  loaderFill.style.transform = `scaleX(${fraction})`
  loaderText.textContent = `Downloading the trail… ${Math.round(fraction * 100)}% (${loadedMb} of ${totalMb} MB)`
}

function showFailure() {
  if (navigator.onLine && retries < MAX_AUTO_RETRIES) {
    retries += 1
    loaderText.textContent = 'The download was interrupted. Carrying on…'
    setTimeout(install, 2000)
    return
  }

  loaderText.textContent = 'The download stopped. Check your internet connection and try again.'
  loaderRetry.hidden = false
}

async function isStored(registration) {
  if (!registration || !registration.active) return false
  return Boolean(await caches.match(new URL('__trail-complete', registration.scope).href))
}

async function install() {
  loaderRetry.hidden = true

  try {
    const registration = await navigator.serviceWorker.register('./sw.js')
    const worker = registration.installing || registration.waiting

    if (!worker) {
      // Already active but not controlling this page (a hard reload), or the
      // stored copy was cleared: run the trail from the network this time.
      finish()
      return
    }

    worker.addEventListener('statechange', () => {
      if (worker.state === 'redundant') showFailure()
    })
  } catch {
    showFailure()
  }
}

// Used by "Reset trail": deletes the stored trail and the service worker,
// then reloads so the loading screen downloads everything again.
// Returns false when offline, because the trail could not be downloaded back.
export async function removeOfflineCopy() {
  if (!navigator.onLine) return false

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((registration) => registration.unregister()))
    }
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
    }
  } catch {
    // Storage may be blocked; reloading still starts the download again.
  }

  location.reload()
  return true
}

export async function prepareOffline() {
  if (!('serviceWorker' in navigator)) {
    finish()
    return
  }

  if (!import.meta.env.PROD) {
    // The dev server has no sw.js; remove any worker left from a build.
    const registrations = await navigator.serviceWorker.getRegistrations()
    registrations.forEach((registration) => registration.unregister())
    finish()
    return
  }

  navigator.serviceWorker.addEventListener('controllerchange', finish, { once: true })

  const registration = await navigator.serviceWorker.getRegistration()
  if (await isStored(registration)) {
    finish()
    // Checks for a new version and stores it in the background.
    navigator.serviceWorker.register('./sw.js').catch(() => {})
    return
  }

  // The head script guessed "stored" from an older worker; it isn't.
  document.documentElement.classList.remove('offline-ready')

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'trail-progress') {
      showProgress(event.data.loaded, event.data.total)
    }
  })

  loaderRetry.addEventListener('click', () => {
    retries = 0
    loaderText.textContent = 'Getting the trail ready…'
    install()
  })

  install()
}

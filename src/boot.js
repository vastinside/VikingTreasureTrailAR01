// Runs before the app: wipes any service worker and Cache Storage left from
// earlier visits so every file is fetched fresh from the server.

async function clearOldCaches() {
  let hadWorker = false

  try {
    if ('serviceWorker' in navigator) {
      hadWorker = Boolean(navigator.serviceWorker.controller)
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((registration) => registration.unregister()))
    }

    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
    }
  } catch {
    // Storage can be blocked (private mode etc.) — just carry on.
  }

  return hadWorker
}

clearOldCaches().then((hadWorker) => {
  // An old worker still controls this page until it reloads, so reload once
  // to get a page with no worker in front of it.
  let reloaded = true
  try {
    reloaded = Boolean(sessionStorage.getItem('caches-cleared'))
    sessionStorage.setItem('caches-cleared', '1')
  } catch {}

  if (hadWorker && !reloaded) {
    location.reload()
    return
  }

  import('./main.js')
})

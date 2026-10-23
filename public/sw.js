// Kill switch: browsers that still have the old caching worker will pick up
// this version, which deletes every cache and unregisters itself.

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
      await self.registration.unregister()
    })()
  )
})

const CACHE = 'havelok-trail-v6'

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
      )
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  const isTrailFile = url.pathname.endsWith('targets.mind') || url.pathname.endsWith('.glb') || url.pathname.endsWith('.mp3')
  if (!isTrailFile) return
  if (event.request.headers.has('range')) return

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      const cached = await cache.match(event.request)
      if (cached) return cached

      const response = await fetch(event.request)
      if (response.status === 200) {
        await cache.put(event.request, response.clone())
      }
      return response
    })()
  )
})
// Service worker template. `vite build` writes it to dist/sw.js with the
// version and file list filled in (see offlineTrail in vite.config.js).
// On install it stores every trail file in the browser; after that every
// request is answered from that copy, so the trail runs without the network.

const VERSION = __TRAIL_VERSION__
const FILES = __TRAIL_FILES__
const CACHE = `trail-offline-${VERSION}`
const COMPLETE_KEY = new URL('__trail-complete', self.registration.scope).href

const filesByPath = new Map(
  FILES.map((file) => [new URL(file.path, self.registration.scope).pathname, file])
)
const indexFile = filesByPath.get(new URL('index.html', self.registration.scope).pathname)

// The hash in the key means an unchanged file is reused on update and a
// changed file is downloaded again.
function cacheKey(file) {
  return `${new URL(file.path, self.registration.scope).href}?v=${file.hash}`
}

let lastReport = 0

async function reportProgress(loaded, total, force = false) {
  const now = Date.now()
  if (!force && now - lastReport < 150) return
  lastReport = now

  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  clients.forEach((client) => client.postMessage({ type: 'trail-progress', loaded, total }))
}

async function download(file, cache, onBytes) {
  const response = await fetch(new URL(file.path, self.registration.scope), { cache: 'no-cache' })
  if (!response.ok) throw new Error(`${file.path} could not download (${response.status})`)

  let body
  if (response.body) {
    const reader = response.body.getReader()
    const chunks = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      onBytes(value.length)
    }
    body = new Blob(chunks)
  } else {
    body = await response.blob()
    onBytes(body.size)
  }

  const headers = { 'Content-Length': String(body.size), 'Accept-Ranges': 'bytes' }
  const type = response.headers.get('Content-Type')
  if (type) headers['Content-Type'] = type

  await cache.put(cacheKey(file), new Response(body, { headers }))
}

async function storeTrail() {
  const cache = await caches.open(CACHE)
  const total = FILES.reduce((sum, file) => sum + file.size, 0)
  let loaded = 0
  const queue = []

  // Skip files already stored by this version (an earlier attempt that was
  // cut off) or by the previous version (unchanged files).
  for (const file of FILES) {
    const key = cacheKey(file)
    if (await cache.match(key)) {
      loaded += file.size
      continue
    }
    const previous = await caches.match(key)
    if (previous) {
      await cache.put(key, previous)
      loaded += file.size
      continue
    }
    queue.push(file)
  }

  reportProgress(loaded, total, true)

  const downloadNext = async () => {
    while (queue.length) {
      await download(queue.shift(), cache, (bytes) => {
        loaded += bytes
        reportProgress(loaded, total)
      })
    }
  }
  await Promise.all([downloadNext(), downloadNext(), downloadNext()])

  await cache.put(COMPLETE_KEY, new Response(VERSION))
  reportProgress(total, total, true)
}

self.addEventListener('install', (event) => {
  event.waitUntil(storeTrail().then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      await self.clients.claim()
    })()
  )
})

// Video and audio ask for byte ranges (Safari always does), so slice the
// stored file to answer them.
async function rangeResponse(response, range) {
  const blob = await response.blob()
  const size = blob.size
  const match = /bytes=(\d*)-(\d*)/.exec(range)
  let start = 0
  let end = size - 1

  if (match && match[1] === '' && match[2] !== '') {
    start = Math.max(0, size - Number(match[2]))
  } else if (match) {
    start = Number(match[1])
    if (match[2] !== '') end = Math.min(Number(match[2]), size - 1)
  }

  if (start >= size || start > end) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
  }

  const headers = {
    'Content-Range': `bytes ${start}-${end}/${size}`,
    'Content-Length': String(end - start + 1),
    'Accept-Ranges': 'bytes',
  }
  const type = response.headers.get('Content-Type')
  if (type) headers['Content-Type'] = type

  return new Response(blob.slice(start, end + 1), { status: 206, headers })
}

async function fromStore(request, file) {
  const cache = await caches.open(CACHE)
  const stored = await cache.match(cacheKey(file))
  if (!stored) return fetch(request)

  const range = request.headers.get('range')
  return range ? rangeResponse(stored, range) : stored
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  let file = filesByPath.get(url.pathname)
  if (!file && request.mode === 'navigate') file = indexFile
  if (!file) return

  event.respondWith(fromStore(request, file))
})

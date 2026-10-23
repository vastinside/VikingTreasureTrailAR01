import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// Files in public/ the trail never uses. They are still deployed, but not
// downloaded into the browser for offline use.
const notStoredOffline = [
  'audio/coin.mp3',
  'audio/sample-voice.mp3',
  'audio/sample-voice1.mp3',
  'images/shield.png',
  'images/sword.png',
  'models/placeholder.glb',
  'videos/LongshipMain.webm',
  'videos/VikingMain.webm',
]

const swTemplate = fileURLToPath(new URL('./src/sw.js', import.meta.url))

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    return entry.isDirectory() ? listFiles(full) : [full]
  })
}

function hash(data) {
  return createHash('sha256').update(data).digest('hex').slice(0, 12)
}

// After the build, writes dist/sw.js with every built file, its size and a
// content hash. Any changed file changes the version, so browsers update.
function offlineTrail() {
  let outDir

  return {
    name: 'offline-trail',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const files = listFiles(outDir)
        .map((full) => relative(outDir, full).split('\\').join('/'))
        .filter((path) => path !== 'sw.js' && !notStoredOffline.includes(path))
        .sort()
        .map((path) => {
          const data = readFileSync(join(outDir, path))
          return { path, size: data.length, hash: hash(data) }
        })

      const version = hash(JSON.stringify(files))
      const worker = readFileSync(swTemplate, 'utf8')
        .replace('__TRAIL_VERSION__', JSON.stringify(version))
        .replace('__TRAIL_FILES__', JSON.stringify(files))
      writeFileSync(join(outDir, 'sw.js'), worker)

      const totalMb = files.reduce((sum, file) => sum + file.size, 0) / 1048576
      console.log(`offline-trail: sw.js stores ${files.length} files (${totalMb.toFixed(1)} MB), version ${version}`)
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [offlineTrail()],
})

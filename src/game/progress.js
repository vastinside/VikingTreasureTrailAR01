const STORAGE_KEY = 'havelok-progress'

export function loadProgress() {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (!saved) return {}

  try {
    return JSON.parse(saved)
  } catch {
    return {}
  }
}

export function collectTreasure(id) {
  const progress = loadProgress()
  progress[id] = true
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  return progress
}

export function resetProgress() {
  localStorage.removeItem(STORAGE_KEY)
}

export function countFound(progress) {
  return Object.values(progress).filter(Boolean).length
}
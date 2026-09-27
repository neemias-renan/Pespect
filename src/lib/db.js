// Local persistence (IndexedDB). Everything stays in this browser — there is no backend.
import { createStore, get, set, del, values, clear } from 'idb-keyval'

const stores = {
  projects: createStore('pespect-projects', 'projects'),
  assets: createStore('pespect-assets', 'assets'),
  roll: createStore('pespect-roll', 'roll'),
  meta: createStore('pespect-meta', 'meta')
}

function table(store) {
  return {
    get: (key) => get(key, store),
    set: (key, value) => set(key, value, store),
    del: (key) => del(key, store),
    all: () => values(store),
    clear: () => clear(store)
  }
}

export const projectsDb = table(stores.projects)
export const assetsDb = table(stores.assets)
export const rollDb = table(stores.roll)
export const metaDb = table(stores.meta)

export async function clearEverything() {
  await Promise.all(Object.values(stores).map((s) => clear(s)))
  try {
    localStorage.removeItem('pespect:settings')
  } catch {
    // storage may be unavailable
  }
}

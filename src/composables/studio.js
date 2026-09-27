// One shared Studio (WebGL context) for the preview stage and the exporter.
import { Studio } from '@/lib/engine/Studio'
import { useLibraryStore } from '@/stores/library'

let studio = null
const listeners = new Set()

export function getStudio() {
  if (!studio) {
    const library = useLibraryStore()
    studio = new Studio({
      getAsset: (id) => library.get(id),
      onInvalidate: () => listeners.forEach((fn) => fn())
    })
  }
  return studio
}

export function onStudioInvalidate(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

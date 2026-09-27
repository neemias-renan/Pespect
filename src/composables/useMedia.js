// Upload + "use this asset" flows shared by the library, the stage drop zone and the top bar.
import { useToast } from 'primevue/usetoast'
import { useLibraryStore } from '@/stores/library'
import { useProjectsStore } from '@/stores/projects'
import { useUiStore } from '@/stores/ui'
import { isVideoMime } from '@/lib/media'

export function useMedia() {
  const toast = useToast()
  const library = useLibraryStore()
  const projects = useProjectsStore()
  const ui = useUiStore()

  function applyAssets(ids, purpose = 'add') {
    const p = projects.current
    if (!p || !ids.length) return
    const assets = ids.map((id) => library.get(id)).filter(Boolean)
    if (!assets.length) return
    ui.click('release', 0.28)
    switch (purpose) {
      case 'backdrop': {
        const img = assets.find((a) => !isVideoMime(a.mime))
        if (!img) {
          toast.add({ severity: 'warn', summary: 'O fundo precisa ser uma imagem', life: 2600 })
          return
        }
        projects.addAssetToProject(img.id)
        p.look.backdrop.type = 'image'
        p.look.backdrop.imageAssetId = img.id
        return
      }
      case 'logo': {
        const img = assets.find((a) => !isVideoMime(a.mime))
        if (!img) {
          toast.add({ severity: 'warn', summary: 'Adicione um logo em PNG ou SVG', life: 2600 })
          return
        }
        projects.addLogoScene(img.id)
        return
      }
      case 'replace': {
        const scene = projects.selectedScene
        const asset = assets[0]
        projects.addAssetToProject(asset.id)
        if (p.mode === 'video' && scene && (scene.type === 'shot' || scene.type === 'logo')) {
          projects.updateScene(scene.id, { assetId: asset.id })
        } else {
          projects.setActiveAsset(asset.id)
        }
        return
      }
      default:
        if (p.mode === 'video') {
          projects.addShotScenes(assets.map((a) => a.id))
        } else {
          projects.setActiveAsset(assets[0].id)
          assets.slice(1).forEach((a) => projects.addAssetToProject(a.id))
        }
    }
  }

  async function intake(files, { purpose = 'add', apply = true } = {}) {
    const list = [...(files || [])]
    if (!list.length) return []
    const { added, rejected, errors } = await library.addFiles(list, { kind: purpose === 'logo' ? 'logo' : undefined })
    if (rejected) {
      toast.add({ severity: 'warn', summary: 'Arquivo não suportado', detail: 'Use PNG, JPG, WEBP, AVIF, GIF, SVG, MP4, MOV ou WEBM.', life: 3500 })
    }
    errors.forEach((e) => toast.add({ severity: 'error', summary: 'Falha no envio', detail: e, life: 4500 }))
    if (added.length) {
      added.forEach((a) => projects.addAssetToProject(a.id))
      if (apply) applyAssets(added.map((a) => a.id), purpose)
      toast.add({ severity: 'success', summary: added.length === 1 ? 'Mídia adicionada' : `${added.length} arquivos adicionados`, life: 1800 })
    }
    return added
  }

  function pickFiles({ purpose = 'add', multiple = true, accept } = {}) {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = multiple
    input.accept = accept || '.png,.jpg,.jpeg,.webp,.avif,.gif,.svg,.mp4,.mov,.webm,image/*,video/mp4,video/quicktime,video/webm'
    input.onchange = () => intake(input.files, { purpose })
    input.click()
  }

  return { applyAssets, intake, pickFiles }
}

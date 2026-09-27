# Pespect

Fotografia de produto para software, direto no navegador. Envie um screenshot ou uma gravação de tela, coloque num mockup 3D (Frame, MacBook, iPhone ou Pro Display XDR), enquadre com a câmera e exporte em PNG ou MP4.

Projeto só de frontend: Vue 3 (JavaScript), PrimeVue 3, PrimeFlex 3 e three.js. Não tem backend: projetos, mídias e capturas ficam salvos no IndexedDB do navegador.

## Como rodar

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # gera a versão de produção em dist/
npm run preview  # serve o build em http://localhost:4173/Pespect/
```

Requer Node 20.19 ou mais recente.

## Publicação no GitHub Pages

O site é publicado em **https://neemias-renan.github.io/Pespect/** pelo workflow [.github/workflows/deploy.yml](.github/workflows/deploy.yml), que roda a cada push na `main` (ou manualmente, em *Actions → Deploy to GitHub Pages → Run workflow*).

Configuração única no repositório: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Detalhes:

- O caminho base do build é `/Pespect/`. O workflow usa o nome do repositório automaticamente; para outro caminho (por exemplo, um domínio próprio), defina `BASE_PATH=/` no build.
- As rotas usam hash (`/#/showcase`, `/#/p/<id>`), então links diretos e recarregar a página funcionam em hospedagem estática.
- Tudo roda no navegador: projetos, mídias e capturas ficam no IndexedDB de quem usa o site.

## Funcionalidades

- **Estúdio 3D**: mockups procedurais (Frame, MacBook com tampa ajustável, iPhone, Pro Display XDR com altura ajustável), acabamento prata ou preto, brilho da tela, reflexos e sombra projetada.
- **Operador**: rotação X/Y/Z (arraste o valor, use as setas ou clique para digitar), AF/MF com clique para focar, abertura (ƒ, profundidade de campo), zoom, lente (24–135mm) e proporção (16:9, 4:3, 1:1, 4:5, 9:16).
- **Palco**: arraste para girar, Shift+arraste para mover, roda do mouse para zoom, duplo clique para resetar e arrastar arquivos para enviar.
- **Frame**: arredondamento, borda (com cor), padding (com cor).
- **Backdrop**: automático (tirado das cores da UI), cor sólida (hex/OKLCH), gradientes, imagem com desfoque ou transparente.
- **Lente**: exposição, aberração cromática, vinheta e grão de filme.
- **Compose**: marque áreas de interesse sobre o screenshot (numeradas, arrastáveis) e clique em Compose. A cena selecionada na timeline é substituída (no mesmo lugar) por uma cena em que a câmera percorre as áreas em ordem, com ângulos diferentes e transições suaves. Sem áreas marcadas, regiões interessantes são escolhidas automaticamente.
- **Posições de câmera**: além de START e END, cada cena aceita posições intermediárias ("Add position"), que podem ser retimadas arrastando os marcadores na timeline. Também dá para dividir a cena no playhead (S).
- **Tema claro e escuro**, com alternância na barra superior (segue o sistema na primeira visita).
- **Modo vídeo**: timeline com cenas de mídia, texto e logo; posições START/END da câmera; 10 presets de movimento com embaralhar; easing; transições (corte, fade, blur, push); reordenar arrastando; redimensionar a duração; copiar, recortar e colar; desfazer e refazer.
- **Cenas de texto**: 10 fontes, peso, tamanho, cor (auto ou personalizada), alinhamento, 8 animações (typewriter, palavras, letras, blur, scale, rise) e ênfase por palavra (marca-texto, sublinhado, círculo).
- **Exportação**: foto em PNG, JPG ou WEBP (1280, 1920 ou 3840px); vídeo MP4 (WebCodecs, renderizado quadro a quadro) em 720p, 1080p ou 4K, a 30 ou 60 FPS, com MediaRecorder como alternativa.
- **Biblioteca**: assets de demonstração, upload (PNG, JPG, WEBP, AVIF, GIF, SVG, MP4, MOV, WEBM), seleção múltipla, colar do clipboard, recortar fotos e cortar/recortar vídeos.
- **Projetos**: vários projetos com miniatura, renomear, duplicar e excluir.
- **Rolo de câmera e Showcase**: todas as capturas ficam salvas; dá para destacar itens com legenda na página `/showcase`.
- **Extras**: atalhos de teclado (`?`), dados de movimento da cena em JSON, sons de interface, modo de desempenho e reset completo.

## Estrutura

```
src/
  lib/engine/     Engine (three.js), dispositivos, pós-processamento, compositor 2D (Studio)
  lib/            timeline, presets de câmera, exportador, mídia, persistência, cores
  stores/         Pinia: projetos (undo/redo), biblioteca, rolo de câmera, UI
  components/     TopBar, StageView, OperatorBar, TimelineBar, painéis e diálogos
  views/          StudioView, ShowcaseView
```

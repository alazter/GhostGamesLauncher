ghost.log('Iniciando Nuvio Media Player & Stremio Addon Plugin v1.0.0...')

const NUVIO_STREMIO_MANIFEST = {
  id: 'com.nuvio.player.addon',
  name: 'Nuvio Media Player & Engine (Addon)',
  version: '1.0.0',
  description:
    'Addon Nuvio Desktop integrado ao Alazterflix & Stremio: motor de vídeo Nuvio com Pause Metadata Overlay, Opening Overlay, Trilho Triplo de Legendas + Auto-Sync, Hold-to-Speed 2x, Volume Boost 200%, Skip Intro/Recap/Outro e Painéis Laterais de Fontes e Episódios.',
  icon: 'https://dl.strem.io/logo-small.png',
  manifestUrl: 'https://nuvio-player.strem.io/manifest.json',
  types: ['movie', 'series', 'anime'],
  resources: ['stream', 'subtitles', 'meta'],
  idPrefixes: ['tt'],
  behaviorHints: {
    configurable: true,
    configurationRequired: false
  },
  catalogs: [],
  isEnabled: true
}

const DEFAULT_NUVIO_SETTINGS = {
  preferredPlayer: 'nuvio',
  pauseOverlayEnabled: true,
  openingOverlayEnabled: true,
  holdToSpeedEnabled: true,
  holdToSpeedValue: 2.0,
  blurUnwatchedEpisodes: false,
  autoPlayNextEpisode: true,
  showRemainingTime: false,
  defaultResizeMode: 'fit',
  volumeBoostMax: 2.0,
  customSubtitleStylingEnabled: true
}

async function initNuvioPlugin() {
  try {
    const existingSettings = await ghost.storage.get('nuvio_settings')
    if (!existingSettings) {
      await ghost.storage.set('nuvio_settings', DEFAULT_NUVIO_SETTINGS)
    }
    const skipSegments = await ghost.storage.get('nuvio_skip_segments')
    if (!skipSegments) {
      await ghost.storage.set('nuvio_skip_segments', {})
    }
    await ghost.storage.set('stremio_manifest', NUVIO_STREMIO_MANIFEST)
    ghost.log('Configurações e manifesto Stremio do Nuvio Player inicializados com sucesso.')
  } catch (err) {
    ghost.warn('Aviso ao inicializar armazenamento do Nuvio Player:', err)
  }
}

void initNuvioPlugin()

// Registra widget de cabeçalho e badge do ecossistema Nuvio
ghost.ui.registerHeaderWidget({
  id: 'nuvio-player-status',
  title: 'Nuvio Media Player Ativo',
  icon: 'play-circle',
  badgeText: 'NUVIO'
})

// Injeta variáveis globais de tema do Nuvio Desktop Player
ghost.ui.injectCSS(`
  :root {
    --nuvio-accent: #f5c518;
    --nuvio-accent-strong: #ffd84d;
    --nuvio-on-accent: #141414;
    --nuvio-surface: rgba(12, 14, 18, 0.88);
    --nuvio-border: rgba(255, 255, 255, 0.14);
  }
`)

ghost.log('Nuvio Media Player & Stremio Addon carregado com 100% de sucesso!')

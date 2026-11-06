ghost.log('Iniciando Plugin Ghost IPTV & Addons (Alazterflix TV) v2.4.6...')

const GHOST_IPTV_STREMIO_MANIFEST = {
  id: 'com.ghost.iptv',
  name: 'Ghost IPTV & Live TV Addon',
  version: '2.4.6',
  description:
    'Canais de TV Ao Vivo, transmissões esportivas e conversor M3U de addons Stremio com grade EPG perpétua e InfoBar translúcido.',
  icon: 'https://dl.strem.io/logo-small.png',
  manifestUrl: 'https://ghost-iptv.strem.io/manifest.json',
  types: ['tv', 'channel'],
  resources: ['stream', 'meta'],
  idPrefixes: ['iptv_', 'tv_'],
  behaviorHints: {
    configurable: true,
    configurationRequired: false
  },
  catalogs: [
    {
      type: 'tv',
      id: 'ghost_iptv_esportes',
      name: 'Esportes Ao Vivo'
    },
    {
      type: 'tv',
      id: 'ghost_iptv_abertos',
      name: 'Canais Abertos'
    }
  ],
  isEnabled: true
}

const DEFAULT_GHOST_IPTV_SETTINGS = {
  hlsBufferLength: 30,
  autoStartLive: true,
  enablePerpetualEpg: true,
  translucentInfoBar: true,
  marqueeScrollSpeed: 'normal',
  showChannelNumbers: true,
  preferredProxyMode: 'dynamic'
}

async function initGhostIptvPlugin() {
  try {
    const existingSettings = await ghost.storage.get('ghost_iptv_settings')
    if (!existingSettings) {
      await ghost.storage.set('ghost_iptv_settings', DEFAULT_GHOST_IPTV_SETTINGS)
    }
    await ghost.storage.set('stremio_manifest_iptv', GHOST_IPTV_STREMIO_MANIFEST)
    ghost.log('Configurações e manifesto do Ghost IPTV inicializados com sucesso.')
  } catch (err) {
    ghost.warn('Aviso ao inicializar armazenamento do Ghost IPTV:', err)
  }
}

void initGhostIptvPlugin()

// Registra widget no header do Ghost
ghost.ui.registerHeaderWidget({
  id: 'ghost-iptv-status',
  title: 'Ghost IPTV Ativo',
  icon: 'tower-broadcast',
  badgeText: 'IPTV'
})

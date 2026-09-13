ghost.log('Inicializando AnkerGames Game Source Provider...')

ghost.registerSourceProvider({
  id: 'com.ghost.ankergames-source',
  name: 'AnkerGames',
  search: async (query) => {
    ghost.log('Buscando jogos por query: ' + query)

    const catalog = [
      {
        id: 'inzoi-ankergames',
        title: 'inZOI',
        providerId: 'com.ghost.ankergames-source',
        providerName: 'AnkerGames',
        size: '18.4 GB',
        description: 'Simulador de vida hiper-realista da Krafton com gráficos Unreal Engine 5.',
        coverUrl: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/2456740/header.jpg'
      },
      {
        id: 'black-myth-wukong-ankergames',
        title: 'Black Myth: Wukong',
        providerId: 'com.ghost.ankergames-source',
        providerName: 'AnkerGames',
        size: '118.2 GB',
        description: 'RPG de ação inspirado na mitologia chinesa e na lenda de Jornada ao Oeste.',
        coverUrl: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/2358720/header.jpg'
      },
      {
        id: 'palworld-ankergames',
        title: 'Palworld',
        providerId: 'com.ghost.ankergames-source',
        providerName: 'AnkerGames',
        size: '16.8 GB',
        description: 'Jogo de sobrevivência em mundo aberto com captura e batalhas de criaturas.',
        coverUrl: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1623730/header.jpg'
      },
      {
        id: 'cyberpunk-2077-ankergames',
        title: 'Cyberpunk 2077: Phantom Liberty',
        providerId: 'com.ghost.ankergames-source',
        providerName: 'AnkerGames',
        size: '72.0 GB',
        description: 'Aventura de ação e RPG em mundo aberto ambientada na megalópole de Night City.',
        coverUrl: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1091500/header.jpg'
      }
    ]

    const clean = query.toLowerCase().trim()
    return catalog.filter((g) => g.title.toLowerCase().includes(clean))
  },

  getSources: async (gameId) => {
    ghost.log('Resolvendo fontes de download para: ' + gameId)

    return [
      {
        id: gameId + '-direct',
        name: 'Download Direto Ultra (Anker CDN)',
        type: 'direct',
        url: 'https://ankergames.net/download/' + gameId,
        size: 'Alta Velocidade (1 Gbps)',
        speed: '120 MB/s'
      },
      {
        id: gameId + '-torbox',
        name: 'TorBox Debrid API (Nuvem / Sem VPN)',
        type: 'torbox',
        url: 'https://api.ankergames.net/torbox/' + gameId,
        size: 'Cache Instantâneo',
        speed: 'Ilimitado'
      },
      {
        id: gameId + '-torrent',
        name: 'Torrent Oficial / P2P Magnet',
        type: 'magnet',
        url: 'magnet:?xt=urn:btih:ghost' + gameId + '&dn=' + encodeURIComponent(gameId),
        seeders: 1420,
        size: 'P2P Descentralizado'
      }
    ]
  }
})

ghost.log('AnkerGames Game Source ativado com sucesso!')

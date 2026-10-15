import type { SpotlightGameItem, StoreShelfItem } from './types/plugins'

export function isNonGameCard(title: string, urlStr?: string): boolean {
  if (!title && !urlStr) return true

  const cleanT = (title || '')
    .replace(/\b(?:free download|download game free|baixar grátis)\b/gi, '')
    .replace(/\s+по\s+сети(?:\b|[^\p{L}\p{N}]|$)/gui, '')
    .replace(/\s+скачать\s+торрент(?:\b|[^\p{L}\p{N}]|$)/gui, '')
    .replace(/\uFFFD/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

  // 1. Padrões de títulos que NÃO são jogos (menus, guias, agregadores, artigos do SteamRIP e outras fontes)
  const BOGUS_TITLES_PATTERN =
    /^(?:top games|recent updates|all games(?:\s+games)?\s+collection|all games collection|how to run games?|how to download(?: & install| and install)?|how to install(?: games)?|request (?:a )?games?|game requests?|all games|games list|pc games|switch games|faq|frequently asked questions|about us|dmca|contact us|privacy policy|terms of (?:use|service)|troubleshooting|common errors?|common problems|fix errors?|steamrip (?:discussion|faq|guides?)|join (?:our )?discord|discord community)\b/i

  if (cleanT && BOGUS_TITLES_PATTERN.test(cleanT)) {
    return true
  }

  // 2. Título idêntico a categorias genéricas de lojas
  const GENERIC_CATEGORY_TITLES =
    /^(?:action|adventure|rpg|strategy|simulation|horror|sports|racing|multiplayer|co-op|anime|casual|vr games|pc games|switch games|early access)$/i
  if (cleanT && GENERIC_CATEGORY_TITLES.test(cleanT)) {
    return true
  }

  // 3. URLs que não apontam para páginas de jogos reais
  if (urlStr) {
    try {
      const parsed = new URL(urlStr, 'https://dummy.test')
      const pathname = parsed.pathname.toLowerCase()
      if (
        /\/(?:top-games|recent-updates|all-games(?:-games)?-collection|all-games|how-to-run-games|request-games|request-a-game|how-to-download|faq|dmca|contact-us|privacy-policy|terms-of-use|terms-of-service|games-list-page)\/?$/i.test(
          pathname
        )
      ) {
        return true
      }
      if (
        /^\/(?:category|tag|author|page|feed|wp-|contact|about|privacy|dmca|faq|search|comments)\b/i.test(
          pathname
        )
      ) {
        return true
      }
    } catch {
      const lower = urlStr.toLowerCase()
      if (
        /\/(?:top-games|recent-updates|all-games(?:-games)?-collection|all-games|how-to-run-games|request-games|how-to-download|faq|dmca|games-list-page)\/?$/i.test(
          lower
        )
      ) {
        return true
      }
    }
  }

  return false
}

export const DEFAULT_HOME_SPOTLIGHT_GAMES: SpotlightGameItem[] = [
  {
    id: 'dune-awakening',
    title: 'Dune: Awakening',
    tags: ['Sobrevivência', '35 GB', 'PC Windows', 'Multiplayer / Co-op', 'GhostShield Saves'],
    backdropUrl: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1172710/library_hero.jpg',
    game: {
      id: 'dune-awakening',
      pageUrl: 'https://ankergames.net/game/dune-awakening',
      providerId: 'com.ghost.ankergames-source',
      providerName: 'AnkerGames',
      title: 'Dune: Awakening',
      version: 'v1.5.3.0',
      size: '35 GB',
      uploadDate: 'Setembro de 2026',
      releaseDate: '2025',
      coverUrl: 'https://ankergames.net/uploads/poster/09-2026/dune-awakening-cover_raKjtI_1789715839.jpg',
      platform: 'windows',
      genre: 'Ação, Sobrevivência, Mundo Aberto',
      cracker: 'OFME / RUNE',
      uploader: 'AnkerGames',
      rating: '5.0/5',
      recommendPercent: '100%',
      developer: 'Funcom',
      publisher: 'Funcom',
      deckCompatibility: 'Compatível (Verificado)',
      controllerSupport: 'Suporte Completo',
      description: 'Dune: Awakening é um épico jogo de sobrevivência em mundo aberto onde você mergulha no lendário universo de Arrakis como agente das Bene Gesserit.'
    }
  },
  {
    id: 'final-fantasy-tactics',
    title: 'FINAL FANTASY TACTICS - The Ivalice Chronicles',
    tags: ['RPG Tático', '9.2 GB', 'PC Windows', 'Singleplayer', 'GhostShield Saves'],
    backdropUrl: 'https://images.alphacoders.com/264/264251.jpg',
    game: {
      id: 'final-fantasy-tactics',
      pageUrl: 'https://ankergames.net/game/final-fantasy-tactics',
      providerId: 'com.ghost.ankergames-source',
      providerName: 'AnkerGames',
      title: 'FINAL FANTASY TACTICS - The Ivalice Chronicles',
      version: 'Build 24304444',
      size: '9.2 GB',
      uploadDate: 'Setembro de 2026',
      releaseDate: '2026',
      coverUrl: 'https://ankergames.net/uploads/poster/09-2026/cover-dXxZu0CPqm.jpg',
      platform: 'windows',
      genre: 'RPG Tático, Estratégia',
      cracker: 'RUNE',
      uploader: 'AnkerGames',
      rating: '5.0/5',
      recommendPercent: '99%',
      developer: 'Square Enix',
      publisher: 'Square Enix',
      deckCompatibility: 'Compatível (Verificado)',
      controllerSupport: 'Suporte Completo',
      description: 'A clássica obra-prima do RPG tático da Square Enix retorna repaginada com combates táticos em grade no reino de Ivalice.'
    }
  },
  {
    id: 'big-walk',
    title: 'Big Walk',
    tags: ['Aventura Co-op', '8.5 GB', 'PC Windows', 'Multiplayer Online', 'GhostShield Saves'],
    backdropUrl: 'https://img.youtube.com/vi/yV0-MclnJ14/maxresdefault.jpg',
    game: {
      id: 'big-walk',
      pageUrl: 'https://online-fix.me/games/adventure/17894-big-walk-po-seti.html',
      providerId: 'com.ghost.online-fix-source',
      providerName: 'Online-Fix',
      title: 'Big Walk',
      version: 'v1.0 (Online Fix)',
      size: '8.5 GB',
      uploadDate: 'Setembro de 2026',
      releaseDate: '2025',
      coverUrl: 'https://img.youtube.com/vi/yV0-MclnJ14/maxresdefault.jpg',
      platform: 'windows',
      genre: 'Aventura Cooperativa, Exploração',
      cracker: 'Online-Fix',
      uploader: 'Online-Fix',
      rating: '4.9/5',
      recommendPercent: '98%',
      developer: 'House House',
      publisher: 'Panic',
      deckCompatibility: 'Jogável',
      controllerSupport: 'Suporte Completo',
      description: 'Embarque em uma expedição cooperativa com seus amigos em um mundo aberto vibrante com comunicação por rádio e quebra-cabeças.'
    }
  },
  {
    id: 'zelda-echoes',
    title: 'The Legend of Zelda: Echoes of Wisdom',
    tags: ['Aventura', '6.1 GB', 'Nintendo Switch', 'NSP / XCI', 'GhostShield Saves'],
    backdropUrl: 'https://images.igdb.com/igdb/image/upload/t_1080p/co8a15.webp',
    game: {
      id: 'zelda-echoes',
      pageUrl: 'https://nxbrew.net/the-legend-of-zelda-echoes-of-wisdom-switch-nsp-xci/',
      providerId: 'com.ghost.nxbrew-source',
      providerName: 'NXBrew',
      title: 'The Legend of Zelda: Echoes of Wisdom',
      version: '1.0.1',
      size: '6.1 GB',
      uploadDate: '26 de Setembro de 2024',
      releaseDate: '26 de Setembro de 2024',
      coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co8a15.webp',
      platform: 'switch',
      genre: 'Ação, Aventura',
      cracker: 'NSP/XCI',
      uploader: 'NXBrew',
      rating: '5.0/5',
      recommendPercent: '100%',
      developer: 'Nintendo',
      publisher: 'Nintendo',
      deckCompatibility: 'Compatível (Ryujinx/Yuzu)',
      controllerSupport: 'Suporte Completo',
      description: 'Salve o reino de Hyrule usando a sabedoria da Princesa Zelda e o Trirod em uma aventura inovadora e cativante.'
    }
  }
]

export const DEFAULT_STORE_HIGHLIGHT_SHELVES: StoreShelfItem[] = [
  {
    id: 'ankergames',
    name: 'AnkerGames Destaques',
    tag: 'Repacks & Updates',
    subtitle: 'Lançamentos para PC Windows com executáveis testados e saves GhostShield',
    theme: 'theme-anker',
    games: [
      {
        id: 'dune-awakening-anker',
        pageUrl: 'https://ankergames.net/game/dune-awakening',
        providerId: 'com.ghost.ankergames-source',
        providerName: 'AnkerGames',
        title: 'Dune: Awakening',
        version: 'v1.5.3',
        size: '35 GB',
        cracker: 'OFME / RUNE',
        platform: 'windows',
        genre: 'Sobrevivência, Mundo Aberto',
        coverUrl: 'https://ankergames.net/uploads/poster/09-2026/dune-awakening-cover_raKjtI_1789715839.jpg',
        description: 'Mergulhe no universo implacável de Arrakis como agente das Bene Gesserit em Unreal Engine 5.'
      },
      {
        id: 'ff-tactics-anker',
        pageUrl: 'https://ankergames.net/game/final-fantasy-tactics',
        providerId: 'com.ghost.ankergames-source',
        providerName: 'AnkerGames',
        title: 'FINAL FANTASY TACTICS - The Ivalice Chronicles',
        version: 'Build 24304444',
        size: '9.2 GB',
        cracker: 'RUNE',
        platform: 'windows',
        genre: 'RPG Tático',
        coverUrl: 'https://ankergames.net/uploads/poster/09-2026/cover-dXxZu0CPqm.jpg',
        description: 'Obra-prima de combate tático em grade com a rica mitologia e intrigas políticas de Ivalice.'
      },
      {
        id: 'blackwood-anker',
        pageUrl: 'https://ankergames.net/game/blackwood',
        providerId: 'com.ghost.ankergames-source',
        providerName: 'AnkerGames',
        title: 'BLACKWOOD',
        version: 'Build 25375198',
        size: '12.3 GB',
        cracker: 'TENOKE',
        platform: 'windows',
        genre: 'Terror de Sobrevivência',
        coverUrl: 'https://ankergames.net/uploads/poster/09-2026/cover-ES5rT0FBgH.jpg',
        description: 'Aventure-se na escuridão misteriosa enfrentando entidades ancestrais nas florestas de Blackwood.'
      },
      {
        id: 'trails-sky-anker',
        pageUrl: 'https://ankergames.net/game/trails-in-the-sky-sc',
        providerId: 'com.ghost.ankergames-source',
        providerName: 'AnkerGames',
        title: 'Trails in the Sky 2nd Chapter',
        version: 'v1.03.1',
        size: '38.9 GB',
        cracker: 'GOG / Clean Files',
        platform: 'windows',
        genre: 'JRPG, Aventura',
        coverUrl: 'https://ankergames.net/uploads/poster/09-2026/cover-e5F4wQHA1J.jpg',
        description: 'Estelle parte em uma jornada emocionante pelo continente de Liberl em busca de Joshua.'
      },
      {
        id: 'blood-dawnwalker-anker',
        pageUrl: 'https://ankergames.net/game/the-blood-of-dawnwalker',
        providerId: 'com.ghost.ankergames-source',
        providerName: 'AnkerGames',
        title: 'The Blood of Dawnwalker',
        version: 'v1.0.5',
        size: '49.5 GB',
        cracker: 'RUNE',
        platform: 'windows',
        genre: 'RPG de Ação Sombrio',
        coverUrl: 'https://ankergames.net/uploads/poster/09-2026/cover-l48F0vXkmp.jpg',
        description: 'Na Europa do século XIV devastada pela Peste Negra, vampiros emergem para reivindicar o poder.'
      },
      {
        id: 'halloween-anker',
        pageUrl: 'https://ankergames.net/game/halloween-the-game',
        providerId: 'com.ghost.ankergames-source',
        providerName: 'AnkerGames',
        title: 'Halloween: The Game',
        version: 'v1.0.2',
        size: '28.8 GB',
        cracker: 'TENOKE',
        platform: 'windows',
        genre: 'Terror, Sobrevivência',
        coverUrl: 'https://ankergames.net/uploads/poster/09-2026/cover-zlzhroqU1F.jpg',
        description: 'Assuma a Forma do Mal como Michael Myers ou lute para defender e resgatar as famílias de Haddonfield.'
      },
      {
        id: 'dimraeth-anker',
        pageUrl: 'https://ankergames.net/game/dimraeth',
        providerId: 'com.ghost.ankergames-source',
        providerName: 'AnkerGames',
        title: 'Dimraeth',
        version: 'v0.107',
        size: '1.2 GB',
        cracker: 'OFME',
        platform: 'windows',
        genre: 'Action RPG, Pixel-Art',
        coverUrl: 'https://ankergames.net/uploads/poster/09-2026/cover-ePQW9otvze.jpg',
        description: 'RPG de ação híbrido com combate souls-lite, crafting e construção de bases solo ou co-op.'
      },
      {
        id: 'how-to-fish-anker',
        pageUrl: 'https://ankergames.net/game/how-to-fish',
        providerId: 'com.ghost.ankergames-source',
        providerName: 'AnkerGames',
        title: 'How to Fish',
        version: 'v1.0.12',
        size: '0.4 GB',
        cracker: 'OFME',
        platform: 'windows',
        genre: 'Simulação de Pesca',
        coverUrl: 'https://ankergames.net/uploads/poster/08-2026/cover-jndx7acbAh.jpg',
        description: 'Simulador hilário de física para 1 a 4 jogadores náufragos tentando voltar para casa pescando.'
      }
    ]
  },
  {
    id: 'steamrip',
    name: 'SteamRIP Recomendados',
    tag: 'Pre-Installed & Clean Files',
    subtitle: 'Arquivos pré-instalados sem instalador longo, prontos para jogar',
    theme: 'theme-steamrip',
    games: [
      {
        id: 'dune-steamrip',
        pageUrl: 'https://steamrip.com/dune-awakening-free-download/',
        providerId: 'com.ghost.steamrip-source',
        providerName: 'SteamRIP',
        title: 'Dune: Awakening',
        version: 'v1.5.3.0',
        size: '36.4 GB',
        cracker: 'Clean Steam Files',
        platform: 'windows',
        genre: 'Sobrevivência, Mundo Aberto',
        coverUrl: 'https://steamrip.com/wp-content/uploads/2026/09/dune-awakening-preinstalled-steamrip.jpg',
        description: 'Jogo de sobrevivência em mundo aberto ambientado no perigoso planeta Arrakis.'
      },
      {
        id: 'kayak-vr-steamrip',
        pageUrl: 'https://steamrip.com/kayak-vr-mirage-free-download/',
        providerId: 'com.ghost.steamrip-source',
        providerName: 'SteamRIP',
        title: 'Kayak VR: Mirage',
        version: 'Build 19061694',
        size: '26.8 GB',
        cracker: 'Clean Steam Files',
        platform: 'windows',
        genre: 'Simulação, Realidade Virtual',
        coverUrl: 'https://steamrip.com/wp-content/uploads/2026/09/Kayak_VR_Mirage_featured_steamrip.jpg',
        description: 'Navegue de caiaque por paisagens paradisíacas com física foto-realista da água.'
      },
      {
        id: 'island-market-steamrip',
        pageUrl: 'https://steamrip.com/island-market-simulator-free-download/',
        providerId: 'com.ghost.steamrip-source',
        providerName: 'SteamRIP',
        title: 'Island Market Simulator',
        version: 'Build 25230567',
        size: '2.4 GB',
        cracker: 'Clean Steam Files',
        platform: 'windows',
        genre: 'Simulação, Gerenciamento',
        coverUrl: 'https://steamrip.com/wp-content/uploads/2026/09/Island_Market_Simulator_featured_steamrip.jpg',
        description: 'Construa e expanda seu próprio supermercado tropical em uma ilha ensolarada.'
      },
      {
        id: 'police-chief-steamrip',
        pageUrl: 'https://steamrip.com/police-chief-simulator-free-download/',
        providerId: 'com.ghost.steamrip-source',
        providerName: 'SteamRIP',
        title: 'Police Chief Simulator',
        version: 'Build 25370256',
        size: '16.1 GB',
        cracker: 'Clean Steam Files',
        platform: 'windows',
        genre: 'Simulação, Estratégia',
        coverUrl: 'https://steamrip.com/wp-content/uploads/2026/09/police-chief-simulator-preinstalled-steamrip.jpg',
        description: 'Comande as forças policiais de uma metrópole com operações especiais táticas e patrulhas.'
      },
      {
        id: 'combolands-steamrip',
        pageUrl: 'https://steamrip.com/combolands-roguelike-citybuilder-free-download/',
        providerId: 'com.ghost.steamrip-source',
        providerName: 'SteamRIP',
        title: 'Combolands: Roguelike Citybuilder',
        version: 'Build 24989173',
        size: '242 MB',
        cracker: 'Clean Steam Files',
        platform: 'windows',
        genre: 'Roguelike, Cidade',
        coverUrl: 'https://steamrip.com/wp-content/uploads/2026/09/Combolands_Roguelike_Citybuilder_featured_steamrip.jpg',
        description: 'Construa cidades usando cartas hexagonais e combos estratégicos de sinergia.'
      },
      {
        id: 'budget-cuts-steamrip',
        pageUrl: 'https://steamrip.com/budget-cuts-ultimate-free-download/',
        providerId: 'com.ghost.steamrip-source',
        providerName: 'SteamRIP',
        title: 'Budget Cuts Ultimate',
        version: 'Build 24857326',
        size: '7.6 GB',
        cracker: 'Clean Steam Files',
        platform: 'windows',
        genre: 'Furtividade, Ação VR',
        coverUrl: 'https://steamrip.com/wp-content/uploads/2026/09/Budget_Cuts_Ultimate_featured_steamrip.jpg',
        description: 'Escape de robôs de corte de custos corporativos com portais e facas de arremesso.'
      },
      {
        id: 'zompiercer-steamrip',
        pageUrl: 'https://steamrip.com/zompiercer-free-download/',
        providerId: 'com.ghost.steamrip-source',
        providerName: 'SteamRIP',
        title: 'Zompiercer',
        version: 'Build 23648357',
        size: '12.3 GB',
        cracker: 'Clean Steam Files',
        platform: 'windows',
        genre: 'Tiro, Sobrevivência',
        coverUrl: 'https://steamrip.com/wp-content/uploads/2026/09/Zompiercer_featured_steamrip.jpg',
        description: 'Customize seu trem blindado para cruzar uma terra pós-apocalíptica cheia de zumbis.'
      },
      {
        id: 'guacamelee-steamrip',
        pageUrl: 'https://steamrip.com/guacamelee-super-turbo-championship-edition-free-download/',
        providerId: 'com.ghost.steamrip-source',
        providerName: 'SteamRIP',
        title: 'Guacamelee! Super Turbo Championship Edition',
        version: 'Build 1065187',
        size: '1.0 GB',
        cracker: 'Clean Steam Files',
        platform: 'windows',
        genre: 'Metroidvania, Luta',
        coverUrl: 'https://steamrip.com/wp-content/uploads/2026/09/Guacamelee__Super_Turbo_Championship_Edition_featured_steamrip.jpg',
        description: 'Metroidvania em ritmo acelerado com folclore mexicano e combate cuerpo-a-cuerpo.'
      },
      {
        id: 'black-myth-wukong-steamrip',
        pageUrl: 'https://steamrip.com/black-myth-wukong-free-download/',
        providerId: 'com.ghost.steamrip-source',
        providerName: 'SteamRIP',
        title: 'Black Myth: Wukong',
        version: 'v1.0.8',
        size: '118 GB',
        cracker: 'Clean Steam Files',
        platform: 'windows',
        genre: 'Action RPG, Soulslike',
        coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co8365.webp',
        description: 'Ação épica inspirada na mitologia chinesa com o Rei Macaco enfrentando divindades antigas.'
      },
      {
        id: 'gow-ragnarok-steamrip',
        pageUrl: 'https://steamrip.com/god-of-war-ragnarok-free-download/',
        providerId: 'com.ghost.steamrip-source',
        providerName: 'SteamRIP',
        title: 'God of War Ragnarök',
        version: 'v1.0.614.8887',
        size: '102 GB',
        cracker: 'Clean Steam Files',
        platform: 'windows',
        genre: 'Ação, Aventura',
        coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co5s5v.webp',
        description: 'Kratos e Atreus embarcam na jornada definitiva pelos Nove Reinos com o Fimbulwinter iminente.'
      },
      {
        id: 'elden-ring-erdtree-steamrip',
        pageUrl: 'https://steamrip.com/elden-ring-shadow-of-the-erdtree-free-download/',
        providerId: 'com.ghost.steamrip-source',
        providerName: 'SteamRIP',
        title: 'Elden Ring: Shadow of the Erdtree',
        version: 'v1.14.0',
        size: '60 GB',
        cracker: 'Clean Steam Files',
        platform: 'windows',
        genre: 'Action RPG, Mundo Aberto',
        coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co7v2e.webp',
        description: 'Explore a Terra das Sombras seguindo os passos de Miquella com novos chefes e armas lendárias.'
      },
      {
        id: 'silent-hill-2-steamrip',
        pageUrl: 'https://steamrip.com/silent-hill-2-free-download/',
        providerId: 'com.ghost.steamrip-source',
        providerName: 'SteamRIP',
        title: 'Silent Hill 2',
        version: 'v1.1.236',
        size: '36 GB',
        cracker: 'Clean Steam Files',
        platform: 'windows',
        genre: 'Terror Psicológico, Sobrevivência',
        coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co8x6e.webp',
        description: 'Remake moderno da obra-prima de horror psicológico da Konami com gráficos fotorrealistas na névoa.'
      },
      {
        id: 'ghost-of-tsushima-steamrip',
        pageUrl: 'https://steamrip.com/ghost-of-tsushima-directors-cut-free-download/',
        providerId: 'com.ghost.steamrip-source',
        providerName: 'SteamRIP',
        title: "Ghost of Tsushima DIRECTOR'S CUT",
        version: 'v1053.4.0812',
        size: '52 GB',
        cracker: 'Clean Steam Files',
        platform: 'windows',
        genre: 'Ação, Samurai, Mundo Aberto',
        coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co3p2d.webp',
        description: 'A jornada de Jin Sakai para defender a ilha de Tsushima da invasão mongol como o Fantasma.'
      },
      {
        id: 'space-marine-2-steamrip',
        pageUrl: 'https://steamrip.com/warhammer-40000-space-marine-2-free-download/',
        providerId: 'com.ghost.steamrip-source',
        providerName: 'SteamRIP',
        title: 'Warhammer 40,000: Space Marine 2',
        version: 'v4.1.0.0',
        size: '58 GB',
        cracker: 'Clean Steam Files',
        platform: 'windows',
        genre: 'Tiro em Terceira Pessoa, Ação',
        coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co8536.webp',
        description: 'Encarnação brutal da guerra contra enxames de Tiranídeos como o lendário Capitão Titus.'
      },
      {
        id: 'manor-lords-steamrip',
        pageUrl: 'https://steamrip.com/manor-lords-free-download/',
        providerId: 'com.ghost.steamrip-source',
        providerName: 'SteamRIP',
        title: 'Manor Lords',
        version: 'v0.7.995',
        size: '12 GB',
        cracker: 'Clean Steam Files',
        platform: 'windows',
        genre: 'Estratégia, Construção de Cidades',
        coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co836w.webp',
        description: 'Construção medieval realista com simulação social profunda e batalhas táticas em grande escala.'
      },
      {
        id: 'balatro-steamrip',
        pageUrl: 'https://steamrip.com/balatro-free-download/',
        providerId: 'com.ghost.steamrip-source',
        providerName: 'SteamRIP',
        title: 'Balatro',
        version: 'v1.0.1n',
        size: '150 MB',
        cracker: 'Clean Steam Files',
        platform: 'windows',
        genre: 'Roguelike, Cartas',
        coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co7sf2.webp',
        description: 'Roguelike de pôquer viciante onde você combina mãos válidas com cartas Coringa insanas.'
      },
      {
        id: 'palworld-steamrip',
        pageUrl: 'https://steamrip.com/palworld-free-download/',
        providerId: 'com.ghost.steamrip-source',
        providerName: 'SteamRIP',
        title: 'Palworld',
        version: 'v0.3.8',
        size: '16 GB',
        cracker: 'Clean Steam Files',
        platform: 'windows',
        genre: 'Sobrevivência, Coleção de Criaturas',
        coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co79u3.webp',
        description: 'Mundo aberto multijogador onde você batalha, constrói e sobrevive ao lado de criaturas chamadas Pals.'
      },
      {
        id: 'forza-horizon-5-steamrip',
        pageUrl: 'https://steamrip.com/forza-horizon-5-free-download/',
        providerId: 'com.ghost.steamrip-source',
        providerName: 'SteamRIP',
        title: 'Forza Horizon 5',
        version: 'v1.660.852.0',
        size: '135 GB',
        cracker: 'Clean Steam Files',
        platform: 'windows',
        genre: 'Corrida, Mundo Aberto',
        coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co3ofx.webp',
        description: 'Explore as paisagens vibrantes do México com centenas dos melhores carros do mundo.'
      },
      {
        id: 'lies-of-p-steamrip',
        pageUrl: 'https://steamrip.com/lies-of-p-free-download/',
        providerId: 'com.ghost.steamrip-source',
        providerName: 'SteamRIP',
        title: 'Lies of P',
        version: 'v1.5.0.0',
        size: '35 GB',
        cracker: 'Clean Steam Files',
        platform: 'windows',
        genre: 'Soulslike, Ação RPG',
        coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co6479.webp',
        description: 'Releitura sombria do conto clássico de Pinóquio ambientada na elegante era Belle Époque da cidade de Krat.'
      },
      {
        id: 'cyberpunk-phantom-steamrip',
        pageUrl: 'https://steamrip.com/cyberpunk-2077-free-download/',
        providerId: 'com.ghost.steamrip-source',
        providerName: 'SteamRIP',
        title: 'Cyberpunk 2077: Phantom Liberty',
        version: 'v2.13',
        size: '85 GB',
        cracker: 'Clean Steam Files',
        platform: 'windows',
        genre: 'RPG, Ficção Científica, Mundo Aberto',
        coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co6m93.webp',
        description: 'Thriller de espionagem e espionagem militar no distrito mais perigoso de Night City: Dogtown.'
      }
    ]
  },
  {
    id: 'onlinefix',
    name: 'Online-Fix (Multiplayer)',
    tag: 'Co-op Online Spacewar',
    subtitle: 'Jogue online com amigos via Steam Spacewar, LAN e servidores dedicados',
    theme: 'theme-onlinefix',
    games: [
      {
        id: 'how-to-fish-onlinefix',
        pageUrl: 'https://online-fix.me/games/arcade/how-to-fish.html',
        providerId: 'com.ghost.online-fix-source',
        providerName: 'Online-Fix',
        title: 'How to Fish',
        version: 'v1.0.12 (Online Fix)',
        size: '400 MB',
        cracker: 'Online-Fix',
        platform: 'windows',
        genre: 'Simulação de Pesca, Co-op',
        coverUrl: 'https://img.youtube.com/vi/Hg5pBDKCNFI/maxresdefault.jpg',
        description: 'Simulador hilário com física cooperativa para até 4 jogadores náufragos pescando online.'
      },
      {
        id: 'shift-midnight-onlinefix',
        pageUrl: 'https://online-fix.me/games/horror/shift-at-midnight.html',
        providerId: 'com.ghost.online-fix-source',
        providerName: 'Online-Fix',
        title: 'Shift At Midnight Online',
        version: 'v1.0 (Online Fix)',
        size: '2.4 GB',
        cracker: 'Online-Fix',
        platform: 'windows',
        genre: 'Terror Psicológico, Co-op',
        coverUrl: 'https://img.youtube.com/vi/Rit3fIEkrhE/maxresdefault.jpg',
        description: 'Trabalhe no turno da meia-noite em um mercado assombrado com amigos sobrevivendo à noite.'
      },
      {
        id: 'big-walk-onlinefix',
        pageUrl: 'https://online-fix.me/games/adventure/17894-big-walk-po-seti.html',
        providerId: 'com.ghost.online-fix-source',
        providerName: 'Online-Fix',
        title: 'Big Walk',
        version: 'v1.0 (Online Fix)',
        size: '8.5 GB',
        cracker: 'Online-Fix',
        platform: 'windows',
        genre: 'Aventura Co-op, Exploração',
        coverUrl: 'https://img.youtube.com/vi/yV0-MclnJ14/maxresdefault.jpg',
        description: 'Expedição cooperativa em mundo aberto com comunicação por rádio e quebra-cabeças em equipe.'
      },
      {
        id: 'machine-party-onlinefix',
        pageUrl: 'https://online-fix.me/games/arcade/machine-party.html',
        providerId: 'com.ghost.online-fix-source',
        providerName: 'Online-Fix',
        title: 'Machine Party',
        version: 'v1.0 (Online Fix)',
        size: '4.2 GB',
        cracker: 'Online-Fix',
        platform: 'windows',
        genre: 'Party Game, Multijogador',
        coverUrl: 'https://img.youtube.com/vi/JM1_vezdP2w/maxresdefault.jpg',
        description: 'Mini-jogos caóticos e hilários com física e robôs customizáveis para até 8 jogadores online.'
      },
      {
        id: 'mimic-party-onlinefix',
        pageUrl: 'https://online-fix.me/games/arcade/mimic-party.html',
        providerId: 'com.ghost.online-fix-source',
        providerName: 'Online-Fix',
        title: 'Mimic Party',
        version: 'v1.0 (Online Fix)',
        size: '3.8 GB',
        cracker: 'Online-Fix',
        platform: 'windows',
        genre: 'Furtividade, Co-op Social',
        coverUrl: 'https://img.youtube.com/vi/jO0AAA4Gg1I/maxresdefault.jpg',
        description: 'Dedução social e disfarce onde você deve se passar por objetos para escapar dos caçadores.'
      },
      {
        id: 'dayz-onlinefix',
        pageUrl: 'https://online-fix.me/games/survival/17897-dayzavr-po-seti.html',
        providerId: 'com.ghost.online-fix-source',
        providerName: 'Online-Fix',
        title: 'DayZ (DayZavr)',
        version: 'v1.26 (Online Fix)',
        size: '18.5 GB',
        cracker: 'Online-Fix',
        platform: 'windows',
        genre: 'Sobrevivência, MMO',
        coverUrl: 'https://img.youtube.com/vi/fqfAqucyezw/maxresdefault.jpg',
        description: 'Sobreviva em Chernarus infestado de infectados e outros jogadores em servidores DayZavr.'
      },
      {
        id: 'dimraeth-onlinefix',
        pageUrl: 'https://online-fix.me/games/rpg/17896-dimraeth-po-seti.html',
        providerId: 'com.ghost.online-fix-source',
        providerName: 'Online-Fix',
        title: 'Dimraeth',
        version: 'v0.107 (Online Fix)',
        size: '1.2 GB',
        cracker: 'Online-Fix',
        platform: 'windows',
        genre: 'Action RPG, Co-op',
        coverUrl: 'https://img.youtube.com/vi/G04y3In8Owo/maxresdefault.jpg',
        description: 'Mundo de fantasia pixel-art com combate souls-lite e progressão co-op para até 8 jogadores.'
      },
      {
        id: 'bus-simulator-onlinefix',
        pageUrl: 'https://online-fix.me/games/simulator/17895-bus-simulator-27-po-seti.html',
        providerId: 'com.ghost.online-fix-source',
        providerName: 'Online-Fix',
        title: 'Bus Simulator 27',
        version: 'v1.0 (Online Fix)',
        size: '5.4 GB',
        cracker: 'Online-Fix',
        platform: 'windows',
        genre: 'Simulação, Condução',
        coverUrl: 'https://img.youtube.com/vi/6wLRFBu-0XU/maxresdefault.jpg',
        description: 'Dirija ônibus licenciados transportando passageiros por rotas metropolitanas em comboios online.'
      }
    ]
  },
  {
    id: 'switch',
    name: 'Nintendo Switch Collection',
    tag: 'NXBrew · NSWGF · RomsLab',
    subtitle: 'NSP, XCI, Updates e DLCs compatíveis com Ryujinx e Yuzu',
    theme: 'theme-switch',
    games: [
      {
        id: 'zelda-echoes-switch',
        pageUrl: 'https://nxbrew.net/the-legend-of-zelda-echoes-of-wisdom-switch-nsp-xci/',
        providerId: 'com.ghost.nxbrew-source',
        providerName: 'NXBrew',
        title: 'The Legend of Zelda: Echoes of Wisdom',
        version: '1.0.1',
        size: '6.1 GB',
        cracker: 'NSP / XCI',
        platform: 'switch',
        genre: 'Aventura',
        coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co8a15.webp',
        description: 'Use a sabedoria e os ecos para salvar Hyrule com a Princesa Zelda.'
      },
      {
        id: 'mario-wonder-switch',
        pageUrl: 'https://nswgf.com/super-mario-bros-wonder-switch-nsp/',
        providerId: 'com.ghost.nswgf-source',
        providerName: 'NSWGF',
        title: 'Super Mario Bros. Wonder',
        version: '1.0.1',
        size: '3.5 GB',
        cracker: 'NSP',
        platform: 'switch',
        genre: 'Plataforma',
        coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co6q5z.webp',
        description: 'Transformações fantásticas e flores maravilha no Reino das Flores.'
      },
      {
        id: 'metroid-prime-switch',
        pageUrl: 'https://romslab.com/metroid-prime-remastered-switch-xci/',
        providerId: 'com.ghost.romslab-source',
        providerName: 'RomsLab',
        title: 'Metroid Prime Remastered',
        version: '1.0.0',
        size: '6.8 GB',
        cracker: 'XCI',
        platform: 'switch',
        genre: 'Ação, Tiro',
        coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co62q3.webp',
        description: 'Samus Aran em Tallon IV totalmente remasterizado em HD 60fps.'
      },
      {
        id: 'mario-kart-switch',
        pageUrl: 'https://nxbrew.net/mario-kart-8-deluxe-switch-nsp/',
        providerId: 'com.ghost.nxbrew-source',
        providerName: 'NXBrew',
        title: 'Mario Kart 8 Deluxe + Booster Pass',
        version: '3.0.3',
        size: '10.5 GB',
        cracker: 'NSP + 6 DLCs',
        platform: 'switch',
        genre: 'Corrida',
        coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1x6n.webp',
        description: 'Todas as 96 pistas e 48 personagens da coleção completa.'
      },
      {
        id: 'mario-odyssey-switch',
        pageUrl: 'https://nswgf.com/super-mario-odyssey-switch-nsp/',
        providerId: 'com.ghost.nswgf-source',
        providerName: 'NSWGF',
        title: 'Super Mario Odyssey',
        version: '1.3.0',
        size: '5.7 GB',
        cracker: 'NSP',
        platform: 'switch',
        genre: 'Plataforma 3D',
        coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1m35.webp',
        description: 'Viaje pelo mundo com Cappy em uma jornada épica em 3D.'
      },
      {
        id: 'kirby-switch',
        pageUrl: 'https://romslab.com/kirby-and-the-forgotten-land-switch-nsp/',
        providerId: 'com.ghost.romslab-source',
        providerName: 'RomsLab',
        title: 'Kirby and the Forgotten Land',
        version: '1.0.0',
        size: '5.8 GB',
        cracker: 'NSP',
        platform: 'switch',
        genre: 'Plataforma 3D',
        coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co488j.webp',
        description: 'Explore um mundo misterioso com os poderes de transmutação de Kirby.'
      }
    ]
  }
]

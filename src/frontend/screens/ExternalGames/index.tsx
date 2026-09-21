import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faSearch,
  faDownload,
  faPuzzlePiece,
  faCheckCircle,
  faCheck,
  faBolt,
  faExchangeAlt,
  faPlay,
  faShieldAlt,
  faServer,
  faSyncAlt,
  faUsers,
  faTools,
  faGamepad,
  faUser,
  faCalendarAlt,
  faUserCheck,
  faLayerGroup,
  faTimes,
  faStar,
  faThumbsUp,
  faHardDrive,
  faPlus,
  faFire,
  faLightbulb,
  faExternalLinkAlt,
  faSpinner,
  faHome,
  faChevronLeft,
  faChevronRight,
  faArrowRight,
  faFolderOpen,
  faFolder,
  faCog,
  faTrashAlt,
  faBroom
} from '@fortawesome/free-solid-svg-icons'
import { faWindows, faYoutube } from '@fortawesome/free-brands-svg-icons'
import type {
  ExternalGameAction,
  ExternalInstallation,
  GhostDownloadSource,
  GhostSearchResult,
  LocalCandidateGame,
  PluginInfo,
  SourceSearchResponse
} from 'common/types/plugins'
import { isNewerRelease } from 'common/utils'
import { useExternalGames } from './shared'
import fallbackImage from 'frontend/assets/heroic_card.jpg'
import ankerLogo from 'frontend/assets/ankergames-logo.png'
import steamripLogo from 'frontend/assets/steamrip-logo.png'
import CachedImage from 'frontend/components/UI/CachedImage'
import './index.css'

export function cleanTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\[\(].*?[\]\)]/g, ' ')
    .replace(/\b(?:remastered|deluxe edition|definitive edition|edition|version|versão|build)\b/gi, ' ')
    .replace(/\b(?:ofme|rune|tenoke|codex|skidrow|flt|reloaded|hoodlum|empress|cpy|elamigos|fitgirl|dodi|goldberg|clean steam files|own csf)\b/gi, ' ')
    .replace(/\b(?:build\s*)?\d{5,}\b/gi, ' ')
    .replace(/\b(?:v|ver|version)?\s*\d+(?:\.\d+)+\b/gi, ' ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function getCanonicalGameTitle(title: string): string {
  return title
    .replace(/[\[\(].*?[\]\)]/g, ' ')
    .replace(/\b(?:ofme|rune|tenoke|codex|skidrow|flt|reloaded|hoodlum|empress|cpy|elamigos|fitgirl|dodi|goldberg|clean steam files|own csf)\b/gi, ' ')
    .replace(/\b(?:build\s*)?\d{5,}\b/gi, ' ')
    .replace(/\b(?:v|ver|version)?\s*\d+(?:\.\d+)+\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface GroupedGameResult {
  key: string
  canonicalTitle: string
  mainGame: GhostSearchResult
  allSources: GhostSearchResult[]
  platform: 'windows' | 'switch'
  coverUrl?: string
  size?: string
  installedSize?: string
  releaseDate?: string
  description?: string
  youtubeVideoId?: string
}

export function groupGamesByTitle(games: GhostSearchResult[]): GroupedGameResult[] {
  const groups = new Map<string, GroupedGameResult>()

  for (const game of games) {
    const key = cleanTitle(game.title)
    if (!key) continue

    let existing = groups.get(key)
    if (!existing) {
      for (const [groupKey, group] of groups.entries()) {
        if (group.platform === (game.platform || 'windows')) {
          if (
            (key.includes(groupKey) || groupKey.includes(key)) &&
            Math.min(key.length, groupKey.length) / Math.max(key.length, groupKey.length) >= 0.6
          ) {
            existing = group
            break
          }
        }
      }
    }

    if (!existing) {
      groups.set(key, {
        key,
        canonicalTitle: getCanonicalGameTitle(game.title),
        mainGame: game,
        allSources: [game],
        platform: game.platform || 'windows',
        coverUrl: game.coverUrl,
        size: game.size,
        installedSize: game.installedSize,
        releaseDate: game.releaseDate,
        description: game.description
      })
    } else {
      if (
        !existing.allSources.some(
          (s) => s.id === game.id && s.providerId === game.providerId
        )
      ) {
        existing.allSources.push(game)
      }
      if (!existing.coverUrl && game.coverUrl) {
        existing.coverUrl = game.coverUrl
      }
      if (!existing.size && game.size) {
        existing.size = game.size
      }
      if (!existing.installedSize && game.installedSize) {
        existing.installedSize = game.installedSize
      }
      if (!existing.releaseDate && game.releaseDate) {
        existing.releaseDate = game.releaseDate
      }
      if (!existing.description && game.description) {
        existing.description = game.description
      }
      if (!existing.mainGame.version && game.version) {
        existing.mainGame = game
      }
      if (game.title.length > existing.mainGame.title.length && !existing.canonicalTitle.includes(':')) {
        existing.canonicalTitle = getCanonicalGameTitle(game.title)
      }
    }
  }

  return Array.from(groups.values())
}

export function getCardVersion(src: GhostSearchResult): string {
  if (src.version && !src.version.toLowerCase().startsWith('build')) {
    let clean = src.version.replace(/^vers[ãa]o\s*/i, '').trim()
    if (!clean.toLowerCase().startsWith('v')) clean = `v${clean}`
    return clean.replace(/^v\s*v/i, 'v')
  }
  const vMatch = src.title.match(/\bv?(\d+(?:\.\d+)+)\b/i)
  if (vMatch) {
    let clean = vMatch[0].trim()
    if (!clean.toLowerCase().startsWith('v')) clean = `v${clean}`
    return clean.replace(/^v\s*v/i, 'v')
  }
  const buildMatch = src.title.match(/build\s*[\d.]+/i) || src.version?.match(/build\s*[\d.]+/i)
  if (buildMatch) {
    return buildMatch[0]
  }
  return 'v1.0'
}

export function getCardBuildAndSize(src: GhostSearchResult): string {
  const parts: string[] = []
  const buildMatch = src.title.match(/build\s*[\d.]+/i) || src.version?.match(/build\s*[\d.]+/i)
  if (buildMatch) {
    parts.push(buildMatch[0])
  }
  if (src.size) {
    parts.push(`Download: ${src.size}`)
  }
  if (src.installedSize && src.installedSize !== src.size) {
    parts.push(`Instalado: ${src.installedSize}`)
  }
  return parts.join(' · ') || 'Versão mais recente'
}

export function getCardCracker(src: GhostSearchResult): string {
  if (src.cracker) return src.cracker
  const id = src.providerId.toLowerCase()
  if (id.includes('onlinefix') || id.includes('online-fix')) return 'Online-Fix'
  if (id.includes('steamrip')) return 'Clean Steam Files'
  if (id.includes('anker')) return 'OFME / RUNE'
  return 'Comunitário'
}

function getGameDescription(game: GhostSearchResult): string {
  if (game.description && game.description.length > 20) {
    return game.description
  }
  return `Explore e jogue ${getCanonicalGameTitle(game.title)} com download automatizado e verificação de arquivos. Todas as atualizações e backups de saves são gerenciados com segurança pela tecnologia GhostShield.`
}

const POPULAR_FEED_CATEGORIES = [
  { label: 'Todos', query: '' },
  { label: '🔥 Mais Baixados', query: 'Marvel' },
  { label: '⚡ Updates Recentes', query: 'inZOI' },
  { label: '👥 Multiplayer Online', query: 'Baldur' },
  { label: '⚔️ RPG & Aventura', query: 'Elden Ring' },
  { label: '🥊 Luta & Ação', query: 'Tokon' },
  { label: '🚗 Corrida & Simulação', query: 'Forza' },
  { label: '🎮 Nintendo Switch', query: 'Mario' }
]

export const DEFAULT_RECENT_RELEASES: GhostSearchResult[] = [
  {
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
    genre: 'Sobrevivência, Mundo Aberto',
    cracker: 'OFME / RUNE',
    uploader: 'AnkerGames',
    rating: '5.0/5',
    recommendPercent: '100%',
    developer: 'Funcom',
    publisher: 'Funcom',
    deckCompatibility: 'Compatível (Verificado)',
    controllerSupport: 'Suporte Completo',
    description: 'Dune: Awakening é um épico jogo de sobrevivência em mundo aberto onde você mergulha no lendário universo de Arrakis como agente das Bene Gesserit.'
  },
  {
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
  },
  {
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
  },
  {
    id: 'kayak-vr',
    pageUrl: 'https://steamrip.com/kayak-vr-mirage-free-download/',
    providerId: 'com.ghost.steamrip-source',
    providerName: 'SteamRIP',
    title: 'Kayak VR: Mirage',
    version: 'Build 19061694',
    size: '26.8 GB',
    uploadDate: 'Setembro de 2026',
    releaseDate: '2022',
    coverUrl: 'https://steamrip.com/wp-content/uploads/2026/09/Kayak_VR_Mirage_featured_steamrip.jpg',
    platform: 'windows',
    genre: 'Simulação, Realidade Virtual',
    cracker: 'Clean Steam Files',
    uploader: 'SteamRIP',
    rating: '4.8/5',
    recommendPercent: '95%',
    developer: 'Better Than Life',
    publisher: 'Better Than Life',
    deckCompatibility: 'Jogável',
    controllerSupport: 'Suporte Completo',
    description: 'Navegue de caiaque por paisagens paradisíacas com física foto-realista da água.'
  },
  {
    id: 'how-to-fish',
    pageUrl: 'https://online-fix.me/games/arcade/how-to-fish.html',
    providerId: 'com.ghost.online-fix-source',
    providerName: 'Online-Fix',
    title: 'How to Fish',
    version: 'v1.0.12 (Online Fix)',
    size: '400 MB',
    uploadDate: 'Setembro de 2026',
    releaseDate: '2026',
    coverUrl: 'https://img.youtube.com/vi/Hg5pBDKCNFI/maxresdefault.jpg',
    platform: 'windows',
    genre: 'Simulação de Pesca, Co-op',
    cracker: 'Online-Fix',
    uploader: 'Online-Fix',
    rating: '4.7/5',
    recommendPercent: '94%',
    developer: 'Viking Games',
    publisher: 'Viking Games',
    deckCompatibility: 'Jogável',
    controllerSupport: 'Suporte Completo',
    description: 'Simulador hilário com física cooperativa para até 4 jogadores náufragos pescando online.'
  },
  {
    id: 'blackwood',
    pageUrl: 'https://ankergames.net/game/blackwood',
    providerId: 'com.ghost.ankergames-source',
    providerName: 'AnkerGames',
    title: 'BLACKWOOD',
    version: 'Build 25375198',
    size: '12.3 GB',
    uploadDate: 'Setembro de 2026',
    releaseDate: '2026',
    coverUrl: 'https://ankergames.net/uploads/poster/09-2026/cover-ES5rT0FBgH.jpg',
    platform: 'windows',
    genre: 'Terror de Sobrevivência',
    cracker: 'TENOKE',
    uploader: 'AnkerGames',
    rating: '4.8/5',
    recommendPercent: '96%',
    developer: 'Dark Forest Games',
    publisher: 'Dark Forest Games',
    deckCompatibility: 'Compatível (Verificado)',
    controllerSupport: 'Suporte Completo',
    description: 'Aventure-se na escuridão misteriosa enfrentando entidades ancestrais nas florestas de Blackwood.'
  }
]

export interface SpotlightGameItem {
  id: string
  title: string
  tags: string[]
  backdropUrl: string
  game: GhostSearchResult
}

export interface StoreShelfItem {
  id: string
  name: string
  tag: string
  subtitle: string
  theme: 'theme-anker' | 'theme-steamrip' | 'theme-onlinefix' | 'theme-switch'
  games: GhostSearchResult[]
}

export const HOME_SPOTLIGHT_GAMES: SpotlightGameItem[] = [
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

export const STORE_HIGHLIGHT_SHELVES: StoreShelfItem[] = [
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

export function renderProviderIcon(providerId: string, providerName: string, iconUrl?: string, size = 16) {
  const id = providerId.toLowerCase()
  if (id.includes('steamrip')) {
    return (
      <img
        src={steamripLogo}
        alt="SteamRIP"
        style={{
          width: `${size + 2}px`,
          height: `${size + 2}px`,
          borderRadius: '50%',
          objectFit: 'cover',
          display: 'inline-block',
          verticalAlign: 'middle',
          boxShadow: '0 0 6px rgba(168, 85, 247, 0.45)'
        }}
      />
    )
  }
  if (id.includes('anker')) {
    return (
      <img
        src={ankerLogo}
        alt="AnkerGames"
        style={{
          width: `${size + 4}px`,
          height: `${size + 4}px`,
          borderRadius: '4px',
          objectFit: 'contain',
          display: 'inline-block',
          verticalAlign: 'middle',
          filter: 'drop-shadow(0 0 4px rgba(0, 255, 255, 0.5))'
        }}
      />
    )
  }
  if (id.includes('onlinefix') || id.includes('online-fix')) {
    return <FontAwesomeIcon icon={faTools} style={{ color: '#00e5ff', fontSize: `${Math.max(12, size - 2)}px` }} />
  }
  if (id.includes('nxbrew') || id.includes('nswgf')) {
    return <FontAwesomeIcon icon={faGamepad} style={{ color: '#e52521', fontSize: `${size}px` }} />
  }
  if (id.includes('romslab')) {
    return <FontAwesomeIcon icon={faGamepad} style={{ color: '#ffb300', fontSize: `${size}px` }} />
  }
  if (iconUrl) {
    return (
      <img
        src={iconUrl}
        alt={providerName}
        style={{ width: `${size + 1}px`, height: `${size + 1}px`, borderRadius: '4px', objectFit: 'contain' }}
      />
    )
  }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: `${size + 3}px`,
        height: `${size + 3}px`,
        borderRadius: '4px',
        background: 'linear-gradient(135deg, #00f2fe, #4facfe)',
        color: '#041019',
        fontWeight: 900,
        fontSize: `${Math.max(10, size - 4)}px`,
        fontFamily: 'sans-serif',
        lineHeight: 1
      }}
    >
      {providerName ? providerName[0].toUpperCase() : 'A'}
    </span>
  )
}

export function formatPublicationDate(dateStr?: string): string | undefined {
  if (!dateStr) return undefined
  const clean = dateStr.trim()
  if (!clean) return undefined
  if (/^\d{4}$/.test(clean)) return clean

  const months: Record<string, string> = {
    jan: 'Janeiro', january: 'Janeiro', 'января': 'Janeiro', 'январь': 'Janeiro',
    feb: 'Fevereiro', february: 'Fevereiro', 'февраля': 'Fevereiro', 'февраль': 'Fevereiro',
    mar: 'Março', march: 'Março', 'марта': 'Março', 'март': 'Março',
    apr: 'Abril', april: 'Abril', 'апреля': 'Abril', 'апрель': 'Abril',
    may: 'Maio', май: 'Maio',
    jun: 'Junho', june: 'Junho', 'июня': 'Junho', 'июнь': 'Junho',
    jul: 'Julho', july: 'Julho', 'июля': 'Julho', 'июль': 'Julho',
    aug: 'Agosto', august: 'Agosto', 'августа': 'Agosto', 'август': 'Agosto',
    sep: 'Setembro', september: 'Setembro', 'сентября': 'Setembro', 'сентябрь': 'Setembro',
    oct: 'Outubro', october: 'Outubro', 'октября': 'Outubro', 'октябрь': 'Outubro',
    nov: 'Novembro', november: 'Novembro', 'ноября': 'Novembro', 'ноябрь': 'Novembro',
    dec: 'Dezembro', december: 'Dezembro', 'декабря': 'Dezembro', 'декабрь': 'Dezembro'
  }

  const m1 = clean.match(/^([a-zA-Z\u0400-\u04FF]+)\s+(\d{1,2}),?\s+(\d{4})/i)
  if (m1) {
    const k = m1[1].toLowerCase()
    const name = months[k] || months[k.slice(0, 3)] || m1[1]
    return `${m1[2]} de ${name} de ${m1[3]}`
  }

  const m2 = clean.match(/^(\d{1,2})\s+([a-zA-Z\u0400-\u04FF]+),?\s+(\d{4})/i)
  if (m2) {
    const k = m2[2].toLowerCase()
    const name = months[k] || months[k.slice(0, 3)] || m2[2]
    return `${m2[1]} de ${name} de ${m2[3]}`
  }

  const mDate = clean.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})/)
  if (mDate) {
    const day = parseInt(mDate[1], 10)
    const monthIdx = parseInt(mDate[2], 10) - 1
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ]
    return `${day} de ${monthNames[monthIdx] || mDate[2]} de ${mDate[3]}`
  }

  const mIso = clean.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/)
  if (mIso) {
    const day = parseInt(mIso[3], 10)
    const monthIdx = parseInt(mIso[2], 10) - 1
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ]
    return `${day} de ${monthNames[monthIdx] || mIso[2]} de ${mIso[1]}`
  }

  return clean
}

export function inferCategoryTag(title: string): string {
  const lower = title.toLowerCase()
  if (
    lower.includes('fighting') ||
    lower.includes('souls') ||
    lower.includes('tōkon') ||
    lower.includes('tokon') ||
    lower.includes('tekken') ||
    lower.includes('kombat') ||
    lower.includes('street fighter')
  ) {
    return 'Ação, Luta'
  }
  if (
    lower.includes('rpg') ||
    lower.includes('witcher') ||
    lower.includes('elden') ||
    lower.includes('final fantasy') ||
    lower.includes('baldur')
  ) {
    return 'RPG, Aventura'
  }
  if (
    lower.includes('racing') ||
    lower.includes('forza') ||
    lower.includes('speed') ||
    lower.includes('kart')
  ) {
    return 'Corrida, Simulação'
  }
  if (
    lower.includes('simulator') ||
    lower.includes('farm') ||
    lower.includes('inzoi') ||
    lower.includes('sims') ||
    lower.includes('parkitect')
  ) {
    return 'Simulação, Estratégia'
  }
  if (
    lower.includes('horror') ||
    lower.includes('resident evil') ||
    lower.includes('silent hill') ||
    lower.includes('outlast')
  ) {
    return 'Terror, Sobrevivência'
  }
  return 'Ação, Luta'
}

export interface GameInstallationStatus {
  status: 'not_installed' | 'installed_up_to_date' | 'update_available' | 'migrate_available'
  installedGame?: ExternalInstallation
  currentVersion?: string
  newVersion?: string
}

export function getGameInstallationStatus(
  searchGame: GhostSearchResult,
  installations: ExternalInstallation[],
  localCandidates?: LocalCandidateGame[]
): GameInstallationStatus {
  const cleanSearch = cleanTitle(searchGame.title)

  let match = installations.find((inst) => {
    if (inst.game.id === searchGame.id || inst.game.pageUrl === searchGame.pageUrl) {
      return true
    }
    if (inst.game.platform === searchGame.platform) {
      const cleanInst = cleanTitle(inst.game.title)
      if (cleanInst === cleanSearch && cleanInst.length > 2) return true
      if (cleanInst.includes(cleanSearch) || cleanSearch.includes(cleanInst)) {
        if (Math.min(cleanInst.length, cleanSearch.length) / Math.max(cleanInst.length, cleanSearch.length) > 0.6) {
          return true
        }
      }
    }
    return false
  })

  // Se encontrou em installations mas não tem diretório, busca em localCandidates
  if (match && !match.directory && localCandidates?.length) {
    const local = localCandidates.find(
      (c) => c.appName === match!.appName || cleanTitle(c.title) === cleanSearch
    )
    if (local?.directory) {
      match = {
        ...match,
        directory: local.directory,
        executable: match.executable || local.executable || ''
      }
    }
  }

  // Se não encontrou em installations, busca em localCandidates (jogos instalados na biblioteca/sideload)
  if (!match && localCandidates?.length) {
    const localMatch = localCandidates.find((cand) => {
      const cleanCand = cleanTitle(cand.title)
      if (cleanCand === cleanSearch && cleanCand.length > 2) return true
      if (cleanCand.includes(cleanSearch) || cleanSearch.includes(cleanCand)) {
        if (
          Math.min(cleanCand.length, cleanSearch.length) /
            Math.max(cleanCand.length, cleanSearch.length) >
          0.6
        ) {
          return true
        }
      }
      return false
    })

    if (localMatch) {
      match = {
        id: localMatch.appName,
        appName: localMatch.appName,
        directory: localMatch.directory || '',
        executable: localMatch.executable || '',
        installedAt: new Date().toISOString(),
        game: {
          id: localMatch.appName,
          title: localMatch.title,
          providerId: 'sideload',
          providerName: 'Biblioteca Local',
          version: localMatch.version || '1.0.0',
          platform: searchGame.platform || 'windows'
        },
        autoBackup: false,
        autoUpdate: false,
        linkedExisting: true,
        history: []
      }
    }
  }

  if (!match) {
    return { status: 'not_installed' }
  }

  const currentVer = match.game.version
  const newVer = searchGame.version
  const isSameStore = match.game.providerId === searchGame.providerId

  if (currentVer && newVer) {
    if (isNewerRelease(currentVer, newVer)) {
      return {
        status: isSameStore ? 'update_available' : 'migrate_available',
        installedGame: match,
        currentVersion: currentVer,
        newVersion: newVer
      }
    }
    if (!isSameStore) {
      return {
        status: 'migrate_available',
        installedGame: match,
        currentVersion: currentVer,
        newVersion: newVer
      }
    }
    return {
      status: 'installed_up_to_date',
      installedGame: match,
      currentVersion: currentVer,
      newVersion: newVer
    }
  }

  if (!isSameStore) {
    return {
      status: 'migrate_available',
      installedGame: match,
      currentVersion: currentVer,
      newVersion: newVer
    }
  }

  return {
    status: 'installed_up_to_date',
    installedGame: match,
    currentVersion: currentVer,
    newVersion: newVer
  }
}

export function isMatchingProvider(a?: string, b?: string): boolean {
  if (!a || !b) return false
  if (a === b) return true
  const cleanA = a.toLowerCase().replace(/^com\.ghost\./, '').replace(/-source$/, '').replace(/[^a-z0-9]/g, '')
  const cleanB = b.toLowerCase().replace(/^com\.ghost\./, '').replace(/-source$/, '').replace(/[^a-z0-9]/g, '')
  return cleanA === cleanB || cleanA.includes(cleanB) || cleanB.includes(cleanA)
}

export function resolveCanonicalPluginId(providerId: string, availablePlugins: PluginInfo[] = []): string {
  const match = availablePlugins.find((p) => isMatchingProvider(p.id, providerId))
  if (match) return match.id

  const clean = providerId.toLowerCase()
  if (clean.includes('anker')) return 'com.ghost.ankergames-source'
  if (clean.includes('steamrip')) return 'com.ghost.steamrip-source'
  if (clean.includes('onlinefix') || clean.includes('online-fix')) return 'com.ghost.online-fix-source'
  if (clean.includes('nxbrew')) return 'com.ghost.nxbrew-source'
  if (clean.includes('nswgf')) return 'com.ghost.nswgf-source'
  if (clean.includes('romslab')) return 'com.ghost.romslab-source'
  return providerId
}

export function buildFallbackDownloadSources(game: GhostSearchResult): GhostDownloadSource[] {
  const sources: GhostDownloadSource[] = []
  const targetUrl = (game.pageUrl && /^https?:\/\//i.test(game.pageUrl))
    ? game.pageUrl
    : (game.id && /^https?:\/\//i.test(game.id))
      ? game.id
      : ''

  if (targetUrl) {
    sources.push({
      id: targetUrl,
      name: `🌐 Abrir Página Oficial · ${game.providerName}`,
      type: 'external',
      url: targetUrl
    })
  } else {
    const prov = game.providerId.toLowerCase()
    let fallbackUrl = ''
    if (prov.includes('anker')) fallbackUrl = `https://ankergames.net/game/${game.id.replace(/-anker$/, '')}`
    else if (prov.includes('steamrip')) fallbackUrl = `https://steamrip.com/${game.id.replace(/-steamrip$/, '')}-free-download/`
    else if (prov.includes('onlinefix') || prov.includes('online-fix')) fallbackUrl = 'https://online-fix.me'
    else if (prov.includes('nxbrew')) fallbackUrl = `https://nxbrew.net/${game.id.replace(/-switch$/, '')}-switch-nsp-xci/`
    else if (prov.includes('nswgf')) fallbackUrl = 'https://nswgf.com'
    else if (prov.includes('romslab')) fallbackUrl = 'https://romslab.com'

    if (fallbackUrl) {
      sources.push({
        id: fallbackUrl,
        name: `📥 Download Direto / Espelhos · ${game.providerName}`,
        type: 'direct',
        archive: 'zip',
        url: fallbackUrl
      })
    }
  }
  return sources
}

export default function ExternalGamesScreen() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { state, error, refresh } = useExternalGames()
  const [plugins, setPlugins] = useState<PluginInfo[]>([])
  const [query, setQuery] = useState('')
  const [provider, setProvider] = useState('')
  const [search, setSearch] = useState<SourceSearchResponse>({
    games: [],
    errors: []
  })
  const [searched, setSearched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [selected, setSelected] = useState<GhostSearchResult>()
  const [selectedGroupKey, setSelectedGroupKey] = useState('')
  const [showDownloadOptions, setShowDownloadOptions] = useState(false)
  const [sources, setSources] = useState<GhostDownloadSource[]>([])
  const [localGames, setLocalGames] = useState<LocalCandidateGame[]>([])
  const [replacement, setReplacement] = useState(
    params.get('installation') || ''
  )
  const [installPaths, setInstallPaths] = useState<string[]>(() => {
    const saved = localStorage.getItem('ghost_external_install_paths')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length) return parsed
      } catch {}
    }
    return ['C:\\Ghost Games', 'D:\\Jogos']
  })
  const [selectedInstallPath, setSelectedInstallPath] = useState<string>(() => {
    const saved = localStorage.getItem('ghost_external_selected_install_path')
    return saved || 'C:\\Ghost Games'
  })
  const [showPathsManagerModal, setShowPathsManagerModal] = useState<boolean>(false)
  const [replacementModal, setReplacementModal] = useState<{
    isOpen: boolean
    sourceId: string
    replaceId: string
    oldGame: {
      title: string
      providerName: string
      directory?: string
      version?: string
      savePath?: string
    }
    newGame: {
      title: string
      providerName: string
      version?: string
    }
    operation: 'update' | 'replace'
    targetDirectory?: string
  } | null>(null)
  const [youtubeModalOpen, setYoutubeModalOpen] = useState(false)
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null)
  const [youtubeLoading, setYoutubeLoading] = useState(false)
  const [portugueseDescriptions, setPortugueseDescriptions] = useState<Record<string, string>>({})
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('Todos')
  const [spotlightIndex, setSpotlightIndex] = useState(0)
  const requestNumber = useRef(0)
  const installation = state.installations.find(
    (item) => item.id === replacement
  )

  const handleResetToHome = () => {
    setQuery('')
    setSearched(false)
    setSelected(undefined)
    setSelectedGroupKey('')
    setProvider('')
    setSources([])
    setShowDownloadOptions(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSelectHomeGame = (game: GhostSearchResult) => {
    const canonicalProviderId = resolveCanonicalPluginId(game.providerId, plugins)
    const normalizedGame: GhostSearchResult = {
      ...game,
      providerId: canonicalProviderId
    }

    setProvider('')
    setSearch((prev) => {
      const exists = prev.games.some(
        (g) =>
          (g.id === normalizedGame.id || (g.pageUrl && g.pageUrl === normalizedGame.pageUrl)) &&
          isMatchingProvider(g.providerId, normalizedGame.providerId)
      )
      if (!exists) {
        return { ...prev, games: [normalizedGame, ...prev.games] }
      }
      return prev
    })
    const key = cleanTitle(normalizedGame.title)
    setSelectedGroupKey(key)
    setSelected(normalizedGame)
    void details(normalizedGame)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleOpenSpotlightTrailer = async (game: GhostSearchResult) => {
    handleSelectHomeGame(game)
    setYoutubeModalOpen(true)
    setYoutubeLoading(true)
    setCurrentVideoId(null)
    try {
      const videoId = await window.api.pluginsGetGameTrailer(getCanonicalGameTitle(game.title))
      setCurrentVideoId(videoId)
    } catch {
      setCurrentVideoId(null)
    } finally {
      setYoutubeLoading(false)
    }
  }

  const scrollShelf = (shelfId: string, direction: 'left' | 'right') => {
    const el = document.getElementById(`shelf-scroll-${shelfId}`)
    if (el) {
      const amount = direction === 'left' ? -420 : 420
      el.scrollBy({ left: amount, behavior: 'smooth' })
    }
  }

  useEffect(() => {
    window.api
      .externalGamesLocalCandidates()
      .then(setLocalGames)
      .catch(() => setMessage('Falha ao listar jogos locais.'))
    const update = (items: PluginInfo[]) =>
      setPlugins(
        items.filter((item) => item.type === 'game-source' && item.isEnabled)
      )
    window.api
      .pluginsGetList()
      .then(update)
      .catch(() => setMessage('Falha ao carregar as fontes.'))
    const remove = window.api.onPluginsUpdated((_event, items) => {
      requestNumber.current++
      update(items)
      setSelected(undefined)
      setSources([])
      setBusy(false)
    })
    return () => {
      requestNumber.current++
      remove()
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (replacementModal) setReplacementModal(null)
        if (youtubeModalOpen) setYoutubeModalOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [replacementModal, youtubeModalOpen])

  async function run(work: () => Promise<void>) {
    setBusy(true)
    setMessage('')
    try {
      await work()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function details(game: GhostSearchResult) {
    const current = ++requestNumber.current
    setSelected(game)
    setSources([])
    await run(async () => {
      const canonicalProviderId = resolveCanonicalPluginId(game.providerId, plugins)
      const gameTargetId = (game.pageUrl && /^https?:\/\//i.test(game.pageUrl)) ? game.pageUrl : game.id
      const [options, fullDetails] = await Promise.all([
        window.api.pluginsGetDownloadSources(canonicalProviderId, gameTargetId).catch(() => []),
        window.api.pluginsGetGameDetails(canonicalProviderId, gameTargetId).catch(() => undefined)
      ])
      if (current === requestNumber.current) {
        const finalOptions = (options && options.length > 0)
          ? options
          : buildFallbackDownloadSources(game)

        setSources(finalOptions)
        if (fullDetails) {
          setSelected((prev) =>
            prev && (prev.id === fullDetails.id || prev.pageUrl === fullDetails.pageUrl) && isMatchingProvider(prev.providerId, fullDetails.providerId)
              ? { ...prev, ...fullDetails }
              : prev
          )
          setSearch((prev) => ({
            ...prev,
            games: prev.games.map((g) =>
              (g.id === fullDetails.id || (g.pageUrl && g.pageUrl === fullDetails.pageUrl)) && isMatchingProvider(g.providerId, fullDetails.providerId)
                ? { ...g, ...fullDetails }
                : g
            )
          }))
        }
        if (!finalOptions.length)
          setMessage('A fonte não disponibilizou opções de download.')
      }
    })
  }

  async function action(command: ExternalGameAction) {
    await run(async () => {
      const result = await window.api.externalGamesAction(command)
      if (!result.success) {
        if (result.error) throw new Error(result.error)
        return
      }
      if (command.type === 'check-update') {
        if (result.update) {
          await details(result.update)
          setMessage(`Nova versão encontrada: ${result.update.version}`)
        } else
          setMessage('Nenhuma versão mais recente identificada nesta fonte.')
      } else setMessage('Operação concluída.')
      await refresh()
    })
  }

  const handleAddInstallPath = async () => {
    try {
      const result = await window.api.openDialog({
        buttonLabel: 'Selecionar Pasta',
        properties: ['openDirectory'],
        title: 'Escolha uma pasta para instalação de jogos'
      })
      if (result && typeof result === 'string') {
        const trimmed = result.trim()
        if (trimmed && !installPaths.includes(trimmed)) {
          const updated = [...installPaths, trimmed]
          setInstallPaths(updated)
          setSelectedInstallPath(trimmed)
          localStorage.setItem('ghost_external_install_paths', JSON.stringify(updated))
          localStorage.setItem('ghost_external_selected_install_path', trimmed)
        } else if (trimmed) {
          setSelectedInstallPath(trimmed)
          localStorage.setItem('ghost_external_selected_install_path', trimmed)
        }
      }
    } catch {
      // ignore
    }
  }

  const handleSelectInstallPath = (path: string) => {
    setSelectedInstallPath(path)
    localStorage.setItem('ghost_external_selected_install_path', path)
  }

  const games = useMemo(() => {
    const pool = [...search.games]
    if (selected && !pool.some((g) => (g.id === selected.id || (g.pageUrl && g.pageUrl === selected.pageUrl)) && isMatchingProvider(g.providerId, selected.providerId))) {
      pool.unshift(selected)
    }
    return pool.filter((game) => {
      if (selected && (game.id === selected.id || (game.pageUrl && game.pageUrl === selected.pageUrl)) && isMatchingProvider(game.providerId, selected.providerId)) {
        return true
      }
      const matchesStore = !provider || isMatchingProvider(game.providerId, provider)
      const hasPlugin = !plugins.length || plugins.some((pl) => isMatchingProvider(pl.id, game.providerId))
      return matchesStore && hasPlugin
    })
  }, [search.games, selected, provider, plugins])

  const groupedGames = useMemo(() => groupGamesByTitle(games), [games])

  const activeGroup = useMemo(() => {
    if (!searched && !selected && !selectedGroupKey) {
      return undefined
    }
    if (selectedGroupKey) {
      const found = groupedGames.find((g) => g.key === selectedGroupKey)
      if (found) return found
    }
    if (selected) {
      const found = groupedGames.find((g) =>
        g.allSources.some((s) => (s.id === selected.id || (s.pageUrl && s.pageUrl === selected.pageUrl)) && isMatchingProvider(s.providerId, selected.providerId))
      )
      if (found) return found
      return groupGamesByTitle([selected])[0]
    }
    return groupedGames[0]
  }, [searched, selected, selectedGroupKey, groupedGames])

  const activeSource = useMemo(() => {
    if (!activeGroup) return undefined
    if (selected) {
      const match = activeGroup.allSources.find(
        (s) => (s.id === selected.id || (s.pageUrl && s.pageUrl === selected.pageUrl)) && isMatchingProvider(s.providerId, selected.providerId)
      )
      if (match) return match
    }
    return activeGroup.allSources[0] || activeGroup.mainGame
  }, [activeGroup, selected])

  const currentInstStatus = useMemo(() => {
    if (!activeSource) return { status: 'not_installed' as const }
    return getGameInstallationStatus(activeSource, state.installations, localGames)
  }, [activeSource, state.installations, localGames])

  const installedDirectory = currentInstStatus.installedGame?.directory

  const effectiveInstallPaths = useMemo(() => {
    if (installedDirectory && installedDirectory.trim()) {
      const norm = installedDirectory.trim()
      const filtered = installPaths.filter(
        (p) => p.trim().toLowerCase() !== norm.toLowerCase()
      )
      return [norm, ...filtered]
    }
    return installPaths
  }, [installedDirectory, installPaths])

  useEffect(() => {
    if (
      installedDirectory &&
      (currentInstStatus.status === 'migrate_available' ||
        currentInstStatus.status === 'update_available' ||
        currentInstStatus.status === 'installed_up_to_date')
    ) {
      setSelectedInstallPath(installedDirectory)
    }
  }, [installedDirectory, currentInstStatus.status])

  const handleDeleteSavedPath = (pathToDelete: string) => {
    const updated = installPaths.filter((p) => p.toLowerCase() !== pathToDelete.toLowerCase())
    setInstallPaths(updated)
    localStorage.setItem('ghost_external_install_paths', JSON.stringify(updated))

    if (selectedInstallPath.trim().toLowerCase() === pathToDelete.trim().toLowerCase()) {
      const fallback =
        (installedDirectory && installedDirectory.trim()) ||
        updated[0] ||
        'C:\\Ghost Games'
      setSelectedInstallPath(fallback)
      localStorage.setItem('ghost_external_selected_install_path', fallback)
    }
  }

  const handleResetSavedPaths = () => {
    const defaults = ['C:\\Ghost Games', 'D:\\Jogos']
    setInstallPaths(defaults)
    localStorage.setItem('ghost_external_install_paths', JSON.stringify(defaults))
    if (
      !defaults.some((p) => p.toLowerCase() === selectedInstallPath.toLowerCase()) &&
      selectedInstallPath.toLowerCase() !== (installedDirectory || '').toLowerCase()
    ) {
      const fallback = installedDirectory || defaults[0]
      setSelectedInstallPath(fallback)
      localStorage.setItem('ghost_external_selected_install_path', fallback)
    }
  }

  useEffect(() => {
    if (!showPathsManagerModal) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowPathsManagerModal(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showPathsManagerModal])


  useEffect(() => {
    if (activeSource) {
      if (
        !selected ||
        selected.id !== activeSource.id ||
        selected.providerId !== activeSource.providerId
      ) {
        setSelected(activeSource)
        void details(activeSource)
      }
    }
  }, [activeSource?.id, activeSource?.providerId])

  useEffect(() => {
    if (!activeGroup) return
    const groupKey = activeGroup.key
    if (portugueseDescriptions[groupKey]) return

    const candidateDesc =
      activeGroup.description ||
      activeGroup.mainGame.description ||
      activeGroup.allSources.find((s) => s.description)?.description

    window.api
      .pluginsGetPortugueseDescription(activeGroup.canonicalTitle, candidateDesc)
      .then((ptDesc) => {
        if (ptDesc) {
          setPortugueseDescriptions((prev) => ({
            ...prev,
            [groupKey]: ptDesc
          }))
        }
      })
      .catch(() => undefined)
  }, [activeGroup?.key, activeGroup?.canonicalTitle])

  const handleOpenYoutubeModal = async () => {
    if (!activeGroup) return
    setYoutubeModalOpen(true)
    if (activeGroup.youtubeVideoId) {
      setCurrentVideoId(activeGroup.youtubeVideoId)
      return
    }
    setYoutubeLoading(true)
    setCurrentVideoId(null)
    try {
      const videoId = await window.api.pluginsGetGameTrailer(activeGroup.canonicalTitle)
      setCurrentVideoId(videoId)
      if (videoId) {
        activeGroup.youtubeVideoId = videoId
      }
    } catch {
      setCurrentVideoId(null)
    } finally {
      setYoutubeLoading(false)
    }
  }

  const executeSearch = (term: string) => {
    const trimmed = term.trim()
    if (!trimmed) return
    const current = ++requestNumber.current
    void run(async () => {
      const results = await window.api.externalGamesSearch(trimmed)
      if (current === requestNumber.current) {
        setSearch(results)
        setSearched(true)
        setSelected(undefined)
        setSelectedGroupKey('')
        setShowDownloadOptions(false)
      }
    })
  }

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 3) return
    const timer = setTimeout(() => {
      executeSearch(trimmed)
    }, 600)
    return () => clearTimeout(timer)
  }, [query])

  const popularGameSuggestions = [
    'Marvel Tokon: Fighting Souls',
    'inZOI',
    'Black Myth: Wukong',
    'Elden Ring: Shadow of the Erdtree',
    'Dragon Ball: Sparking! ZERO',
    'Grand Theft Auto V',
    'Cyberpunk 2077',
    'Baldur\'s Gate 3',
    'Forza Horizon 5',
    'Silent Hill 2',
    'God of War Ragnarök',
    'Red Dead Redemption 2',
    'Hogwarts Legacy'
  ]

  const suggestions = query.trim().length >= 1
    ? Array.from(new Set([
        ...popularGameSuggestions.filter(s => s.toLowerCase().includes(query.trim().toLowerCase())),
        ...search.games.map(g => getCanonicalGameTitle(g.title)).filter(t => t.toLowerCase().includes(query.trim().toLowerCase())),
        ...localGames.map(g => g.title).filter(t => t.toLowerCase().includes(query.trim().toLowerCase()))
      ])).slice(0, 6)
    : []

  const handlePrimaryAction = async () => {
    if (!activeSource) return
    const instStatus = currentInstStatus

    if (instStatus.status === 'installed_up_to_date' && instStatus.installedGame?.appName) {
      try {
        const result = await window.api.launch({
          appName: instStatus.installedGame.appName,
          runner: 'sideload'
        })
        if (result.status === 'error') {
          setMessage('Não foi possível iniciar o jogo. Verifique as configurações.')
        }
      } catch {
        setMessage('Não foi possível iniciar o jogo.')
      }
      return
    }

    await run(async () => {
      if (!(await checkDownloadConnection())) return
      let sourceId = sources[0]?.id
      if (!sourceId) {
        const fetched = await window.api.pluginsGetDownloadSources(
          activeSource.providerId,
          activeSource.id
        )
        sourceId = fetched[0]?.id
        setSources(fetched)
      }

      if (!sourceId) {
        setMessage('A fonte não disponibilizou link direto ou pacote de download.')
        return
      }

      let replaceId = instStatus.installedGame?.id || replacement || undefined
      if (
        instStatus.installedGame?.appName &&
        !state.installations.some((i) => i.id === replaceId)
      ) {
        try {
          const synced = await window.api.externalGamesGetOrCreateInstallation(
            instStatus.installedGame.appName
          )
          if (synced?.id) {
            replaceId = synced.id
          }
        } catch {
          // ignore
        }
      }

      if (replaceId && instStatus.installedGame) {
        const op = instStatus.status === 'update_available' ? 'update' : 'replace'
        setReplacementModal({
          isOpen: true,
          sourceId,
          replaceId,
          oldGame: {
            title: instStatus.installedGame.game?.title || activeSource.title,
            providerName: instStatus.installedGame.game?.providerName || 'Sideload / Piratas',
            directory: instStatus.installedGame.directory,
            version: instStatus.installedGame.game?.version,
            savePath: instStatus.installedGame.savePath
          },
          newGame: {
            title: activeSource.title,
            providerName: activeSource.providerName,
            version: activeSource.version
          },
          operation: op,
          targetDirectory: selectedInstallPath || undefined
        })
        return
      }

      const result = await window.api.externalGamesInstall({
        game: activeSource,
        sourceId,
        replaceInstallationId: replaceId,
        targetDirectory: selectedInstallPath || undefined
      })

      if (result.success) {
        navigate('/download-manager')
      } else if (result.error) {
        throw new Error(result.error)
      }
    })
  }

  async function checkDownloadConnection(sourceId?: string): Promise<boolean> {
    if (sourceId === 'anker-browser-direct') return true
    if (!activeSource?.providerId.toLowerCase().includes('anker')) return true
    const integrations = await window.api.downloadIntegrationsState()
    if (integrations.torboxConfigured) return true
    setMessage('O download ainda não começou: conecte o TorBox em Integrações de downloads e clique em Salvar e testar. Depois volte ao jogo e clique em Download.')
    return false
  }

  const handleInstallFromSource = async (sourceId: string) => {
    if (!activeSource) return
    const instStatus = currentInstStatus
    await run(async () => {
      if (!(await checkDownloadConnection(sourceId))) return
      let replaceId = instStatus.installedGame?.id || replacement || undefined
      if (
        instStatus.installedGame?.appName &&
        !state.installations.some((i) => i.id === replaceId)
      ) {
        try {
          const synced = await window.api.externalGamesGetOrCreateInstallation(
            instStatus.installedGame.appName
          )
          if (synced?.id) {
            replaceId = synced.id
          }
        } catch {
          // ignore
        }
      }

      if (replaceId && instStatus.installedGame) {
        const op = instStatus.status === 'update_available' ? 'update' : 'replace'
        setReplacementModal({
          isOpen: true,
          sourceId,
          replaceId,
          oldGame: {
            title: instStatus.installedGame.game?.title || activeSource.title,
            providerName: instStatus.installedGame.game?.providerName || 'Sideload / Piratas',
            directory: instStatus.installedGame.directory,
            version: instStatus.installedGame.game?.version,
            savePath: instStatus.installedGame.savePath
          },
          newGame: {
            title: activeSource.title,
            providerName: activeSource.providerName,
            version: activeSource.version
          },
          operation: op,
          targetDirectory: selectedInstallPath || undefined
        })
        return
      }

      const result = await window.api.externalGamesInstall({
        game: activeSource,
        sourceId,
        replaceInstallationId: replaceId,
        targetDirectory: selectedInstallPath || undefined
      })
      if (result.success) {
        navigate('/download-manager')
      } else if (result.error) {
        throw new Error(result.error)
      }
    })
  }

  const handleConfirmReplacement = async () => {
    if (!replacementModal || !activeSource) return
    const modalData = replacementModal
    setReplacementModal(null)
    await run(async () => {
      const result = await window.api.externalGamesInstall({
        game: activeSource,
        sourceId: modalData.sourceId,
        replaceInstallationId: modalData.replaceId,
        targetDirectory: modalData.targetDirectory,
        confirmed: true
      })
      if (result.success) {
        navigate('/download-manager')
      } else if (result.error) {
        throw new Error(result.error)
      }
    })
  }

  return (
    <main className="externalGamesPage">
      <div className="externalGamesContainer">
        {/* TOP BAR UNIFICADA COM AUTOCOMPLETE FLUTUANTE */}
        <div className="searchRowWrapper">
          <div className="externalUnifiedSearchRow">
            <button
              type="button"
              className={`externalHomeBtn ${!searched && !activeGroup && !query ? 'active' : ''}`}
              onClick={handleResetToHome}
              title="Página Inicial de Destaques"
              aria-label="Página Inicial"
            >
              <FontAwesomeIcon icon={faHome} />
            </button>
            <div className="externalSearchInputWrapper">
              <FontAwesomeIcon icon={faSearch} />
              <input
                type="text"
                className="externalSearchInput"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setShowSuggestions(true)
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setShowSuggestions(false)
                    executeSearch(query)
                  }
                }}
                placeholder="Buscar Jogos (Ex: Marvel Tokon, inZOI, Dragon Ball, Elden Ring...)"
              />
            </div>
            <div
              className="externalFilterPills"
              onWheel={(e) => {
                if (e.deltaY !== 0) {
                  e.currentTarget.scrollLeft += e.deltaY
                }
              }}
            >
              <button
                type="button"
                className={`externalPill ${!provider ? 'active' : ''}`}
                onClick={() => setProvider('')}
              >
                <FontAwesomeIcon icon={faLayerGroup} style={{ fontSize: '13px' }} />
                <span>Todos</span>
                {searched && search.games.length > 0 && (
                  <span className="pillCountBadge">{search.games.length}</span>
                )}
              </button>
              {plugins.map((plugin) => {
                const storeCount = search.games.filter((g) => isMatchingProvider(g.providerId, plugin.id)).length
                const isActive = provider === plugin.id || isMatchingProvider(provider, plugin.id)
                return (
                  <button
                    type="button"
                    key={plugin.id}
                    className={`externalPill ${isActive ? 'active' : ''}`}
                    onClick={() => setProvider(isActive ? '' : plugin.id)}
                  >
                    {renderProviderIcon(
                      plugin.id,
                      plugin.name,
                      plugin.homepage ? `${plugin.homepage}/favicon.ico` : undefined,
                      13
                    )}
                    <span>{plugin.name}</span>
                    {searched && storeCount > 0 && (
                      <span className="pillCountBadge">{storeCount}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* AUTOCOMPLETE DROPDOWN */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="searchSuggestionsDropdown">
              <div className="suggestionHeader">
                <FontAwesomeIcon icon={faLightbulb} style={{ color: '#00ffff' }} />
                <span>Sugestões Rápidas</span>
              </div>
              {suggestions.map((item) => (
                <div
                  key={item}
                  className="suggestionItem"
                  onMouseDown={() => {
                    setQuery(item)
                    setShowSuggestions(false)
                    executeSearch(item)
                  }}
                >
                  <span className="suggestionTitle">{item}</span>
                  <FontAwesomeIcon icon={faSearch} style={{ fontSize: '12px', color: '#64748b' }} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* NOTICES OU ERROS */}
        {(message || error) && (
          <div className="externalNotice" role="status" style={{ marginBottom: '16px', borderRadius: '10px' }}>
            {message || error}
          </div>
        )}

        {!plugins.length ? (
          <section className="externalPanel">
            <FontAwesomeIcon icon={faPuzzlePiece} />
            <h2>Ative uma fonte de jogos</h2>
            <p>Instale um plugin de fonte para começar a buscar.</p>
            <Link to="/plugins">Abrir Plugins</Link>
          </section>
        ) : (
          <>
            {/* SEARCH ERRORS SE HOUVER */}
            {search.errors
              .filter((item) => !provider || item.providerId === provider)
              .map((item) => (
                <div key={item.providerId} className="externalNotice" style={{ marginBottom: '10px', borderRadius: '8px' }}>
                  {item.providerName}: {item.message}
                </div>
              ))}

            {/* NOVO HERO SHOWCASE E VITRINE MODERNA DE JOGOS DESTAQUES (APENAS HOME) */}
            {!searched && !activeGroup && (
              <div className="ghostHomeContainer">
                {/* 1. HERO SHOWCASE CINEMÁTICO WIDESCREEN */}
                {(() => {
                  const spotlight = HOME_SPOTLIGHT_GAMES[spotlightIndex] || HOME_SPOTLIGHT_GAMES[0]
                  return (
                    <div className="homeModernHeroBanner">
                      <div
                        className="modernHeroBackdrop"
                        style={{
                          backgroundImage: `linear-gradient(to right, #080c12 0%, rgba(8, 12, 18, 0.45) 55%, rgba(8, 12, 18, 0.9) 100%), url(${spotlight.backdropUrl})`
                        }}
                      />
                      <div className="modernHeroContent">
                        <div className="modernHeroBadgeRow">
                          <span className="modernHeroFireTag">
                            <FontAwesomeIcon icon={faFire} /> Jogo da Semana
                          </span>
                          <div className="modernHeroPillsRow">
                            {spotlight.tags.map((tag) => (
                              <span key={tag} className="modernHeroMetaPill">
                                {tag === 'PC Windows' && <FontAwesomeIcon icon={faWindows} style={{ marginRight: '5px' }} />}
                                {tag.includes('Multiplayer') && <FontAwesomeIcon icon={faUsers} style={{ marginRight: '5px' }} />}
                                {tag.includes('GhostShield') && <FontAwesomeIcon icon={faShieldAlt} style={{ marginRight: '5px' }} />}
                                {tag.includes('Switch') && <FontAwesomeIcon icon={faGamepad} style={{ marginRight: '5px' }} />}
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>

                        <h1 className="modernHeroTitle">{spotlight.title}</h1>
                        <p className="modernHeroDesc">{spotlight.game.description}</p>

                        <div className="modernHeroActionRow">
                          <button
                            type="button"
                            className="modernHeroPrimaryBtn"
                            onClick={() => handleSelectHomeGame(spotlight.game)}
                          >
                            <FontAwesomeIcon icon={faDownload} />
                            <span>Baixar e Instalar</span>
                          </button>
                          <button
                            type="button"
                            className="modernHeroSecondaryBtn"
                            onClick={() => handleOpenSpotlightTrailer(spotlight.game)}
                          >
                            <FontAwesomeIcon icon={faPlay} style={{ color: '#ff3344' }} />
                            <span>Assistir Gameplay</span>
                          </button>
                        </div>
                      </div>

                      {/* INDICADOR DE PONTOS DO CARROSSEL */}
                      <div className="modernHeroDots">
                        {HOME_SPOTLIGHT_GAMES.map((item, idx) => (
                          <button
                            key={item.id}
                            type="button"
                            className={`modernHeroDot ${idx === spotlightIndex ? 'active' : ''}`}
                            onClick={() => setSpotlightIndex(idx)}
                            aria-label={`Ver ${item.title}`}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })()}

                {/* 2. PRATELEIRAS HORIZONTAIS COM CARDS POR LOJA SUPORTADA */}
                <div className="modernStoreShelvesSection">
                  <div className="modernShelvesMainTitle">
                    <FontAwesomeIcon icon={faLayerGroup} style={{ color: '#00ffff' }} />
                    <span>Destaques por Loja</span>
                  </div>

                  {STORE_HIGHLIGHT_SHELVES.map((shelf) => (
                    <div key={shelf.id} className="modernShelfSection" id={`shelf-scroll-wrapper-${shelf.id}`}>
                      <div className="modernShelfHeader">
                        <div className="modernShelfTitleGroup">
                          <div className={`modernShelfIconWrapper ${shelf.theme}`}>
                            {shelf.id === 'ankergames' ? (
                              <img src={ankerLogo} alt="Anker" style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
                            ) : shelf.id === 'steamrip' ? (
                              <img src={steamripLogo} alt="SteamRIP" style={{ width: '18px', height: '18px', borderRadius: '50%' }} />
                            ) : shelf.id === 'onlinefix' ? (
                              <FontAwesomeIcon icon={faTools} style={{ color: '#00e5ff', fontSize: '15px' }} />
                            ) : (
                              <FontAwesomeIcon icon={faGamepad} style={{ color: '#e52521', fontSize: '16px' }} />
                            )}
                          </div>
                          <div className="modernShelfTitleText">
                            <h3>
                              {shelf.name}
                              <span className={`modernShelfTagBadge ${shelf.theme}`}>{shelf.tag}</span>
                            </h3>
                            <span>{shelf.subtitle}</span>
                          </div>
                        </div>

                        <div className="modernShelfControls">
                          <button
                            type="button"
                            className="modernShelfNavBtn"
                            onClick={() => scrollShelf(shelf.id, 'left')}
                            title="Rolar para esquerda"
                          >
                            <FontAwesomeIcon icon={faChevronLeft} />
                          </button>
                          <button
                            type="button"
                            className="modernShelfNavBtn"
                            onClick={() => scrollShelf(shelf.id, 'right')}
                            title="Rolar para direita"
                          >
                            <FontAwesomeIcon icon={faChevronRight} />
                          </button>
                        </div>
                      </div>

                      <div
                        id={`shelf-scroll-${shelf.id}`}
                        className="modernShelfScroll"
                        onWheel={(e) => {
                          if (e.deltaY !== 0) {
                            e.currentTarget.scrollLeft += e.deltaY
                          }
                        }}
                      >
                        {shelf.games.map((g) => (
                          <div
                            key={`${g.providerId}:${g.id}`}
                            className={`modernStoreCard ${shelf.theme}`}
                            onClick={() => handleSelectHomeGame(g)}
                          >
                            <div className="modernStoreCoverWrapper">
                              <CachedImage
                                className="modernStoreCoverImg"
                                src={g.coverUrl || fallbackImage}
                                fallback={fallbackImage}
                                alt={g.title}
                                loading="lazy"
                                decoding="async"
                              />
                              <div className={`modernStoreBadgeOnCover ${shelf.theme}`}>
                                {renderProviderIcon(g.providerId, g.providerName, undefined, 12)}
                                <span>{g.providerName}</span>
                              </div>
                              {shelf.id === 'onlinefix' && (
                                <div className="modernMultiplayerBadgeOnCover">
                                  <FontAwesomeIcon icon={faUsers} /> Multiplayer
                                </div>
                              )}
                              <div className="modernCardHoverAction">
                                <FontAwesomeIcon icon={faDownload} /> Baixar
                              </div>
                            </div>

                            <div className="modernStoreCardInfo">
                              <div className="modernStoreCardTitle">{getCanonicalGameTitle(g.title)}</div>
                              <div className="modernStoreCardMeta">
                                <span className="modernCardVersion">{g.version ? `v${g.version}` : (g.genre || 'Ação')}</span>
                                <span className="modernCardSize">{g.size || '35 GB'}</span>
                              </div>
                              <div className="modernStoreCardCracker">
                                <span>{g.cracker || 'Ghost Verificado'}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* JOGO NÃO ENCONTRADO */}
            {searched && !games.length && (
              <div className="externalEmptyState">
                <p>Nenhum jogo encontrado para &ldquo;{query}&rdquo;. Verifique o termo digitado ou ative mais fontes em Plugins.</p>
              </div>
            )}

            {/* HERO CARD PRINCIPAL (100% FIEL AO MOCKUP CYBER NEON E ANKERGAMES) */}
            {activeGroup && activeSource && (
              <div className="externalHeroCard">
                <div className="externalHeroGlowBg" />
                <div className="externalHeroGlowPurple" />

                {/* POSTER 3D VERTICAL COM BOTÃO ASSISTIR GAMEPLAY LOGO ABAIXO */}
                <div className="externalHeroPosterCol">
                  <div className="externalHeroPosterWrapper">
                    <CachedImage
                      className="externalHeroPosterImg"
                      src={activeGroup.coverUrl || fallbackImage}
                      fallback={fallbackImage}
                      alt={activeGroup.canonicalTitle}
                      loading="eager"
                      decoding="async"
                    />
                  </div>
                  <button
                    type="button"
                    className="externalGameplayBtn"
                    onClick={handleOpenYoutubeModal}
                  >
                    <FontAwesomeIcon icon={faPlay} /> Assistir Gameplay
                  </button>
                </div>

                {/* COLUNA DE DETALHES (DIREITA) */}
                <div className="externalHeroDetailsCol">
                  {/* TÍTULO PRINCIPAL */}
                  <h1 className="externalHeroTitle">{activeGroup.canonicalTitle}</h1>

                  {/* METADATA BADGES (LOGO ABAIXO DO TÍTULO) */}
                  <div className="externalHeroMetaRow">
                    <span className="externalMetaTag">
                      {activeSource.genre ? activeSource.genre.split(',')[0].trim() : inferCategoryTag(activeGroup.canonicalTitle)}
                    </span>
                    <span className="externalMetaTag">
                      <FontAwesomeIcon icon={faDownload} /> Download: {activeSource.size || activeGroup.size || '35 GB'}
                    </span>
                    {Boolean((activeSource.installedSize || activeGroup.installedSize) &&
                     (activeSource.installedSize || activeGroup.installedSize) !== (activeSource.size || activeGroup.size)) && (
                      <span className="externalMetaTag">
                        <FontAwesomeIcon icon={faHardDrive} /> Espaço em Disco: {activeSource.installedSize || activeGroup.installedSize}
                      </span>
                    )}
                    <span className="externalMetaTag">
                      <FontAwesomeIcon icon={activeGroup.platform === 'switch' ? faGamepad : faWindows} />{' '}
                      {activeGroup.platform === 'switch' ? 'Nintendo Switch' : 'PC Windows'}
                    </span>
                    <span className="externalMetaTag">
                      {activeSource.mode ? (
                        activeSource.mode.toLowerCase().includes('multiplayer') ||
                        activeSource.mode.toLowerCase().includes('co-op') ? (
                          <>
                            <FontAwesomeIcon icon={faUsers} /> {activeSource.mode}
                          </>
                        ) : (
                          <>
                            <FontAwesomeIcon icon={faUser} /> {activeSource.mode}
                          </>
                        )
                      ) : activeSource.providerId.includes('onlinefix') ? (
                        <>
                          <FontAwesomeIcon icon={faUsers} /> Multiplayer / Co-op
                        </>
                      ) : (
                        <>
                          <FontAwesomeIcon icon={faUser} /> Singleplayer
                        </>
                      )}
                    </span>
                    {/* DATA EXPLÍCITA DE LANÇAMENTO */}
                    <span className="externalMetaTag">
                      <FontAwesomeIcon icon={faCalendarAlt} />{' '}
                      Lançamento: {formatPublicationDate(activeSource.releaseDate || activeGroup.releaseDate) || '2024'}
                    </span>
                    {/* DATA EXPLÍCITA DE ATUALIZAÇÃO */}
                    <span className="externalMetaTag">
                      <FontAwesomeIcon icon={faSyncAlt} />{' '}
                      Atualizado em: {formatPublicationDate(activeSource.uploadDate) || 'Recente'}
                    </span>
                  </div>

                  {/* AVALIAÇÃO & REVIEW (ESTILO ANKERGAMES) */}
                  <div className="ratingReviewRow">
                    <div className="starsGroup">
                      <span>⭐⭐⭐⭐⭐</span>
                      <strong style={{ color: '#fff', marginLeft: '4px' }}>{activeSource.rating || '5.0/5'}</strong>
                    </div>
                    <div className="recommendBadge">
                      <FontAwesomeIcon icon={faThumbsUp} /> {activeSource.recommendPercent || '100%'} Recomendam
                    </div>
                  </div>

                  {/* SINOPSE / DESCRIÇÃO UNIFICADA EM PORTUGUÊS */}
                  <div className="gameDescriptionBox">
                    {portugueseDescriptions[activeGroup.key] ||
                      activeGroup.description ||
                      getGameDescription(activeGroup.mainGame)}
                  </div>

                  {/* GRID DE CHIPS DE DADOS TÉCNICOS */}
                  <div className="richMetaGrid">
                    <div className="richMetaChip">
                      <span className="richMetaLabel">Download</span>
                      <span className="richMetaValue">{activeSource.size || activeGroup.size || '35 GB'}</span>
                    </div>
                    {Boolean(activeSource.installedSize || activeGroup.installedSize) && (
                      <div className="richMetaChip">
                        <span className="richMetaLabel">Espaço em Disco</span>
                        <span className="richMetaValue">{activeSource.installedSize || activeGroup.installedSize}</span>
                      </div>
                    )}
                    <div className="richMetaChip">
                      <span className="richMetaLabel">Cracker</span>
                      <span className="richMetaValue">{getCardCracker(activeSource)}</span>
                    </div>
                    <div className="richMetaChip">
                      <span className="richMetaLabel">Uploader</span>
                      <span className="richMetaValue">{activeSource.uploader || 'SteamRIP / Ghost'}</span>
                    </div>
                    <div className="richMetaChip">
                      <span className="richMetaLabel">Desenvolvedor</span>
                      <span className="richMetaValue">{activeSource.developer || 'Estúdio Oficial'}</span>
                    </div>
                    <div className="richMetaChip">
                      <span className="richMetaLabel">Distribuidora</span>
                      <span className="richMetaValue">{activeSource.publisher || 'Publisher'}</span>
                    </div>
                    <div className="richMetaChip">
                      <span className="richMetaLabel">Steam Deck</span>
                      <span className="richMetaValue">{activeSource.deckCompatibility || 'Compatível (Verificado)'}</span>
                    </div>
                    <div className="richMetaChip">
                      <span className="richMetaLabel">Controle</span>
                      <span className="richMetaValue">{activeSource.controllerSupport || 'Suporte Completo'}</span>
                    </div>
                  </div>

                  {/* COMPARADOR DE FONTES LADO A LADO */}
                  <div className="externalSectionLabel">Fontes disponíveis para download</div>
                  <div className="sourceCompareGrid">
                    {activeGroup.allSources.map((src) => {
                      const isSelected =
                        activeSource.id === src.id &&
                        activeSource.providerId === src.providerId
                      const cardCracker = getCardCracker(src)
                      const cardDate = formatPublicationDate(src.uploadDate)
                      const cardSub = `${cardCracker}${cardDate ? ` · ${cardDate.split(' de ')[0]} ${cardDate.split(' de ')[1] || ''}` : ''}`
                      return (
                        <button
                          type="button"
                          key={`${src.providerId}:${src.id}`}
                          className={`sourceCompareCard ${isSelected ? 'active' : ''}`}
                          onClick={() => {
                            setSelected(src)
                            void details(src)
                          }}
                        >
                          <div className="sourceCompareCardTop">
                            <span className="sourceCompareName">
                              {renderProviderIcon(src.providerId, src.providerName, src.providerIcon)}
                              <span>{src.providerName}</span>
                            </span>
                            {isSelected ? (
                              <span className="sourceCompareBadgeChecked">
                                <FontAwesomeIcon icon={faCheck} />
                              </span>
                            ) : (
                              <span className="sourceCompareBadgeEmpty" />
                            )}
                          </div>
                          <div className="sourceCompareVer">{getCardVersion(src)}</div>
                          <div className="sourceCompareSub" style={{ fontSize: '11px', color: '#00ffff', fontWeight: 600 }}>
                            {getCardBuildAndSize(src)}
                          </div>
                          <div className="sourceCompareSub" style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                            {cardSub}
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  {/* STATUS INTELIGENTE + BOTÕES EMPILHADOS À DIREITA */}
                  <div className="externalSectionLabel">Status inteligente</div>
                  {(() => {
                    const instStatus = currentInstStatus
                    const isUpdate = instStatus.status === 'update_available'
                    const isMigrate = instStatus.status === 'migrate_available'
                    const isUpToDate = instStatus.status === 'installed_up_to_date'

                    let statusBoxClass = 'smartStatusBox notInstalled'
                    let statusIcon = faDownload
                    let statusTitle = 'Pronto para Download e Instalação'
                    let statusVerText = `${getCardVersion(activeSource)} · Instalação automatizada`
                    let shieldText = 'Proteção GhostShield ativada'
                    let primaryBtnClass = 'smartPrimaryBtn cyan'
                    let primaryBtnIcon = faDownload
                    let primaryBtnLabel = 'Baixar e Instalar'

                    if (isUpdate) {
                      statusBoxClass = 'smartStatusBox update'
                      statusIcon = faSyncAlt
                      statusTitle = 'Atualização Disponível'
                      statusVerText = `v${instStatus.currentVersion || '1.2.0'} → ${getCardVersion(activeSource)}`
                      shieldText = 'Backup de saves automático'
                      primaryBtnClass = 'smartPrimaryBtn cyan'
                      primaryBtnIcon = faBolt
                      primaryBtnLabel = 'Atualizar Agora'
                    } else if (isMigrate) {
                      statusBoxClass = 'smartStatusBox migrate'
                      statusIcon = faExchangeAlt
                      statusTitle = 'Migração de Loja Disponível'
                      statusVerText = `${instStatus.installedGame?.game.providerName} → ${activeSource.providerName}`
                      shieldText = 'Restauração automática de saves'
                      primaryBtnClass = 'smartPrimaryBtn amber'
                      primaryBtnIcon = faExchangeAlt
                      primaryBtnLabel = 'Migrar e Atualizar'
                    } else if (isUpToDate) {
                      statusBoxClass = 'smartStatusBox upToDate'
                      statusIcon = faCheckCircle
                      statusTitle = 'Instalado e Atualizado'
                      statusVerText = `${instStatus.currentVersion || getCardVersion(activeSource)} · Versão mais recente`
                      shieldText = 'Sincronização de integridade ativa'
                      primaryBtnClass = 'smartPrimaryBtn emerald'
                      primaryBtnIcon = faPlay
                      primaryBtnLabel = 'Jogar Agora'
                    }

                    return (
                      <>
                        <div className="smartStatusRow">
                          <div className={statusBoxClass}>
                            <div className="smartStatusIconWrapper">
                              <FontAwesomeIcon icon={statusIcon} />
                            </div>
                            <div className="smartStatusTextWrapper">
                              <div className="smartStatusMainTitle">{statusTitle}</div>
                              <div className="smartStatusSubVer">{statusVerText}</div>
                              <div className="smartStatusShieldNotice">
                                <FontAwesomeIcon icon={faShieldAlt} />
                                <span>{shieldText}</span>
                              </div>
                            </div>
                          </div>

                          <div className="smartStatusActionCol">
                            <button
                              type="button"
                              className={primaryBtnClass}
                              disabled={busy}
                              onClick={handlePrimaryAction}
                            >
                              <FontAwesomeIcon icon={primaryBtnIcon} />
                              <span>{primaryBtnLabel}</span>
                            </button>
                            <button
                              type="button"
                              className="smartSecondaryBtn"
                              onClick={() => setShowDownloadOptions((prev) => !prev)}
                            >
                              Opções de Download
                            </button>
                          </div>
                        </div>

                        {message && (
                          <div className="externalNotice" role="alert">
                            <p>{message}</p>
                            {activeSource.providerId.toLowerCase().includes('anker') && (
                              <Link to="/settings/download-integrations">Configurar AnkerGames e TorBox</Link>
                            )}
                          </div>
                        )}

                        {/* SELETOR DE PASTAS DE INSTALAÇÃO (LAYOUT EM 2 LINHAS - 100% LARGURA SUPERIOR E BOTÕES INFERIORES) */}
                        <div className="installPathSelectorBox">
                          {/* LINHA 1: Rótulo e Dropdown com 100% de largura livre */}
                          <div className="installPathTopRow">
                            <span className="installPathLabel">
                              <FontAwesomeIcon icon={faHardDrive} /> Instalar em:
                            </span>
                            <select
                              className="installPathSelect"
                              value={selectedInstallPath}
                              onChange={(e) => handleSelectInstallPath(e.target.value)}
                            >
                              {effectiveInstallPaths.map((p) => {
                                const isInstalledFolder =
                                  Boolean(installedDirectory) &&
                                  p.trim().toLowerCase() ===
                                    installedDirectory?.trim().toLowerCase()
                                return (
                                  <option key={p} value={p}>
                                    {isInstalledFolder
                                      ? `${p} (Pasta Atual do Jogo)`
                                      : p}
                                  </option>
                                )
                              })}
                            </select>
                          </div>

                          {/* LINHA 2: Botões de Ação com Espaçamento Amplo (Pular de Linha) */}
                          <div className="installPathBottomRow">
                            <div className="installPathSummaryInfo">
                              <FontAwesomeIcon icon={faFolder} />
                              <span>
                                Pastas salvas no launcher: <strong>{installPaths.length}</strong>
                              </span>
                            </div>

                            <div className="installPathActionsGroup">
                              <button
                                type="button"
                                className="addPathBtn"
                                title="Adicionar nova pasta de instalação estilo Steam"
                                onClick={handleAddInstallPath}
                              >
                                <FontAwesomeIcon icon={faPlus} /> Adicionar Pasta
                              </button>
                              <button
                                type="button"
                                className="managePathsBtn"
                                title="Gerenciar e excluir pastas salvas de instalação"
                                onClick={() => setShowPathsManagerModal(true)}
                              >
                                <FontAwesomeIcon icon={faCog} /> Gerenciar Pastas
                                <span className="managePathsBadge">{installPaths.length}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                        {installedDirectory &&
                          selectedInstallPath.trim().toLowerCase() ===
                            installedDirectory.trim().toLowerCase() && (
                            <div className="installPathDetectedBadge">
                              <FontAwesomeIcon icon={faCheckCircle} /> Pasta do jogo instalada detectada no computador. Atualização direta in-place.
                            </div>
                          )}
                        {installedDirectory &&
                          selectedInstallPath.trim().toLowerCase() !==
                            installedDirectory.trim().toLowerCase() && (
                            <div className="installPathChangeNotice">
                              <FontAwesomeIcon icon={faExchangeAlt} /> Nova pasta selecionada. A nova versão será instalada no diretório escolhido.
                            </div>
                          )}

                        {/* DRAWER DE ESPELHOS/OPÇÕES DE DOWNLOAD */}
                        {showDownloadOptions && (
                          <div className="heroDownloadOptionsDrawer">
                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>
                              Servidores e espelhos disponíveis ({sources.length}):
                            </div>
                            {sources.length === 0 ? (
                              <div style={{ fontSize: '13px', color: '#94a3b8', padding: '6px 0' }}>
                                Nenhum espelho direto retornado pela fonte. O download principal usará o servidor padrão.
                              </div>
                            ) : (
                              sources.map((s) => (
                                <div className="heroDownloadOptionItem" key={s.id}>
                                  <span style={{ fontWeight: 600 }}>{s.name}</span>
                                  <button
                                    type="button"
                                    className="heroSecondaryBtn"
                                    style={{ padding: '6px 14px', fontSize: '12px' }}
                                    disabled={busy}
                                    onClick={() => void handleInstallFromSource(s.id)}
                                  >
                                    <FontAwesomeIcon icon={faDownload} /> Baixar deste servidor
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </>
                    )
                  })()}
                </div>
              </div>
            )}

            {/* MINI-GRID DE OUTROS JOGOS ENCONTRADOS */}
            {groupedGames.length > 1 && (
              <section className="otherGamesSection">
                <span className="externalSectionLabel">
                  Outros jogos encontrados ({groupedGames.length - 1}):
                </span>
                <div className="otherGamesGrid">
                  {groupedGames
                    .filter((g) => g.key !== activeGroup?.key)
                    .map((g) => (
                      <button
                        type="button"
                        key={g.key}
                        className="otherGameMiniCard"
                        onClick={() => {
                          setSelectedGroupKey(g.key)
                          setSelected(g.mainGame)
                          void details(g.mainGame)
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                      >
                        <CachedImage
                          className="otherGameMiniCover"
                          src={g.coverUrl || fallbackImage}
                          fallback={fallbackImage}
                          alt={g.canonicalTitle}
                          loading="lazy"
                          decoding="async"
                        />
                        <div className="otherGameMiniInfo">
                          <h4 className="otherGameMiniTitle">{g.canonicalTitle}</h4>
                          <p className="otherGameMiniSub">
                            {g.allSources.length}{' '}
                            {g.allSources.length === 1 ? 'fonte' : 'fontes'} ·{' '}
                            {g.platform === 'switch' ? 'Switch' : 'PC Windows'}
                          </p>
                        </div>
                      </button>
                    ))}
                </div>
              </section>
            )}

            {/* GERENCIAMENTO DE JOGOS INSTALADOS (SE HOUVER) */}
            {!!state.installations.length && (
              <div className="externalAdvancedFooter">
                <details className="externalAdvancedDetails">
                  <summary>Gerenciar jogos externos instalados ({state.installations.length})</summary>
                  <div className="externalAdvancedBody">
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      Jogo
                      <select
                        value={replacement}
                        onChange={(event) => {
                          setReplacement(event.target.value)
                          setSelected(undefined)
                        }}
                      >
                        <option value="">Selecione um jogo</option>
                        {state.installations.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.game.title} · {item.game.providerName}
                          </option>
                        ))}
                      </select>
                    </label>
                    {installation && (
                      <div style={{ marginTop: '14px' }}>
                        <p>
                          Fonte principal: {installation.game.providerName} · {installation.game.version || 'Versão não identificada'}
                        </p>
                        <p className="externalPath">
                          Saves: {installation.savePath || 'Pasta ainda não configurada'}
                        </p>
                        <div className="externalActions" style={{ marginTop: '12px' }}>
                          <button
                            disabled={busy}
                            onClick={() =>
                              void action({
                                type: 'check-update',
                                installationId: installation.id
                              })
                            }
                          >
                            Verificar atualização na fonte
                          </button>
                          <button
                            disabled={busy}
                            onClick={() =>
                              void action({
                                type: 'configure-saves',
                                installationId: installation.id
                              })
                            }
                          >
                            Escolher pasta de saves
                          </button>
                          <button
                            disabled={busy || !installation.savePath}
                            onClick={() =>
                              void action({
                                type: 'backup',
                                installationId: installation.id
                              })
                            }
                          >
                            Fazer backup
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              </div>
            )}
          </>
        )}

        {/* MODAL DO YOUTUBE GAMEPLAY (REGRA 12 FECHAMENTO) */}
        {youtubeModalOpen && activeGroup && (
          <div className="ghostYoutubeModalOverlay" onClick={() => setYoutubeModalOpen(false)}>
            <div className="ghostYoutubeModalCard" onClick={(e) => e.stopPropagation()}>
              <div className="ghostYoutubeModalHeader">
                <div className="ghostYoutubeModalTitle">
                  <FontAwesomeIcon icon={faYoutube} style={{ color: '#ff0000', fontSize: '20px' }} />
                  <span>Gameplay & Trailer — {activeGroup.canonicalTitle}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {currentVideoId && (
                    <button
                      type="button"
                      className="ghostYoutubeExternalBtn"
                      onClick={() =>
                        window.api.openExternalUrl(`https://www.youtube.com/watch?v=${currentVideoId}`)
                      }
                      title="Abrir no navegador"
                    >
                      <FontAwesomeIcon icon={faExternalLinkAlt} />
                      <span>Abrir no YouTube</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="ghostYoutubeModalCloseBtn"
                    onClick={() => setYoutubeModalOpen(false)}
                    aria-label="Fechar"
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>
              </div>
              <div className="ghostYoutubeVideoWrapper">
                {youtubeLoading ? (
                  <div className="ghostYoutubeLoading">
                    <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: '36px', color: '#00ffff' }} />
                    <p>Buscando trailer e gameplay oficial no YouTube...</p>
                  </div>
                ) : currentVideoId ? (
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${currentVideoId}?autoplay=1`}
                    title={`Gameplay ${activeGroup.canonicalTitle}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div className="ghostYoutubeFallback">
                    <FontAwesomeIcon icon={faYoutube} style={{ fontSize: '52px', color: '#ff4444' }} />
                    <p>Prévia embutida não disponível diretamente.</p>
                    <button
                      type="button"
                      className="ghostYoutubeFallbackBtn"
                      onClick={() =>
                        window.api.openExternalUrl(
                          `https://www.youtube.com/results?search_query=${encodeURIComponent(
                            `${activeGroup.canonicalTitle} gameplay trailer`
                          )}`
                        )
                      }
                    >
                      <FontAwesomeIcon icon={faPlay} />
                      <span>Assistir Gameplay no YouTube</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MODAL CYBER NEON: TROCA DE FONTE / ATUALIZAÇÃO (REGRA 12 FECHAMENTO) */}
        {replacementModal && replacementModal.isOpen && (
          <div
            className="ghostReplacementModalOverlay"
            onClick={() => setReplacementModal(null)}
          >
            <div
              className="ghostReplacementModalCard"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="ghostReplacementModalHeader">
                <div className="ghostReplacementModalTitle">
                  <FontAwesomeIcon
                    icon={replacementModal.operation === 'update' ? faSyncAlt : faExchangeAlt}
                    style={{ color: '#00ffff' }}
                  />
                  <span>
                    {replacementModal.operation === 'update'
                      ? 'Atualizar Jogo Externo'
                      : 'Trocar Fonte de Instalação'}
                  </span>
                </div>
                <button
                  type="button"
                  className="ghostReplacementModalCloseBtn"
                  onClick={() => setReplacementModal(null)}
                  aria-label="Fechar"
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>

              <div className="ghostReplacementCompareRow">
                <div className="ghostReplacementGameCard oldSource">
                  <span className="sourceTag">Fonte Atual (Instalada)</span>
                  <h4 className="gameTitle">{replacementModal.oldGame.title}</h4>
                  <div className="badgeRow">
                    <span className="providerBadge">{replacementModal.oldGame.providerName}</span>
                    {replacementModal.oldGame.version && (
                      <span className="versionBadge">{replacementModal.oldGame.version}</span>
                    )}
                  </div>
                </div>

                <div className="ghostReplacementArrow">
                  <FontAwesomeIcon icon={faArrowRight} />
                </div>

                <div className="ghostReplacementGameCard newSource">
                  <span className="sourceTag">Nova Fonte (Alvo)</span>
                  <h4 className="gameTitle">{replacementModal.newGame.title}</h4>
                  <div className="badgeRow">
                    <span className="providerBadge new">{replacementModal.newGame.providerName}</span>
                    {replacementModal.newGame.version && (
                      <span className="versionBadge new">{replacementModal.newGame.version}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="ghostReplacementNotice">
                <div className="shieldIcon">
                  <FontAwesomeIcon icon={faShieldAlt} />
                </div>
                <div className="shieldContent">
                  <strong>🛡️ Proteção de Saves GhostShield Ativa</strong>
                  <p>
                    Confirme que se trata do mesmo jogo e de uma edição compatível. A reinstalação será limpa: mods e configurações não serão migrados. <strong>Os saves terão backup automático</strong>; a compatibilidade entre fontes depende do jogo.
                  </p>
                </div>
              </div>

              {(replacementModal.targetDirectory || replacementModal.oldGame.directory) && (
                <div className="ghostReplacementFolderInfo">
                  <FontAwesomeIcon icon={faFolderOpen} />
                  <span>
                    Instalar em: <strong>{replacementModal.targetDirectory || replacementModal.oldGame.directory}</strong>
                  </span>
                </div>
              )}

              <div className="ghostReplacementModalFooter">
                <button
                  type="button"
                  className="ghostReplacementBtnCancel"
                  onClick={() => setReplacementModal(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="ghostReplacementBtnConfirm"
                  onClick={handleConfirmReplacement}
                >
                  <FontAwesomeIcon icon={replacementModal.operation === 'update' ? faSyncAlt : faCheckCircle} />
                  <span>
                    {replacementModal.operation === 'update'
                      ? 'Atualizar e Preservar Saves'
                      : 'Reinstalar e Preservar Saves'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL CYBER NEON: GERENCIADOR DE PASTAS DE INSTALAÇÃO (REGRAS 12 E 53 - ZERO EMOJIS, 100% SVG) */}
        {showPathsManagerModal && (
          <div
            className="ghostPathsModalOverlay"
            onClick={() => setShowPathsManagerModal(false)}
          >
            <div
              className="ghostPathsModalCard"
              onClick={(e) => e.stopPropagation()}
            >
              {/* CABEÇALHO DO MODAL */}
              <div className="ghostPathsModalHeader">
                <div className="ghostPathsModalTitleGroup">
                  <div className="ghostPathsModalIcon">
                    <FontAwesomeIcon icon={faFolderOpen} />
                  </div>
                  <div className="ghostPathsModalTitles">
                    <h3>Gerenciador de Pastas de Instalação</h3>
                    <p>Exclua diretórios antigos ou de teste para manter a lista limpa e organizada.</p>
                  </div>
                </div>
                {/* Botão Fechar Regra 12: SVG faTimes sem moldura */}
                <button
                  type="button"
                  className="ghostPathsModalCloseBtn"
                  onClick={() => setShowPathsManagerModal(false)}
                  aria-label="Fechar"
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>

              {/* DESTAQUE DA PASTA DO JOGO ATUAL (SE DETECTADA) */}
              {installedDirectory && (
                <div className="ghostPathsInstalledDirHighlight">
                  <div className="ghostPathsInstalledDirLeft">
                    <span className="installedDirIcon">
                      <FontAwesomeIcon icon={faCheckCircle} />
                    </span>
                    <div className="installedDirTexts">
                      <div className="installedDirTitle">Pasta Atual do Jogo (Detectada no Disco)</div>
                      <div className="installedDirPath" title={installedDirectory}>
                        {installedDirectory}
                      </div>
                    </div>
                  </div>
                  <span className="installedDirBadge">In-Place</span>
                </div>
              )}

              {/* LISTA DE PASTAS SALVAS NO LAUNCHER */}
              <div className="ghostPathsListSection">
                <div className="ghostPathsListHeader">
                  <span className="ghostPathsListTitle">
                    Pastas Salvas no Histórico
                    <span className="ghostPathsListCountBadge">{installPaths.length}</span>
                  </span>
                  <span className="ghostPathsListHint">Clique no ícone de lixeira para remover</span>
                </div>

                <div className="ghostPathsListContainer">
                  {installPaths.length === 0 ? (
                    <div className="ghostPathsEmptyState">
                      <FontAwesomeIcon icon={faFolder} />
                      <p>Nenhuma pasta personalizada cadastrada. O Ghost utilizará o diretório padrão.</p>
                    </div>
                  ) : (
                    installPaths.map((path) => {
                      const isCurrentSelected =
                        selectedInstallPath.trim().toLowerCase() === path.trim().toLowerCase()
                      return (
                        <div className="ghostPathItemRow" key={path}>
                          <div className="ghostPathItemInfo">
                            <span className="ghostPathItemIcon">
                              <FontAwesomeIcon icon={faFolder} />
                            </span>
                            <span className="ghostPathItemText" title={path}>
                              {path}
                            </span>
                            {isCurrentSelected && (
                              <span className="ghostPathItemActiveBadge">
                                <FontAwesomeIcon icon={faCheck} /> Ativa
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            className="ghostPathItemDeleteBtn"
                            title={`Excluir "${path}" da lista`}
                            onClick={() => handleDeleteSavedPath(path)}
                          >
                            <FontAwesomeIcon icon={faTrashAlt} />
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* RODAPÉ DE AÇÕES */}
              <div className="ghostPathsModalFooter">
                <div className="ghostPathsFooterLeftActions">
                  <button
                    type="button"
                    className="ghostPathsAddBtn"
                    onClick={handleAddInstallPath}
                  >
                    <FontAwesomeIcon icon={faPlus} />
                    <span>Adicionar Nova Pasta</span>
                  </button>
                  <button
                    type="button"
                    className="ghostPathsResetBtn"
                    title="Restaurar pastas padrão (C:\Ghost Games e D:\Jogos)"
                    onClick={handleResetSavedPaths}
                  >
                    <FontAwesomeIcon icon={faBroom} />
                    <span>Restaurar Padrões</span>
                  </button>
                </div>

                <button
                  type="button"
                  className="ghostPathsCloseActionBtn"
                  onClick={() => setShowPathsManagerModal(false)}
                >
                  <FontAwesomeIcon icon={faCheck} />
                  <span>Concluído</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

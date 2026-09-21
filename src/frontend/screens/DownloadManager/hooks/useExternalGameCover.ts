import { useContext, useEffect, useMemo, useState } from 'react'
import ContextProvider from 'frontend/state/ContextProvider'
import useGlobalState from 'frontend/state/GlobalStateV2'
import { gameOverridesStore } from 'frontend/helpers/electronStores'
import { getImageFormatting } from 'frontend/screens/Library/components/GameCard/constants'
import fallbackImage from 'frontend/assets/heroic_card.jpg'

// In-memory module cache to prevent repeated IPC and SteamGridDB network lookups
const sgdbCoverCache = new Map<string, string | null>()

/**
 * Normaliza o título do jogo para comparação sem ruídos de release/repack/edições.
 */
export function normalizeGameTitle(rawTitle: string): string {
  if (!rawTitle) return ''
  return rawTitle
    .toLowerCase()
    .replace(/[®™©]/g, '')
    .replace(/\[(?:fitgirl|repack|steam\.rip|p2p|nosteam|deadc0de|insaneramzes|gog|dvd|iso)[^\]]*\]/gi, '')
    .replace(/\((?:off\s*line\s*version|tradução|traducao|repack|portable|nosTEAM)[^)]*\)/gi, '')
    .replace(/[-.](?:P2P|nosTEAM|0xdeadc0de|InsaneRamZes|FitGirl|Dodi|EMPRESS|SKIDROW|CODEX|RELOADED|FLT|HOODLUM|PLAZA|RAZOR1911)$/gi, '')
    .replace(/(?:\bversion\b|\bbuild\b|\bver\b)?\s*v?\d+(?:\.\d+)+(?:[._-][a-z0-9]+)*/gi, '')
    .replace(/\s*(?:-|:)\s*(?:game of the year|goty|complete|definitive|special|deluxe|standard|gold|ultimate|collector'?s)\s*edition/gi, '')
    .replace(/\s+\(\d{4}\)/g, '')
    .replace(/\s*\[.*?\]/g, '')
    .replace(/\s*\(.*?\)/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

/**
 * Hook de resolução de capa para jogos de fontes externas com 3 níveis estritos de prioridade:
 * 1º Nível: Biblioteca do usuário (jogos já adicionados, instalados ou com custom art em gameOverrides);
 * 2º Nível: SteamGridDB (capa vertical comunitária oficial obtida via API);
 * 3º Nível: Site de onde foi baixado (capa da AnkerGames se baixado do Anker, ou do SteamRIP se baixado do SteamRIP).
 */
export function useExternalGameCover(
  title: string,
  siteCoverUrl?: string,
  installationAppName?: string
): {
  coverUrl: string
  isFromLibrary: boolean
  isFromSGDB: boolean
} {
  const { amazon, epic, gog, steam, zoom, sideloadedLibrary } = useContext(ContextProvider)
  const { gameOverrides } = useGlobalState.keys('gameOverrides')

  const allLibraryGames = useMemo(() => [
    ...(sideloadedLibrary || []),
    ...(steam?.library || []),
    ...(epic?.library || []),
    ...(gog?.library || []),
    ...(amazon?.library || []),
    ...(zoom?.library || [])
  ], [sideloadedLibrary, steam?.library, epic?.library, gog?.library, amazon?.library, zoom?.library])

  // 1. TIER 1: Biblioteca do Usuário
  const libraryCover = useMemo(() => {
    if (!title) return null
    const targetNorm = normalizeGameTitle(title)
    if (!targetNorm) return null

    const storeOverrides = (gameOverridesStore.get('overrides', {}) as Record<string, any>) || {}

    const extractCover = (
      gameOrKey: { app_name: string; runner?: string; overrides?: any; art_square?: string; art_cover?: string } | string,
      runnerHint = 'sideload'
    ): string | null => {
      const appName = typeof gameOrKey === 'string' ? gameOrKey : gameOrKey.app_name
      const runner = typeof gameOrKey === 'string' ? runnerHint : (gameOrKey.runner || runnerHint)
      const gameObj = typeof gameOrKey === 'string' ? undefined : gameOrKey

      const override = gameOverrides?.[appName] || storeOverrides[appName]
      const raw =
        override?.art_square ||
        override?.art_cover ||
        gameObj?.overrides?.art_square ||
        gameObj?.overrides?.art_cover ||
        gameObj?.art_square ||
        gameObj?.art_cover

      if (raw && typeof raw === 'string' && raw.trim() !== '' && !raw.includes('heroic_card') && !raw.includes('default_cover')) {
        return getImageFormatting(raw, runner as any) || raw
      }
      return null
    }

    // 1.1 Match estrito por installationAppName (prioridade máxima)
    if (installationAppName) {
      const directGame = allLibraryGames.find((g) => g.app_name === installationAppName)
      if (directGame) {
        const cover = extractCover(directGame)
        if (cover) return cover
      }
      const directOverrideCover = extractCover(installationAppName)
      if (directOverrideCover) return directOverrideCover
    }

    // 1.2 Coleta todos os candidatos com o mesmo título normalizado
    const candidates = allLibraryGames.filter((g) => {
      const gNorm = normalizeGameTitle(g.title)
      return gNorm === targetNorm || (gNorm.length > 3 && targetNorm.includes(gNorm)) || (targetNorm.length > 3 && gNorm.includes(targetNorm))
    })

    if (candidates.length > 0) {
      // Ordena com inteligência estrita:
      // (a) Jogos com arte personalizada manualmente pelo usuário (is_manual: true)
      // (b) Jogos da biblioteca de sideload / Piratas (origem das fontes externas)
      // (c) Jogos instalados
      candidates.sort((a, b) => {
        const aOv = (gameOverrides?.[a.app_name] || storeOverrides[a.app_name]) as any
        const bOv = (gameOverrides?.[b.app_name] || storeOverrides[b.app_name]) as any
        const aManual = aOv?.is_manual ? 1 : 0
        const bManual = bOv?.is_manual ? 1 : 0
        if (aManual !== bManual) return bManual - aManual

        const aSideload = a.runner === 'sideload' ? 1 : 0
        const bSideload = b.runner === 'sideload' ? 1 : 0
        if (aSideload !== bSideload) return bSideload - aSideload

        const aInst = a.is_installed ? 1 : 0
        const bInst = b.is_installed ? 1 : 0
        return bInst - aInst
      })

      for (const cand of candidates) {
        const cover = extractCover(cand)
        if (cover) return cover
      }
    }

    // 1.3 Procura em gameOverrides diretamente por título caso não esteja na biblioteca ativa
    for (const [appKey, override] of Object.entries(storeOverrides)) {
      if (override?.title && normalizeGameTitle(override.title) === targetNorm) {
        const cover = extractCover(appKey)
        if (cover) return cover
      }
    }

    return null
  }, [allLibraryGames, title, installationAppName, gameOverrides])

  // 2. TIER 2: SteamGridDB
  const [sgdbCover, setSgdbCover] = useState<string | null>(() => {
    if (!title) return null
    const norm = normalizeGameTitle(title)
    return sgdbCoverCache.get(norm) ?? null
  })

  useEffect(() => {
    // Se a capa da biblioteca do usuário já foi encontrada, não precisa consultar o SteamGridDB
    if (libraryCover || !title) return

    const norm = normalizeGameTitle(title)
    if (sgdbCoverCache.has(norm)) {
      setSgdbCover(sgdbCoverCache.get(norm) ?? null)
      return
    }

    let cancelled = false
    const fetchSGDB = async () => {
      try {
        if (window.api?.steamgriddb?.getCoverForGame) {
          const cover = await window.api.steamgriddb.getCoverForGame(title)
          if (!cancelled) {
            sgdbCoverCache.set(norm, cover || null)
            if (cover) {
              setSgdbCover(cover)
            }
          }
        }
      } catch {
        if (!cancelled) {
          sgdbCoverCache.set(norm, null)
        }
      }
    }

    void fetchSGDB()

    return () => {
      cancelled = true
    }
  }, [libraryCover, title])

  // 3. TIER 3: Site onde foi baixado (AnkerGames / SteamRIP / Online-Fix)
  const coverUrl = libraryCover || sgdbCover || siteCoverUrl || fallbackImage

  return {
    coverUrl,
    isFromLibrary: Boolean(libraryCover),
    isFromSGDB: !libraryCover && Boolean(sgdbCover)
  }
}

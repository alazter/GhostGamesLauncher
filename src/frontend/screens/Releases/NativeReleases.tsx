import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome'
import {
  faBell,
  faCalendarDays,
  faCircleCheck,
  faExpand,
  faCheck,
  faCloud,
  faFilm,
  faFire,
  faGamepad,
  faSearch,
  faTv,
  faXmark,
  faRotate,
  faDownload,
  faPlay,
  faBoxOpen
} from '@fortawesome/free-solid-svg-icons'
import {
  RELEASE_CATEGORIES,
  ReleaseCatalog,
  ReleaseProduct,
  ReleaseQuery,
  ReleaseRegion
} from 'common/types/releases'
import {
  getTrackedReleases,
  initializeReleaseTracking,
  releaseTrackingId,
  localReleaseDay,
  refreshTrackedProducts,
  restoreTrackedReleaseVersion,
  resumeTrackedReleaseUpdates,
  removeTrackedRelease,
  setTrackedReleaseNotifications,
  subscribeReleaseTracking,
  toggleReleaseTracking,
  TrackedRelease
} from 'frontend/helpers/releaseTracking'
import { syncLocalStorageToBackend } from 'frontend/utils/localStorageBackup'
import { checkTodayReleases } from 'frontend/helpers/releasesScanner'
import './native.css'
import './catalog.css'
import ReleaseNavigation from './ReleaseNavigation'
import ReleaseDetails from './ReleaseDetails'
import { ReleaseDrmBadge } from './ReleaseDrm'
import {
  drmBatchGames,
  refreshReleaseDrmBatch,
  DrmBatchProgress
} from 'frontend/helpers/releaseDrmRequests'
import ReleaseToolbar, {
  ReleaseLayout,
  ReleaseView,
  shortCalendarDate as shortDateText,
  relativeCalendarDate as relativeReleaseDate
} from './ReleaseToolbar'
import {
  appendReleasePage,
  filterReleasePlatforms,
  releaseCalendarSections,
  closestReleaseDate
} from 'common/releaseCatalog'
import { releaseVideoEmbed } from 'common/releaseMedia'

type View = ReleaseView
interface Preferences {
  category: string
  platforms: string[]
  platformsByCategory?: Record<string, string[]>
  region: ReleaseRegion
  layout: ReleaseLayout
  theme: 'dark' | 'light'
}
function preferences(): Preferences {
  try {
    let saved: Record<string, any> = {}
    const localRaw = localStorage.getItem('ghost_releases_preferences_v1')
    if (localRaw) {
      try {
        saved = JSON.parse(localRaw)
      } catch {
        saved = {}
      }
    }

    let storedConfig: Record<string, any> | undefined
    try {
      storedConfig = window.api?.storeGet?.('configStore', 'releasesPreferences') as
        | Record<string, any>
        | undefined
    } catch {
      storedConfig = undefined
    }

    const merged = {
      ...(storedConfig && typeof storedConfig === 'object' ? storedConfig : {}),
      ...(saved && typeof saved === 'object' ? saved : {})
    }

    const category = RELEASE_CATEGORIES.some((c) => c.id === merged.category)
      ? merged.category
      : 'games'

    const platformsByCategory: Record<string, string[]> = {}
    const sources = [storedConfig?.platformsByCategory, saved?.platformsByCategory]
    for (const source of sources) {
      if (source && typeof source === 'object') {
        for (const [cat, list] of Object.entries(source)) {
          if (Array.isArray(list)) {
            platformsByCategory[cat] = [
              ...new Set<string>(
                list.filter(
                  (value: unknown) =>
                    typeof value === 'string' && /^[a-z0-9-]{1,80}$/.test(value)
                )
              )
            ].slice(0, 50)
          }
        }
      }
    }

    const activeList = Array.isArray(merged.platforms)
      ? [
          ...new Set<string>(
            merged.platforms.filter(
              (value: unknown) =>
                typeof value === 'string' && /^[a-z0-9-]{1,80}$/.test(value)
            )
          )
        ].slice(0, 50)
      : typeof merged.platform === 'string' && merged.platform
        ? [merged.platform]
        : []

    if (activeList.length > 0 && !platformsByCategory[category]) {
      platformsByCategory[category] = activeList
    }

    const resolvedPlatforms =
      platformsByCategory[category] && platformsByCategory[category].length > 0
        ? platformsByCategory[category]
        : activeList

    return {
      category,
      platforms: resolvedPlatforms,
      platformsByCategory,
      region: merged.region === 'uk' ? 'uk' : 'us',
      layout: ['items', 'rows'].includes(merged.layout) ? merged.layout : 'cards',
      theme: merged.theme === 'light' ? 'light' : 'dark'
    }
  } catch {
    return {
      category: 'games',
      platforms: [],
      platformsByCategory: {},
      region: 'us',
      layout: 'cards',
      theme: 'dark'
    }
  }
}
const dateText = (date?: string, fallback = 'A confirmar') =>
  date
    ? new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    : fallback
const categoryIcon = (category: string) =>
  category === 'games'
    ? faGamepad
    : category === 'movies'
      ? faFilm
      : category === 'tv-series'
        ? faTv
        : faBoxOpen
const categoryName = (id: string) =>
  RELEASE_CATEGORIES.find((category) => category.id === id)?.label || id

function exportCalendar(entries: TrackedRelease[]) {
  const escape = (value: string) =>
    value
      .replace(/\\/g, '\\\\')
      .replace(/\r?\n/g, '\\n')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;')
  const events = new Map<string, string>()
  for (const entry of entries) {
    for (const release of entry.product.releases) {
      if (
        !release.date ||
        release.estimated ||
        release.region !== entry.region ||
        (entry.platform && release.platform !== entry.platform)
      )
        continue
      const id = `${entry.product.id}-${release.region}-${release.platform}-${release.date}`
      const end = new Date(`${release.date}T12:00:00`)
      end.setDate(end.getDate() + 1)
      events.set(
        id,
        [
          'BEGIN:VEVENT',
          `UID:${encodeURIComponent(id)}@ghost`,
          `DTSTAMP:${new Date()
            .toISOString()
            .replace(/[-:]/g, '')
            .replace(/\.\d+Z$/, 'Z')}`,
          `DTSTART;VALUE=DATE:${release.date.replace(/-/g, '')}`,
          `DTEND;VALUE=DATE:${localReleaseDay(end).replace(/-/g, '')}`,
          `SUMMARY:${escape(`${entry.product.title} · ${release.platform}`)}`,
          `URL:${entry.product.url}`,
          'END:VEVENT'
        ].join('\r\n')
      )
    }
  }
  if (!events.size)
    throw new Error(
      'Nenhum lançamento monitorado tem uma data exata para exportar.'
    )
  const calendar = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ghost//Lancamentos//PT-BR',
    'CALSCALE:GREGORIAN',
    ...events.values(),
    'END:VCALENDAR'
  ].join('\r\n')
  const url = URL.createObjectURL(
    new Blob([calendar], { type: 'text/calendar;charset=utf-8' })
  )
  const link = document.createElement('a')
  link.href = url
  link.download = 'ghost-lancamentos.ics'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function NativeReleases() {
  const location = useLocation()
  const navigate = useNavigate()
  const [prefs, setPrefs] = useState(preferences)
  const [view, setView] = useState<View>('calendar')
  const [interval, setInterval] =
    useState<NonNullable<ReleaseQuery['interval']>>('month')
  const [date, setDate] = useState(localReleaseDay)
  const [visibleDay, setVisibleDay] = useState<{
    date?: string
    label: string
  }>(() => ({ date: localReleaseDay(), label: '' }))
  const [calendarExpanded, setCalendarExpanded] = useState(false)
  const [search, setSearch] = useState('')
  const [term, setTerm] = useState('')
  const [tag, setTag] = useState('')
  const [appliedTag, setAppliedTag] = useState('')
  const [catalog, setCatalog] = useState<ReleaseCatalog | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [tracked, setTracked] = useState(getTrackedReleases)
  const [selected, setSelected] = useState<ReleaseProduct | null>(null)
  const [detailBusy, setDetailBusy] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [detailExpanded, setDetailExpanded] = useState(false)
  const [video, setVideo] = useState<string | null>(null)
  const [cloud, setCloud] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const [drmProgress, setDrmProgress] = useState<DrmBatchProgress | null>(null)
  const [drmBusy, setDrmBusy] = useState(false)
  const [drmMessage, setDrmMessage] = useState('')
  const [hizRequired, setHizRequired] = useState(false)
  const [hizVerifying, setHizVerifying] = useState(false)
  const drmSnapshot = useRef<ReturnType<typeof drmBatchGames>>([])
  const hizRetry = useRef(false)
  const hizUnlocking = useRef(false)
  const drmAction = useRef(0)
  const drmController = useRef<AbortController | null>(null)
  const drmMounted = useRef(true)
  const searchInput = useRef<HTMLInputElement>(null)
  const resultsPanel = useRef<HTMLDivElement>(null)
  const nextPageSentinel = useRef<HTMLDivElement>(null)
  const previousPageSentinel = useRef<HTMLDivElement>(null)
  const initialCalendarAnchor = useRef<string | null>(null)
  const trackingAnchorContext = useRef<string | null>(null)
  const scrollAnchor = useRef<{
    element: Element
    top: number
    generation: number
  } | null>(null)
  const pageRequest = useRef<{ generation: number; cursor: string } | null>(
    null
  )
  const loadedCursors = useRef(new Set<string>())
  const dialog = useRef<HTMLDialogElement>(null)
  const generation = useRef(0)
  const detailGeneration = useRef(0)
  const playRequested = useRef<string | null>(null)
  const selectedId = selected?.id
  const selectedFollow = tracked.find(
    (entry) => entry.product.id === selectedId && entry.region === prefs.region
  )
  const followedIds = new Set(tracked.map((entry) => entry.id))
  const isReleaseTracked = (
    id: string,
    platform: string | null,
    region: ReleaseRegion
  ) => followedIds.has(releaseTrackingId(id, platform, region))
  const categories = catalog?.filters || RELEASE_CATEGORIES
  const selectedCategory = categories.find(
    (category) => category.id === prefs.category
  )
  const platformNames =
    selectedCategory?.platforms
      .filter((platform) => prefs.platforms.includes(platform.id))
      .map((platform) => platform.label) || []
  const platformsKey = JSON.stringify(platformNames)

  useEffect(() => {
    drmMounted.current = true
    return () => {
      drmMounted.current = false
      drmController.current?.abort()
    }
  }, [])
  const drmGames = drmBatchGames([
    ...(catalog?.products || []),
    ...tracked.map((entry) => entry.product)
  ])
  const checkAllDrm = async (manual: 'general' | 'hiz' = 'general') => {
    if (drmController.current) {
      drmController.current.abort()
      hizRetry.current = false
      drmAction.current++
      return
    }
    const games = manual === 'hiz' ? drmSnapshot.current : drmGames
    if (!games.length) return
    if (manual === 'general') {
      drmSnapshot.current = games
      drmAction.current++
    }
    const controller = new AbortController()
    drmController.current = controller
    setDrmBusy(true)
    setDrmMessage('')
    setHizRequired(false)
    try {
      const result = await refreshReleaseDrmBatch(
        games,
        (progress) => {
          if (drmMounted.current) {
            setDrmProgress(progress)
            setHizRequired(progress.hizVerification && !hizRetry.current)
          }
        },
        controller.signal,
        manual,
        false
      )
      if (drmMounted.current)
        setDrmMessage(
          [
            `${controller.signal.aborted ? 'Verificação interrompida' : manual === 'hiz' ? 'Consulta do HizSearch concluída' : 'Verificação concluída'}: ${result.completed} de ${result.total} jogos consultados.`,
            ...(result.hizVerification
              ? ['HizSearch pede confirmação humana. Use Liberar acesso.']
              : []),
            ...(result.unconfirmed
              ? [
                  `${result.unconfirmed} sem confirmação atual; consulte os detalhes das fontes.`
                ]
              : []),
            ...(result.failed
              ? [`${result.failed} consultas falharam. Tente novamente.`]
              : [])
          ].join(' ')
        )
    } catch {
      if (drmMounted.current)
        setDrmMessage('Não foi possível concluir a consulta. Tente novamente.')
    } finally {
      drmController.current = null
      if (drmMounted.current) setDrmBusy(false)
      if (
        hizRetry.current &&
        drmMounted.current &&
        !controller.signal.aborted
      ) {
        hizRetry.current = false
        void checkAllDrm('hiz')
      } else if (!hizUnlocking.current) {
        await window.api.releasesDrmEndManual().catch(() => undefined)
      }
    }
  }
  const unlockHiz = async () => {
    if (hizUnlocking.current) return
    const action = drmAction.current
    setHizVerifying(true)
    hizUnlocking.current = true
    try {
      const ready = await window.api.releasesDrmVerifyHiz()
      if (!drmMounted.current || action !== drmAction.current) {
        await window.api.releasesDrmEndManual()
        return
      }
      if (ready) {
        setHizRequired(false)
        if (drmController.current) hizRetry.current = true
        else void checkAllDrm('hiz')
      } else {
        await window.api.releasesDrmEndManual()
        setDrmMessage(
          'A liberação do HizSearch não foi concluída. Você pode tentar novamente.'
        )
      }
    } catch {
      await window.api.releasesDrmEndManual().catch(() => undefined)
      if (drmMounted.current)
        setDrmMessage('Não foi possível abrir o HizSearch. Tente novamente.')
    } finally {
      hizUnlocking.current = false
      if (drmMounted.current) setHizVerifying(false)
    }
  }

  useEffect(() => {
    initializeReleaseTracking()
    const unsubscribe = subscribeReleaseTracking(() =>
      setTracked(getTrackedReleases())
    )
    const checkCloud = () => {
      void window.api
        .getCloudProviderStatus()
        .then((status) => setCloud(status.connected))
        .catch(() => setCloud(false))
    }
    checkCloud()
    window.addEventListener('backupStateChanged', checkCloud)
    return () => {
      unsubscribe()
      window.removeEventListener('backupStateChanged', checkCloud)
    }
  }, [])

  useEffect(() => {
    const state = location.state as { targetUrl?: string; view?: string } | null
    if (
      state?.view === 'tracking' ||
      state?.targetUrl?.includes('/tracking') ||
      new URLSearchParams(location.search).get('view') === 'tracking'
    )
      setView('tracking')
    const id = state?.targetUrl?.match(/\/(?:p|l)\/([a-z0-9._~-]+)/i)?.[1]
    if (id)
      void window.api
        .releasesProduct(id, prefs.region)
        .then(setSelected)
        .catch((error) => setError(String(error)))
  }, [location.key])

  useEffect(() => {
    const timer = setTimeout(() => setTerm(search.trim()), 450)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    const timer = setTimeout(() => setAppliedTag(tag.trim()), 450)
    return () => clearTimeout(timer)
  }, [tag])

  useEffect(() => {
    const current = ++generation.current
    loadedCursors.current.clear()
    pageRequest.current = null
    scrollAnchor.current = null
    initialCalendarAnchor.current = null
    setVisibleDay({ date, label: '' })
    if (resultsPanel.current && view !== 'tracking')
      resultsPanel.current.scrollTop = 0
    setError('')
    if (view === 'tracking') {
      setBusy(false)
      return
    }
    setBusy(true)
    setCatalog(null)
    const query: ReleaseQuery = {
      category: prefs.category,
      platforms: JSON.parse(platformsKey),
      region: prefs.region,
      view,
      interval,
      date,
      search: term,
      tag: appliedTag,
      refresh: reload > 0
    }
    void window.api
      .releasesCatalog(query)
      .then((result) => {
        if (generation.current !== current) return
        if (view === 'calendar' && !term) initialCalendarAnchor.current = date
        setCatalog(result)
      })
      .catch((error) => {
        if (generation.current === current)
          setError(String(error).replace(/^Error: /, ''))
      })
      .finally(() => {
        if (generation.current === current) setBusy(false)
      })
    return () => {
      generation.current++
    }
  }, [
    view,
    prefs.category,
    platformsKey,
    prefs.region,
    interval,
    date,
    term,
    appliedTag,
    reload
  ])

  useEffect(() => {
    if (selected && dialog.current && !dialog.current.open)
      dialog.current.showModal()
    if (!selected && dialog.current?.open) dialog.current.close()
  }, [selected])

  useEffect(() => {
    setVideo(null)
    setDetailExpanded(false)
    if (!selectedId) return
    const current = ++detailGeneration.current
    setDetailBusy(true)
    setDetailError('')
    void window.api
      .releasesProduct(selectedId, prefs.region)
      .then((product) => {
        if (current !== detailGeneration.current) return
        refreshTrackedProducts([product])
        const protectedEntry = getTrackedReleases().find(
          (entry) =>
            entry.product.id === selectedId && entry.region === prefs.region
        )
        setSelected(
          protectedEntry?.metadataPaused || protectedEntry?.updateWarning
            ? {
                ...protectedEntry.product,
                warning: protectedEntry.updateWarning
              }
            : product
        )
        if (playRequested.current === selectedId) {
          const trailer = product.videos.map(releaseVideoEmbed).find(Boolean)
          if (trailer) setVideo(trailer)
          playRequested.current = null
        }
      })
      .catch((error) => {
        if (current === detailGeneration.current)
          setDetailError(String(error).replace(/^Error: /, ''))
      })
      .finally(() => {
        if (current === detailGeneration.current) setDetailBusy(false)
      })
    return () => {
      detailGeneration.current++
      if (playRequested.current === selectedId) playRequested.current = null
    }
  }, [selectedId, prefs.region])

  useEffect(() => {
    try {
      const stored = window.api?.storeGet?.('configStore', 'releasesPreferences') as
        | Preferences
        | undefined
      if (stored && typeof stored === 'object') {
        const local = preferences()
        const mergedPlatformsMap = {
          ...(stored.platformsByCategory || {}),
          ...(local.platformsByCategory || {})
        }
        const activeCat = local.category || stored.category || 'games'
        const activePlats =
          local.platforms.length > 0
            ? local.platforms
            : mergedPlatformsMap[activeCat] || stored.platforms || []
        const merged: Preferences = {
          ...local,
          ...stored,
          category: activeCat,
          platforms: activePlats,
          platformsByCategory: mergedPlatformsMap
        }
        setPrefs(merged)
        localStorage.setItem(
          'ghost_releases_preferences_v1',
          JSON.stringify(merged)
        )
      }
    } catch {}
  }, [])

  const changePrefs = (next: Partial<Preferences>) => {
    const value = { ...prefs, ...next }
    setPrefs(value)
    localStorage.setItem('ghost_releases_preferences_v1', JSON.stringify(value))
    try {
      window.api?.storeSet?.('configStore', 'releasesPreferences', value)
      window.api?.storeSet?.('configStore', 'backup.lastModified', Date.now())
    } catch {}
    void syncLocalStorageToBackend().catch(() =>
      setSyncMessage(
        'Preferências salvas localmente; não foi possível prepará-las para backup.'
      )
    )
  }
  const monitor = (product: ReleaseProduct, platform: string | null = null) => {
    try {
      const added = toggleReleaseTracking(product, platform, prefs.region)
      setSyncMessage(
        added ? 'Monitoramento salvo no Ghost.' : 'Monitoramento removido.'
      )
      void syncLocalStorageToBackend()
        .then(() =>
          setSyncMessage(
            added
              ? 'Salvo no Ghost e incluído no próximo backup.'
              : 'Remoção incluída no próximo backup.'
          )
        )
        .catch(() =>
          setSyncMessage(
            'Salvo localmente. Falha ao preparar o backup; tente atualizar.'
          )
        )
      void checkTodayReleases()
    } catch (error) {
      setSyncMessage(String(error))
    }
  }
  const goToToday = () => {
    const today = localReleaseDay()
    if (date !== today) {
      setDate(today)
      return
    }
    const panel = resultsPanel.current
    const dates = panel
      ? [
          ...panel.querySelectorAll<HTMLTimeElement>(
            '.nr-day-heading time[datetime]'
          )
        ].filter((time) => !!time.dateTime)
      : []
    const target = dates.find((time) => time.dateTime >= today) || dates.at(-1)
    if (panel && target)
      panel.scrollTop +=
        target.getBoundingClientRect().top -
        panel.getBoundingClientRect().top -
        12
    else setReload((value) => value + 1)
  }
  const visibleTracked = tracked.filter(
    (entry) =>
      entry.region === prefs.region &&
      (prefs.category === 'all' ||
        prefs.category.split('_').includes(entry.product.category)) &&
      (!platformNames.length ||
        (entry.platform
          ? platformNames.includes(entry.platform)
          : entry.product.platforms.some((platform) =>
              platformNames.includes(platform)
            ))) &&
      (!term ||
        entry.product.title
          .toLocaleLowerCase()
          .includes(term.toLocaleLowerCase()))
  )
  const products = filterReleasePlatforms(
    view === 'tracking'
      ? [
          ...new Map(
            visibleTracked.map((entry) => {
              const follows = visibleTracked.filter(
                (value) => value.product.id === entry.product.id
              )
              const releases = entry.product.releases.filter(
                (row) =>
                  row.region === prefs.region &&
                  follows.some(
                    (follow) =>
                      !follow.platform || follow.platform === row.platform
                  )
              )
              return [
                entry.product.id,
                {
                  ...entry.product,
                  releases,
                  releaseDate: releases[0]?.date,
                  dateLabel: releases[0]?.dateLabel || 'A confirmar'
                }
              ]
            })
          ).values()
        ]
      : catalog?.products || [],
    platformNames
  )
  const sections = useMemo(() => {
    if (view === 'hot' || term)
      return [
        {
          key: 'results',
          month: undefined,
          groups: [{ key: 'results', date: undefined, label: '', products }]
        }
      ]
    return releaseCalendarSections(products, view !== 'tracking')
  }, [products, view, term])
  const calendarContext = [categoryName(prefs.category), ...platformNames].join(
    ' / '
  )
  const loadMore = useCallback(
    async (direction: 'forward' | 'backward' = 'forward') => {
      const cursor =
        direction === 'forward' ? catalog?.nextCursor : catalog?.previousCursor
      if (
        !catalog ||
        !cursor ||
        (direction === 'forward' && !catalog.hasMore) ||
        busy ||
        selectedId ||
        view === 'tracking'
      )
        return
      const current = generation.current
      if (pageRequest.current?.generation === current) return
      if (loadedCursors.current.has(cursor)) {
        setError(
          'A fonte repetiu uma página. Os títulos carregados foram preservados.'
        )
        return
      }
      pageRequest.current = { generation: current, cursor }
      setBusy(true)
      setError('')
      try {
        const result = await window.api.releasesCatalog({
          category: prefs.category,
          platforms: JSON.parse(platformsKey),
          region: prefs.region,
          cursor,
          view: view === 'hot' ? 'hot' : 'calendar',
          interval,
          date,
          search: term,
          tag: appliedTag,
          refresh: reload > 0
        })
        if (current !== generation.current) return
        const next = appendReleasePage(catalog, result, cursor, direction)
        const followingCursor =
          direction === 'forward' ? next.nextCursor : next.previousCursor
        if (followingCursor && loadedCursors.current.has(followingCursor))
          throw new Error(
            'A fonte repetiu uma página. Os títulos carregados foram preservados.'
          )
        loadedCursors.current.add(cursor)
        if (direction === 'backward' && resultsPanel.current) {
          const panel = resultsPanel.current
          const top = panel.getBoundingClientRect().top
          const element = [...panel.querySelectorAll('.nr-card')].find(
            (card) => card.getBoundingClientRect().bottom > top
          )
          if (element)
            scrollAnchor.current = {
              element,
              top: element.getBoundingClientRect().top,
              generation: current
            }
        }
        setCatalog(next)
      } catch (error) {
        if (current === generation.current) setError(String(error))
      } finally {
        if (current === generation.current) {
          pageRequest.current = null
          setBusy(false)
        }
      }
    },
    [
      catalog,
      busy,
      selectedId,
      view,
      prefs.category,
      prefs.region,
      platformsKey,
      interval,
      date,
      term,
      appliedTag,
      reload
    ]
  )

  useEffect(() => {
    if (
      !catalog ||
      catalog.stale ||
      busy ||
      error ||
      selectedId ||
      view === 'tracking' ||
      !resultsPanel.current
    )
      return
    const observer = new IntersectionObserver(
      (entries) => {
        const previous = entries.find(
          (entry) =>
            entry.target === previousPageSentinel.current &&
            entry.isIntersecting
        )
        if (previous) void loadMore('backward')
        else if (
          entries.some(
            (entry) =>
              entry.target === nextPageSentinel.current && entry.isIntersecting
          )
        )
          void loadMore('forward')
      },
      { root: resultsPanel.current, rootMargin: '250px 0px 600px' }
    )
    if (
      catalog.previousCursor &&
      view === 'calendar' &&
      !term &&
      previousPageSentinel.current
    )
      observer.observe(previousPageSentinel.current)
    if (catalog.hasMore && nextPageSentinel.current)
      observer.observe(nextPageSentinel.current)
    return () => observer.disconnect()
  }, [catalog, busy, error, selectedId, view, term, loadMore])

  useLayoutEffect(() => {
    const anchor = scrollAnchor.current
    if (
      anchor &&
      anchor.generation === generation.current &&
      anchor.element.isConnected &&
      resultsPanel.current
    )
      resultsPanel.current.scrollTop +=
        anchor.element.getBoundingClientRect().top - anchor.top
    scrollAnchor.current = null
    const panel = resultsPanel.current
    const initial = initialCalendarAnchor.current
    if (initial && panel) {
      const times = [
        ...panel.querySelectorAll<HTMLTimeElement>(
          '.nr-day-heading time[datetime]'
        )
      ]
      const target =
        times.find((time) => time.dateTime >= initial) || times.at(-1)
      if (target) {
        const month = target.closest('.nr-month')
        const first = month?.querySelector('.nr-day-heading time[datetime]')
        const destination =
          first === target ? month! : target.closest('.nr-day-heading')!
        panel.scrollTop +=
          destination.getBoundingClientRect().top -
          panel.getBoundingClientRect().top -
          16
      }
      initialCalendarAnchor.current = null
    }
  }, [catalog])

  const trackingContext = JSON.stringify([
    prefs.category,
    platformsKey,
    prefs.region,
    term,
    prefs.layout,
    location.key
  ])
  useLayoutEffect(() => {
    if (view !== 'tracking') {
      trackingAnchorContext.current = null
      return
    }
    const panel = resultsPanel.current
    if (
      !panel ||
      !products.length ||
      trackingAnchorContext.current === trackingContext
    )
      return
    const times = [
      ...panel.querySelectorAll<HTMLTimeElement>(
        '.nr-day-heading time[datetime]'
      )
    ]
    const closest = closestReleaseDate(
      times.map((time) => time.dateTime),
      localReleaseDay()
    )
    const target = times.find((time) => time.dateTime === closest)
    panel.style.setProperty('--nr-tracking-tail', '0px')
    panel.scrollTop = 0
    if (target) {
      const month = target.closest('.nr-month')
      const first = month?.querySelector('.nr-day-heading time[datetime]')
      const destination =
        first === target ? month! : target.closest('.nr-day-heading')!
      const offset =
        destination.getBoundingClientRect().top -
        panel.getBoundingClientRect().top -
        16
      // Short final groups need room below them to reach the top of the viewport.
      const tail = Math.max(
        0,
        Math.ceil(offset - (panel.scrollHeight - panel.clientHeight))
      )
      panel.style.setProperty('--nr-tracking-tail', `${tail}px`)
      panel.scrollTop = offset
    }
    trackingAnchorContext.current = trackingContext
  }, [view, trackingContext, products])

  useEffect(() => {
    const panel = resultsPanel.current
    if (!panel || view !== 'calendar' || term) return
    const headings = [...panel.querySelectorAll<HTMLElement>('.nr-day-heading')]
    let frame = 0
    const updateDay = () => {
      frame = 0
      const top = panel.getBoundingClientRect().top + 20
      const current =
        headings.find(
          (heading) =>
            (heading.closest('.nr-group')?.getBoundingClientRect().bottom ||
              0) > top
        ) || headings.at(-1)
      if (!current) return
      const next = {
        date: current.dataset.date || undefined,
        label: current.dataset.label || ''
      }
      setVisibleDay((previous) =>
        previous.date === next.date && previous.label === next.label
          ? previous
          : next
      )
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(updateDay)
    }
    updateDay()
    panel.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      panel.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [catalog, view, term, prefs.layout])

  return (
    <main
      className={`NativeReleases NativeReleases--${prefs.theme}${calendarExpanded ? ' NativeReleases--expanded' : ''}`}
    >
      <ReleaseNavigation
        categories={categories}
        category={prefs.category}
        platforms={prefs.platforms}
        region={prefs.region}
        theme={prefs.theme}
        tag={tag}
        tracked={tracked}
        tracking={view === 'tracking'}
        onCategory={(category) => {
          const restoredPlatforms = prefs.platformsByCategory?.[category] || []
          changePrefs({ category, platforms: restoredPlatforms })
          setTag('')
        }}
        onPlatforms={(platforms) => {
          const updatedMap = {
            ...(prefs.platformsByCategory || {}),
            [prefs.category]: platforms
          }
          changePrefs({ platforms, platformsByCategory: updatedMap })
        }}
        onRegion={(region) => changePrefs({ region })}
        onTheme={() =>
          changePrefs({ theme: prefs.theme === 'dark' ? 'light' : 'dark' })
        }
        onTag={setTag}
        onSearch={() => searchInput.current?.focus()}
        onCalendar={() => {
          setView('calendar')
          setSearch('')
          if (prefs.category === 'all') {
            const targetCategory = 'games'
            const restored = prefs.platformsByCategory?.[targetCategory] || []
            changePrefs({ category: targetCategory, platforms: restored })
          } else if (
            !prefs.platforms.length &&
            prefs.platformsByCategory?.[prefs.category]?.length
          ) {
            changePrefs({ platforms: prefs.platformsByCategory[prefs.category] })
          }
        }}
        onTracking={(category = 'all', platform = '') => {
          trackingAnchorContext.current = null
          setView('tracking')
          changePrefs({ category, platforms: platform ? [platform] : [] })
          setSearch('')
          setTag('')
        }}
      />
      <section className="nr-workspace" aria-label="Catálogo de lançamentos">
        <header className="nr-header">
          <form
            className="nr-search"
            onSubmit={(event) => {
              event.preventDefault()
              setTerm(search.trim())
            }}
          >
            <Icon icon={faSearch} />
            <input
              ref={searchInput}
              aria-label="Buscar lançamentos"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar jogos, filmes, séries e muito mais…"
            />
            {search && (
              <button
                type="button"
                aria-label="Limpar busca"
                onClick={() => setSearch('')}
              >
                <Icon icon={faXmark} />
              </button>
            )}
          </form>
          <button
            title="Atualizar lançamentos"
            aria-label="Atualizar lançamentos"
            disabled={busy}
            onClick={() => {
              setReload((value) => value + 1)
              void checkTodayReleases()
            }}
          >
            <Icon icon={faRotate} spin={busy} />
          </button>
        </header>
        <ReleaseToolbar
          view={view}
          layout={prefs.layout}
          interval={interval}
          anchorDate={date}
          visibleDay={visibleDay}
          context={calendarContext}
          searching={!!term}
          expanded={calendarExpanded}
          onView={setView}
          onLayout={(layout) => changePrefs({ layout })}
          onInterval={setInterval}
          onDate={(value) => {
            setReload((previous) => previous + 1)
            setDate(value)
          }}
          onToday={goToToday}
          onExpand={() => setCalendarExpanded(!calendarExpanded)}
          drmCheck={{
            count: drmGames.length,
            busy: drmBusy,
            completed: drmProgress?.completed || 0,
            total: drmProgress?.total || 0,
            onClick: () => void checkAllDrm(),
            hizRequired,
            hizVerifying,
            onUnlockHiz: () => void unlockHiz()
          }}
        />
        {drmMessage && (
          <div className="nr-notice" role="status">
            {drmMessage}
            <button
              aria-label="Fechar resultado da verificação de DRM"
              onClick={() => setDrmMessage('')}
            >
              <Icon icon={faXmark} />
            </button>
          </div>
        )}
        {view === 'tracking' && (
          <div className="nr-backup-bar">
            <span>
              <Icon icon={faCloud} />{' '}
              {cloud
                ? 'Incluídos no próximo backup da sua conta de nuvem.'
                : 'Salvos neste dispositivo. Conecte uma nuvem para fazer backup.'}
            </span>
            <button onClick={() => navigate('/settings/general')}>
              Configurar backup
            </button>
            <button
              onClick={() => {
                try {
                  exportCalendar(visibleTracked)
                } catch (error) {
                  setSyncMessage(String(error))
                }
              }}
            >
              <Icon icon={faDownload} /> Calendário .ics
            </button>
          </div>
        )}
        {syncMessage && (
          <div className="nr-notice" role="status">
            {syncMessage}
            <button
              aria-label="Fechar aviso"
              onClick={() => setSyncMessage('')}
            >
              <Icon icon={faXmark} />
            </button>
          </div>
        )}
        {catalog?.warning && (
          <p className="nr-notice" role="status">
            {catalog.warning}
          </p>
        )}
        {error && (
          <div className="nr-error" role="alert">
            <strong>Não foi possível consultar a fonte</strong>
            <p>{error}</p>
            <button onClick={() => setReload((value) => value + 1)}>
              Tentar novamente
            </button>
            <button onClick={() => setView('tracking')}>
              Ver monitorados salvos
            </button>
          </div>
        )}
        <div
          className={`nr-results${view === 'tracking' ? ' nr-results--tracking' : ''}`}
          aria-busy={busy}
          ref={resultsPanel}
        >
          {catalog?.previousCursor && view === 'calendar' && !term && (
            <div
              ref={previousPageSentinel}
              className="nr-pagination nr-pagination--previous"
              aria-live="polite"
            >
              <button
                className="nr-load-more"
                disabled={busy}
                onClick={() => void loadMore('backward')}
              >
                {busy ? 'Carregando…' : 'Ver lançamentos anteriores'}
              </button>
            </div>
          )}
          {busy && !products.length && (
            <div className="nr-empty" role="status">
              <Icon icon={faRotate} spin />
              <h2>Consultando lançamentos…</h2>
              <p>Carregando as datas da fonte.</p>
            </div>
          )}
          {!busy && !error && !products.length && (
            <div className="nr-empty">
              <Icon icon={view === 'tracking' ? faBell : faCalendarDays} />
              <h2>
                {view === 'tracking'
                  ? 'Nenhum título acompanhado neste filtro'
                  : 'Nenhum lançamento encontrado'}
              </h2>
              <p>
                {view === 'tracking'
                  ? 'Use o sino de um título para acompanhar suas datas e receber avisos.'
                  : 'Tente outra data, categoria ou busca.'}
              </p>
            </div>
          )}
          {sections.map((section) => (
            <section
              className={section.month ? 'nr-month' : 'nr-period'}
              key={section.key}
            >
              {section.month && (
                <h2 className="nr-month-title">
                  {new Date(`${section.month}-01T12:00:00`).toLocaleDateString(
                    'pt-BR',
                    { month: 'long' }
                  )}
                  {section.month.slice(0, 4) !==
                    localReleaseDay().slice(0, 4) &&
                    ` ${section.month.slice(0, 4)}`}
                </h2>
              )}
              <div className="nr-month-days">
                {section.groups.map(
                  ({
                    key,
                    date: day,
                    label: sourceLabel,
                    products: entries
                  }) => {
                    const label = day ? dateText(day) : sourceLabel
                    const past = !!day && day < localReleaseDay()
                    return (
                      <section className="nr-group" key={key}>
                        {label && (
                          <h3
                            className={`nr-day-heading${past ? ' is-past' : ''}`}
                            data-date={day}
                            data-label={label}
                          >
                            <Icon
                              icon={past ? faCircleCheck : faCalendarDays}
                            />
                            <time dateTime={day} title={label}>
                              {shortDateText(day, label)}
                            </time>
                            <span className="nr-relative-date">
                              {relativeReleaseDate(day)}
                            </span>
                            <span className="nr-group-line" />
                            <span
                              className="nr-group-category"
                              title={calendarContext}
                            >
                              {calendarContext}
                            </span>
                            {day && view === 'calendar' && (
                              <button
                                className="nr-day-expand"
                                title={`Ver lançamentos de ${label}`}
                                aria-label={`Ver lançamentos de ${label}`}
                                onClick={() => {
                                  if (day === date)
                                    setReload((value) => value + 1)
                                  else setDate(day)
                                }}
                              >
                                <Icon icon={faExpand} />
                              </button>
                            )}
                          </h3>
                        )}
                        <div
                          className={`nr-products nr-products--${prefs.layout}`}
                        >
                          {entries.map((product) => {
                            const followed = isReleaseTracked(
                              product.id,
                              null,
                              prefs.region
                            )
                            return (
                              <article
                                className={`nr-card ${product.heroImage && prefs.layout === 'cards' ? 'nr-card--featured' : ''}`}
                                key={product.id}
                                style={
                                  product.heroImage && prefs.layout === 'cards'
                                    ? {
                                        backgroundImage: `linear-gradient(0deg,rgba(123,97,255,.18),rgba(123,97,255,.18)),linear-gradient(90deg,rgba(13,11,34,.78) 10%,rgba(13,11,34,.12) 100%),url("${product.heroImage}")`
                                      }
                                    : undefined
                                }
                              >
                                <button
                                  className="nr-card-open"
                                  onClick={() => setSelected(product)}
                                  aria-label={`Detalhes de ${product.title}`}
                                >
                                  <div className="nr-cover">
                                    {product.heroImage && (
                                      <span className="nr-feature-label">
                                        <Icon icon={faFire} /> Em destaque
                                      </span>
                                    )}
                                    {product.image ? (
                                      <img
                                        src={product.image}
                                        alt=""
                                        loading="lazy"
                                        onError={(event) => {
                                          event.currentTarget.style.visibility =
                                            'hidden'
                                        }}
                                      />
                                    ) : (
                                      <Icon
                                        icon={categoryIcon(product.category)}
                                      />
                                    )}
                                  </div>
                                  <div className="nr-card-copy">
                                    <span className="nr-type">
                                      {categoryName(product.category)}
                                    </span>
                                    <h4 title={product.title}>
                                      {product.title}
                                    </h4>
                                    <p title={product.platforms.join(' / ')}>
                                      <Icon
                                        icon={categoryIcon(product.category)}
                                      />{' '}
                                      {product.platforms
                                        .slice(0, 3)
                                        .join(' / ') ||
                                        'Plataforma a confirmar'}
                                      {product.platforms.length > 3 &&
                                        ` +${product.platforms.length - 3}`}
                                    </p>
                                    {view === 'tracking' &&
                                      visibleTracked.some(
                                        (entry) =>
                                          entry.product.id === product.id &&
                                          entry.updateWarning
                                      ) && (
                                        <small className="nr-card-warning">
                                          Dados preservados · confira o aviso
                                          nos detalhes
                                        </small>
                                      )}
                                    {(view === 'hot' || term) && (
                                      <small className="nr-card-release">
                                        {dateText(
                                          product.releaseDate,
                                          product.dateLabel
                                        )}
                                      </small>
                                    )}
                                  </div>
                                </button>
                                <div className="nr-card-actions">
                                  {['games', 'movies', 'tv-series'].includes(
                                    product.category
                                  ) && (
                                    <button
                                      className="nr-card-play"
                                      title={`Ver trailers de ${product.title}`}
                                      aria-label={`Ver trailers de ${product.title}`}
                                      onClick={() => {
                                        playRequested.current = product.id
                                        setSelected(product)
                                      }}
                                    >
                                      <Icon icon={faPlay} />
                                    </button>
                                  )}
                                  <button
                                    className={followed ? 'is-followed' : ''}
                                    aria-pressed={followed}
                                    aria-label={`${followed ? 'Deixar de monitorar' : 'Monitorar'} ${product.title}`}
                                    onClick={() => monitor(product)}
                                  >
                                    <Icon icon={followed ? faCheck : faBell} />
                                    <span>
                                      {product.popularity ||
                                        (followed ? 'Salvo' : 'Seguir')}
                                    </span>
                                  </button>
                                  {product.category === 'games' && (
                                    <button
                                      type="button"
                                      className="nr-card-search"
                                      title={`Buscar "${product.title}" na página Buscar jogos`}
                                      aria-label={`Buscar ${product.title} na página Buscar jogos`}
                                      onClick={(event) => {
                                        event.stopPropagation()
                                        navigate(
                                          `/external-games?q=${encodeURIComponent(product.title)}`
                                        )
                                      }}
                                    >
                                      <Icon icon={faSearch} />
                                    </button>
                                  )}
                                  {product.category === 'games' && (
                                    <ReleaseDrmBadge
                                      product={product}
                                      onOpen={() => setSelected(product)}
                                    />
                                  )}
                                  {(view === 'hot' || term) && (
                                    <span
                                      className="nr-card-date"
                                      title={dateText(
                                        product.releaseDate,
                                        product.dateLabel
                                      )}
                                    >
                                      <Icon icon={faCalendarDays} />{' '}
                                      {shortDateText(
                                        product.releaseDate,
                                        product.dateLabel
                                      )}
                                    </span>
                                  )}
                                </div>
                                {view === 'tracking' &&
                                  visibleTracked
                                    .filter(
                                      (entry) => entry.product.id === product.id
                                    )
                                    .map((entry) => (
                                      <div
                                        className="nr-follow-row"
                                        key={entry.id}
                                      >
                                        <span>
                                          {entry.platform ||
                                            'Todas as plataformas'}
                                        </span>
                                        <label>
                                          <input
                                            type="checkbox"
                                            checked={entry.notify}
                                            onChange={(event) =>
                                              setTrackedReleaseNotifications(
                                                entry.id,
                                                event.target.checked
                                              )
                                            }
                                          />{' '}
                                          Avisar
                                        </label>
                                        <button
                                          aria-label={`Remover monitoramento de ${product.title} ${entry.platform || 'todas as plataformas'}`}
                                          onClick={() =>
                                            removeTrackedRelease(entry.id)
                                          }
                                        >
                                          <Icon icon={faXmark} />
                                        </button>
                                      </div>
                                    ))}
                              </article>
                            )
                          })}
                        </div>
                      </section>
                    )
                  }
                )}
              </div>
            </section>
          ))}
          {catalog?.hasMore && view !== 'tracking' && (
            <div
              ref={nextPageSentinel}
              className="nr-pagination"
              aria-live="polite"
            >
              <button
                className="nr-load-more"
                disabled={busy}
                onClick={() => void loadMore()}
              >
                {busy ? 'Carregando…' : 'Carregar próximos lançamentos'}
              </button>
            </div>
          )}
        </div>
        <footer className="nr-footer">
          <span>
            {products.length} títulos carregados
            {selectedCategory ? ` · ${selectedCategory.label}` : ''}
          </span>
          <span>
            Datas da região {prefs.region === 'us' ? 'EUA' : 'Reino Unido'} ·
            Estimativas podem mudar
          </span>
        </footer>
      </section>
      <dialog
        className={`nr-detail ${detailExpanded ? 'nr-detail--expanded' : ''}`}
        ref={dialog}
        onCancel={() => setSelected(null)}
        onClose={() => setSelected(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setSelected(null)
        }}
        aria-labelledby="nr-detail-title"
      >
        {selected && (
          <ReleaseDetails
            key={`${selected.id}:${prefs.region}`}
            product={selected}
            region={prefs.region}
            busy={detailBusy}
            error={detailError}
            follow={selectedFollow}
            video={video}
            expanded={detailExpanded}
            isTracked={isReleaseTracked}
            onMonitor={monitor}
            onSearchExternal={(title) => {
              setSelected(null)
              navigate(`/external-games?q=${encodeURIComponent(title)}`)
            }}
            onClose={() => setSelected(null)}
            onExpand={() => setDetailExpanded(!detailExpanded)}
            onRegion={(region) => changePrefs({ region })}
            onVideo={setVideo}
            onTag={(tag) => {
              setTag(tag)
              setSearch('')
              changePrefs({ category: selected.category, platforms: [] })
              setView('calendar')
              setSelected(null)
            }}
            onResume={() => {
              resumeTrackedReleaseUpdates(selected.id, prefs.region)
              void checkTodayReleases(true)
            }}
            onRestore={(at) => {
              if (!selectedFollow) return
              try {
                setSelected(restoreTrackedReleaseVersion(selectedFollow.id, at))
                setSyncMessage('Versão recuperada neste dispositivo.')
              } catch (error) {
                setDetailError(String(error))
              }
            }}
          />
        )}
      </dialog>
    </main>
  )
}

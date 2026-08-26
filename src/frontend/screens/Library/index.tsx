import './index.css'

import {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useLayoutEffect,
  useCallback,
  memo
} from 'react'

import ArrowDropUp from '@mui/icons-material/ArrowDropUp'
import ArrowDropDown from '@mui/icons-material/ArrowDropDown'
import { Header, UpdateComponent } from 'frontend/components/UI'
import { useTranslation } from 'react-i18next'
import Fuse from 'fuse.js'

import ContextProvider from 'frontend/state/ContextProvider'
import { syncAutoStoreAssignments } from 'frontend/helpers/autoStoreAssignments'

import GamesList from './components/GamesList'
import { FavouriteGame, GameInfo, HiddenGame, Runner } from 'common/types'
import ErrorComponent from 'frontend/components/UI/ErrorComponent'
import LibraryHeader from './components/LibraryHeader'
import {
  amazonCategories,
  epicCategories,
  gogCategories,
  sideloadedCategories,
  zoomCategories,
  normalizeTitle,
  getDuplicateGameIds,
  normalizeTitleForDuplicateCheck
} from 'frontend/helpers/library'
import RecentlyPlayed from './components/RecentlyPlayed'
import LibraryContext from './LibraryContext'
import { Category, PlatformsFilters, StoresFilters } from 'frontend/types'
import { hasHelp } from 'frontend/hooks/hasHelp'
import EmptyLibraryMessage from './components/EmptyLibrary'
import CategoriesManager from './components/CategoriesManager'
import LibraryTour from './components/LibraryTour'
import HeroPanel from './components/HeroPanel'
import InlineGameSettings from './components/InlineGameSettings'
import { openInstallGameModal } from 'frontend/state/InstallGameModal'
import { configStore } from 'frontend/helpers/electronStores'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCloud, faSpinner } from '@fortawesome/free-solid-svg-icons'
import { syncLocalStorageToBackend } from 'frontend/utils/localStorageBackup'
const storage = window.localStorage

type SearchableGame = {
  original: GameInfo
  title: string
  normalizedTitle: string
}

export default memo(function Library(): JSX.Element {
  const { t } = useTranslation()

  const {
    libraryStatus,
    refreshing,
    refreshingInTheBackground,
    epic,
    gog,
    amazon,
    zoom,
    sideloadedLibrary,
    favouriteGames,
    libraryTopSection,
    platform,
    currentCustomCategories,
    customCategories,
    hiddenGames,
    gameUpdates
  } = useContext(ContextProvider)

  hasHelp(
    'library',
    t('help.title.library', 'Library'),
    <p>{t('help.content.library', 'Shows all owned games.')}</p>
  )

  const [layout, setLayout] = useState(storage.getItem('layout') || 'grid')
  const handleLayout = (layout: string) => {
    storage.setItem('layout', layout)
    setLayout(layout)
  }

  const [cardZoom, setCardZoom] = useState<number>(() => {
    const steps = [160, 180, 210, 240, 280, 340, 360]
    const stored = parseInt(storage.getItem('heroic_card_zoom') || '180')
    if (steps.includes(stored)) return stored
    return steps.reduce((prev, curr) => Math.abs(curr - stored) < Math.abs(prev - stored) ? curr : prev, 180)
  })

  const [backupState, setBackupState] = useState<'inactive' | 'error' | 'outdated' | 'updated'>('inactive')
  const [isUploading, setIsUploading] = useState(false)
  const [lastSuccessTime, setLastSuccessTime] = useState<number>(0)
  const [lastErrorMsg, setLastErrorMsg] = useState<string>('')
  const [cloudBackupProvider, setCloudBackupProvider] = useState<string>('none')
  const [isHovered, setIsHovered] = useState(false)

  const loadBackupStatus = useCallback(() => {
    const settings = (configStore as any).get('settings', {}) as any
    const provider = settings.cloudBackupProvider || 'none'
    setCloudBackupProvider(provider)

    const lastSuccess = (configStore as any).get('backup.lastSuccess', 0) as number
    const lastError = (configStore as any).get('backup.lastError', '') as string
    const lastModified = (configStore as any).get('backup.lastModified', 0) as number

    setLastSuccessTime(lastSuccess)
    setLastErrorMsg(lastError)

    if (provider === 'none') {
      setBackupState('inactive')
    } else if (lastError) {
      setBackupState('error')
    } else if (lastSuccess === 0) {
      setBackupState('inactive')
    } else if (lastModified > lastSuccess) {
      setBackupState('outdated')
    } else {
      setBackupState('updated')
    }
  }, [])

  useEffect(() => {
    loadBackupStatus()

    const handleStateChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ uploading?: boolean }>
      if (customEvent.detail && typeof customEvent.detail.uploading === 'boolean') {
        setIsUploading(customEvent.detail.uploading)
      }
      loadBackupStatus()
    }

    window.addEventListener('backupStateChanged', handleStateChange)
    return () => window.removeEventListener('backupStateChanged', handleStateChange)
  }, [loadBackupStatus])

  const handleCloudIconClick = async () => {
    if (cloudBackupProvider === 'none') {
      window.location.hash = '#/settings/backup'
      return
    }

    if (isUploading) return

    setIsUploading(true)
    ;(configStore as any).delete('backup.lastError')
    loadBackupStatus()

    try {
      syncLocalStorageToBackend()
      await new Promise(r => setTimeout(r, 100))

      const res = await window.api.uploadBackupToCloud()
      if (res.success) {
        // Success
      } else {
        // Error
      }
    } catch (err) {
      ;(configStore as any).set('backup.lastError', String(err))
    } finally {
      setIsUploading(false)
      loadBackupStatus()
      window.dispatchEvent(new Event('backupStateChanged'))
    }
  }

  const getCloudIconProps = () => {
    let color = 'rgba(255, 255, 255, 0.4)'
    let title = t('backup.status.inactive', 'Backup em nuvem inativo. Clique para configurar.')
    let label = t('backup.label.inactive', 'Backup inativo (clique para configurar)')
    
    if (isUploading) {
      title = t('backup.status.uploading', 'Enviando backup para a nuvem...')
      label = t('backup.label.uploading', 'Enviando backup para a nuvem...')
    } else {
      switch (backupState) {
        case 'error':
          color = '#ff1744'
          title = `${t('backup.status.error', 'Erro no último backup')}: ${lastErrorMsg || t('backup.status.unknown_error', 'Erro desconhecido')}. ${t('backup.status.retry', 'Clique para tentar novamente.')}`
          label = `${t('backup.label.error', 'Erro no backup')}: ${lastErrorMsg || t('backup.status.unknown_error', 'Erro desconhecido')}`
          break
        case 'outdated':
          color = '#ffea00'
          title = `${t('backup.status.outdated', 'Backup desatualizado (alterações locais pendentes)')}. ${t('backup.status.last_success', 'Último sucesso')}: ${lastSuccessTime ? new Date(lastSuccessTime).toLocaleString() : t('backup.status.never', 'Nunca')}. ${t('backup.status.click_to_sync', 'Clique para sincronizar agora.')}`
          label = t('backup.label.outdated', 'Backup desatualizado (clique para sincronizar)')
          break
        case 'updated':
          color = '#00e676'
          title = `${t('backup.status.updated', 'Backup atualizado na nuvem')}. ${t('backup.status.last_success', 'Último sucesso')}: ${new Date(lastSuccessTime).toLocaleString()}. ${t('backup.status.click_to_sync_again', 'Clique para fazer backup novamente.')}`
          label = `${t('backup.label.updated', 'Backup atualizado')} (${lastSuccessTime ? new Date(lastSuccessTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''})`
          break
        default:
          break
      }
    }

    return { color, title, label }
  }

  const { color: cloudColor, title: cloudTitle, label: cloudLabel } = getCloudIconProps()

  useEffect(() => {
    const timer = setTimeout(
      () => window.dispatchEvent(new Event('resize')),
      300
    )
    return () => clearTimeout(timer)
  }, [cardZoom])

  // ====================================================================
  // O FANTASMA SINCRONIZADO (Menu Contextual)
  // ====================================================================
  useEffect(() => {
    const overlay = document.createElement('div')
    overlay.id = 'heroic-menu-phantom-box'
    overlay.style.position = 'fixed'

    overlay.style.border = '2px solid #A9A9A9'
    overlay.style.backgroundColor = 'rgba(128, 128, 128, 0.4)'

    overlay.style.borderRadius = '4px'
    overlay.style.pointerEvents = 'none'
    overlay.style.zIndex = '9999999'
    overlay.style.transition = 'top 0.05s, left 0.05s'
    overlay.style.display = 'none'
    overlay.style.boxShadow = '0 0 10px rgba(128, 128, 128, 0.5)'
    document.body.appendChild(overlay)

    let menuIndex = 0
    let lastMenuNode: Element | null = null

    const getOpenMenu = () => {
      const menus = Array.from(
        document.querySelectorAll('.contexify, .react-contexify, [role="menu"]')
      ).filter((el) => {
        const style = window.getComputedStyle(el)
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.opacity !== '0'
        )
      })
      return menus[menus.length - 1]
    }

    const getMenuItems = (menu: Element) => {
      return Array.from(
        menu.querySelectorAll(
          '.contexify_item, .react-contexify__item, [role="menuitem"]'
        )
      ).filter((el) => {
        if (
          el.hasAttribute('disabled') ||
          el.classList.contains('contexify_separator') ||
          el.classList.contains('react-contexify__separator')
        )
          return false
        const rect = el.getBoundingClientRect()
        return window.getComputedStyle(el).display !== 'none' && rect.height > 0
      })
    }

    const updatePhantomBox = () => {
      const menu = getOpenMenu()
      if (!menu) {
        overlay.style.display = 'none'
        lastMenuNode = null
        return
      }

      if (menu !== lastMenuNode) {
        menuIndex = 0
        lastMenuNode = menu
      }

      const items = getMenuItems(menu)
      if (items.length === 0) return

      if (menuIndex < 0) menuIndex = items.length - 1
      if (menuIndex >= items.length) menuIndex = 0

      const activeItem = items[menuIndex]
      const contentNode =
        activeItem.querySelector(
          '.contexify_itemContent, .react-contexify__item__content'
        ) || activeItem
      const rect = contentNode.getBoundingClientRect()

      if (rect.width > 0 && rect.height > 0) {
        overlay.style.top = rect.top + 'px'
        overlay.style.left = rect.left + 'px'
        overlay.style.width = rect.width + 'px'
        overlay.style.height = rect.height + 'px'
        overlay.style.display = 'block'
      }
    }

    const handleMenuNav = (e: KeyboardEvent) => {
      const menu = getOpenMenu()
      if (menu) {
        if (e.key === 'ArrowDown') {
          menuIndex++
          updatePhantomBox()
        } else if (e.key === 'ArrowUp') {
          menuIndex--
          updatePhantomBox()
        }
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      const menu = getOpenMenu()
      if (!menu) return

      const items = getMenuItems(menu)
      items.forEach((item, index) => {
        if (item.contains(e.target as Node)) {
          menuIndex = index
          updatePhantomBox()
        }
      })
    }

    window.addEventListener('keydown', handleMenuNav, { capture: true })
    window.addEventListener('mousemove', handleMouseMove, { capture: true })
    const interval = setInterval(updatePhantomBox, 50)

    return () => {
      clearInterval(interval)
      window.removeEventListener('keydown', handleMenuNav, { capture: true })
      window.removeEventListener('mousemove', handleMouseMove, {
        capture: true
      })
      if (document.body.contains(overlay)) document.body.removeChild(overlay)
    }
  }, [])
  // ====================================================================

  // ====================================================================
  // SEU MOTOR ORIGINAL DE NAVEGAÇÃO DE SETAS (INTACTO E PROTEGIDO)
  // ====================================================================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMenuOpen = document.querySelector(
        '.contexify, .react-contexify, [role="menu"]'
      )
      if (isMenuOpen && window.getComputedStyle(isMenuOpen).display !== 'none')
        return

      const active = document.activeElement as HTMLElement
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key))
        return

      if (!active) return

      const activeRect = active.getBoundingClientRect()

      if (['INPUT', 'TEXTAREA'].includes(active.tagName)) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') return
      }
      if (
        ['SELECT'].includes(active.tagName) ||
        active.getAttribute('role') === 'combobox'
      ) {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') return
      }

      const getFocusables = () =>
        Array.from(
          document.querySelectorAll(
            'button, select, input, a, [role="button"], [role="checkbox"], [role="combobox"], [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => {
          const rect = el.getBoundingClientRect()
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            window.getComputedStyle(el).display !== 'none' &&
            window.getComputedStyle(el).visibility !== 'hidden' &&
            !el.hasAttribute('disabled')
          )
        }) as HTMLElement[]

      const isGameCard =
        active.classList.contains('gameCard') ||
        active.classList.contains('gameListItem')
      const isInTopArea =
        !!active.closest('.Header') ||
        !!active.closest('.listing > div:first-child')
      const backToTop = document.getElementById('backToTopBtn')
      const goToBottom = document.getElementById('goToBottomBtn')
      const zoomMinus = document.getElementById('zoom-minus-btn')
      const zoomPlus = document.getElementById('zoom-plus-btn')

      const isBackToTopVisible = backToTop && window.getComputedStyle(backToTop).visibility === 'visible'
      const isGoToBottomVisible = goToBottom && window.getComputedStyle(goToBottom).visibility === 'visible'
      const isZoomVisible = zoomMinus && window.getComputedStyle(zoomMinus).display !== 'none'

      const isFloatingBtn =
        active.id === 'zoom-minus-btn' ||
        active.id === 'zoom-plus-btn' ||
        active.id === 'backToTopBtn' ||
        active.id === 'goToBottomBtn'

      if (isFloatingBtn) {
        if (active.id === 'zoom-minus-btn') {
          if (e.key === 'ArrowRight') {
            e.preventDefault()
            e.stopPropagation()
            zoomPlus?.focus({ preventScroll: true })
            return
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault()
            e.stopPropagation()
            if (isGoToBottomVisible) {
              goToBottom.focus({ preventScroll: true })
            } else if (isBackToTopVisible) {
              backToTop.focus({ preventScroll: true })
            } else {
              const cards = Array.from(
                document.querySelectorAll('.gameCard, .gameListItem')
              ).filter(
                (el) => window.getComputedStyle(el).display !== 'none'
              ) as HTMLElement[]
              if (cards.length) cards[cards.length - 1].focus()
            }
            return
          }
        }

        if (active.id === 'zoom-plus-btn') {
          if (e.key === 'ArrowLeft') {
            e.preventDefault()
            e.stopPropagation()
            zoomMinus?.focus({ preventScroll: true })
            return
          }
          if (e.key === 'ArrowRight') {
            e.preventDefault()
            e.stopPropagation()
            if (isGoToBottomVisible) {
              goToBottom.focus({ preventScroll: true })
            } else if (isBackToTopVisible) {
              backToTop.focus({ preventScroll: true })
            }
            return
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault()
            e.stopPropagation()
            if (isGoToBottomVisible) {
              goToBottom.focus({ preventScroll: true })
            } else if (isBackToTopVisible) {
              backToTop.focus({ preventScroll: true })
            } else {
              const cards = Array.from(
                document.querySelectorAll('.gameCard, .gameListItem')
              ).filter(
                (el) => window.getComputedStyle(el).display !== 'none'
              ) as HTMLElement[]
              if (cards.length) cards[cards.length - 1].focus()
            }
            return
          }
        }

        if (active.id === 'goToBottomBtn') {
          if (e.key === 'ArrowUp') {
            e.preventDefault()
            e.stopPropagation()
            if (isBackToTopVisible) {
              backToTop.focus({ preventScroll: true })
            } else {
              const cards = Array.from(
                document.querySelectorAll('.gameCard, .gameListItem')
              ).filter(
                (el) => window.getComputedStyle(el).display !== 'none'
              ) as HTMLElement[]
              if (cards.length) cards[cards.length - 1].focus()
            }
            return
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            e.stopPropagation()
            if (isZoomVisible) {
              zoomPlus?.focus({ preventScroll: true })
            }
            return
          }
          if (e.key === 'ArrowLeft') {
            e.preventDefault()
            e.stopPropagation()
            if (isZoomVisible) {
              zoomPlus?.focus({ preventScroll: true })
            } else {
              const cards = Array.from(
                document.querySelectorAll('.gameCard, .gameListItem')
              ).filter(
                (el) => window.getComputedStyle(el).display !== 'none'
              ) as HTMLElement[]
              if (cards.length) cards[cards.length - 1].focus()
            }
            return
          }
        }

        if (active.id === 'backToTopBtn') {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            e.stopPropagation()
            if (isGoToBottomVisible) {
              goToBottom.focus({ preventScroll: true })
            } else if (isZoomVisible) {
              zoomPlus?.focus({ preventScroll: true })
            }
            return
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault()
            e.stopPropagation()
            const cards = Array.from(
              document.querySelectorAll('.gameCard, .gameListItem')
            ).filter(
              (el) => window.getComputedStyle(el).display !== 'none'
            ) as HTMLElement[]
            if (cards.length) cards[cards.length - 1].focus()
            return
          }
          if (e.key === 'ArrowLeft') {
            e.preventDefault()
            e.stopPropagation()
            const cards = Array.from(
              document.querySelectorAll('.gameCard, .gameListItem')
            ).filter(
              (el) => window.getComputedStyle(el).display !== 'none'
            ) as HTMLElement[]
            if (cards.length) cards[cards.length - 1].focus()
            return
          }
        }
      }

      if (isGameCard) {
        const allCards = Array.from(
          document.querySelectorAll('.gameCard, .gameListItem')
        ).filter(
          (el) => window.getComputedStyle(el).display !== 'none'
        ) as HTMLElement[]
        const currentIndex = allCards.indexOf(active)

        if (currentIndex !== -1) {
          let columns = 1
          if (allCards.length > 1) {
            const firstTop = allCards[0].getBoundingClientRect().top
            for (let i = 1; i < allCards.length; i++) {
              if (allCards[i].getBoundingClientRect().top > firstTop + 20) {
                columns = i
                break
              }
            }
            if (
              columns === 1 &&
              allCards[allCards.length - 1].getBoundingClientRect().top <=
                firstTop + 20
            ) {
              columns = allCards.length
            }
          }

          if (e.key === 'ArrowRight') {
            if (currentIndex + 1 < allCards.length) {
              e.preventDefault()
              e.stopPropagation()
              allCards[currentIndex + 1].focus({ preventScroll: true })
              allCards[currentIndex + 1].scrollIntoView({
                behavior: 'smooth',
                block: 'nearest'
              })
            }
            return
          }
          if (e.key === 'ArrowLeft') {
            if (currentIndex % columns !== 0) {
              e.preventDefault()
              e.stopPropagation()
              allCards[currentIndex - 1].focus({ preventScroll: true })
              allCards[currentIndex - 1].scrollIntoView({
                behavior: 'smooth',
                block: 'nearest'
              })
            }
            return
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            e.stopPropagation()
            const nextIndex = currentIndex + columns

            if (nextIndex < allCards.length) {
              allCards[nextIndex].focus({ preventScroll: true })
              allCards[nextIndex].scrollIntoView({
                behavior: 'smooth',
                block: 'nearest'
              })
            } else {
              const firstItemOfLastRow =
                Math.floor((allCards.length - 1) / columns) * columns

              if (currentIndex < firstItemOfLastRow) {
                allCards[allCards.length - 1].focus({ preventScroll: true })
                allCards[allCards.length - 1].scrollIntoView({
                  behavior: 'smooth',
                  block: 'nearest'
                })
              } else {
                const elementsBelow = getFocusables().filter(
                  (el) =>
                    el.getBoundingClientRect().top > activeRect.bottom - 20 &&
                    el.getBoundingClientRect().left > 200 &&
                    !el.closest('.gameCard') &&
                    !el.closest('.gameListItem') &&
                    !el.closest('#zoom-controls-container') &&
                    el.id !== 'backToTopBtn' &&
                    el.id !== 'goToBottomBtn'
                )

                if (elementsBelow.length > 0) {
                  elementsBelow.sort(
                    (a, b) =>
                      a.getBoundingClientRect().top -
                        b.getBoundingClientRect().top ||
                      a.getBoundingClientRect().left -
                        b.getBoundingClientRect().left
                  )
                  elementsBelow[0].focus({ preventScroll: true })
                  return
                }

                const btn = document.getElementById('backToTopBtn')
                const bottomBtn = document.getElementById('goToBottomBtn')
                const zoomBtn = document.getElementById('zoom-minus-btn')
                if (
                  btn &&
                  window.getComputedStyle(btn).visibility === 'visible'
                )
                  btn.focus({ preventScroll: true })
                else if (
                  bottomBtn &&
                  window.getComputedStyle(bottomBtn).visibility === 'visible'
                )
                  bottomBtn.focus({ preventScroll: true })
                else if (
                  zoomBtn &&
                  window.getComputedStyle(zoomBtn).display !== 'none'
                )
                  zoomBtn.focus({ preventScroll: true })
              }
            }
            return
          }
          if (e.key === 'ArrowUp') {
            if (currentIndex >= columns) {
              e.preventDefault()
              e.stopPropagation()
              allCards[currentIndex - columns].focus({ preventScroll: true })
              allCards[currentIndex - columns].scrollIntoView({
                behavior: 'smooth',
                block: 'nearest'
              })
              return
            }
          }
        }
      }

      const runGeometry = isInTopArea || (isGameCard && e.key === 'ArrowUp')

      if (runGeometry && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()

        const activeCX = activeRect.left + activeRect.width / 2

        let bestMatch: HTMLElement | null = null
        let bestScore = Infinity

        getFocusables().forEach((el) => {
          const rect = el.getBoundingClientRect()
          const cx = rect.left + rect.width / 2
          let score = Infinity
          const isInsideMainArea =
            !!el.closest('.Header') || !!el.closest('.listing')

          if (
            !isInsideMainArea ||
            el === active ||
            el.id.includes('zoom') ||
            el.id === 'backToTopBtn' ||
            el.id === 'goToBottomBtn'
          )
            return

          if (e.key === 'ArrowUp' && rect.top < activeRect.top - 5) {
            const dy = Math.max(0, activeRect.top - rect.bottom)
            const dx = Math.abs(activeCX - cx)
            score = dy * 20 + dx
          } else if (e.key === 'ArrowDown' && rect.top > activeRect.top + 5) {
            const dy = Math.max(0, rect.top - activeRect.bottom)
            const dx = Math.abs(activeCX - cx)
            score = dy * 20 + dx
          }

          if (score < bestScore) {
            bestScore = score
            bestMatch = el
          }
        })

        if (bestMatch) {
          ;(bestMatch as HTMLElement).focus({ preventScroll: true })
          if (
            (bestMatch as HTMLElement).classList.contains('gameCard') ||
            (bestMatch as HTMLElement).classList.contains('gameListItem')
          ) {
            ;(bestMatch as HTMLElement).scrollIntoView({
              behavior: 'smooth',
              block: 'nearest'
            })
          }
        } else if (e.key === 'ArrowUp' && isGameCard) {
          const topBtn = document.querySelector(
            '.Header input, .Header button'
          ) as HTMLElement
          if (topBtn) topBtn.focus({ preventScroll: true })
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () =>
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [])

  // ====================================================================
  // MÓDULO DOS BOTÕES B, X e Y (O MOTOR DEFINITIVO)
  // ====================================================================
  useEffect(() => {
    let reqId: number
    let lastX = false
    let lastB = false
    let lastY = false

    const actionClearSelectionB = () => {
      const active = document.activeElement as HTMLElement
      if (
        active &&
        (active.classList.contains('gameCard') ||
          active.classList.contains('gameListItem'))
      ) {
        active.blur()
        document.body.focus()
      }

      const rootElement = document.querySelector('#root') || document.body

      const events = ['keydown', 'keypress', 'keyup']
      events.forEach((eventType) => {
        const enterEvent = new KeyboardEvent(eventType, {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          composed: true,
          cancelable: true
        })
        rootElement.dispatchEvent(enterEvent)
      })
    }

    const actionFocusStoreX = () => {
      const dropdowns = Array.from(
        document.querySelectorAll(
          '[class*="select__control"], select, [role="combobox"]'
        )
      ).filter((el) => {
        const rect = el.getBoundingClientRect()
        return (
          rect.top > window.innerHeight * 0.4 &&
          !el.closest('.Header') &&
          rect.width > 0
        )
      })

      if (dropdowns.length > 0) {
        dropdowns.sort(
          (a, b) =>
            a.getBoundingClientRect().left - b.getBoundingClientRect().left
        )
        const target = dropdowns[dropdowns.length - 1] as HTMLElement

        const innerInput = target.querySelector('input')
        if (innerInput) {
          innerInput.focus({ preventScroll: true })
          innerInput.dispatchEvent(
            new KeyboardEvent('keydown', {
              key: 'ArrowDown',
              code: 'ArrowDown',
              keyCode: 40,
              bubbles: true
            })
          )
        } else {
          target.focus({ preventScroll: true })
          target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
        }
      }
    }

    const actionPlayY = () => {
      const active = document.activeElement as HTMLElement
      if (
        active &&
        (active.classList.contains('gameCard') ||
          active.classList.contains('gameListItem') ||
          active.hasAttribute('data-sn-focusable'))
      ) {
        active.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            bubbles: true
          })
        )
      }
    }

    const handleKeyboard = (e: KeyboardEvent) => {
      if (!e.isTrusted) return

      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || ''))
        return

      if (e.key.toLowerCase() === 'x') {
        e.preventDefault()
        actionFocusStoreX()
      } else if (
        e.key === 'Escape' ||
        e.key === 'Backspace' ||
        e.key.toLowerCase() === 'b'
      ) {
        e.preventDefault()
        actionClearSelectionB()
      } else if (e.key.toLowerCase() === 'y') {
        e.preventDefault()
        actionPlayY()
      }
    }

    const pollGamepad = () => {
      try {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : []
        let gpX = false
        let gpB = false
        let gpY = false

        for (const gp of gamepads) {
          if (gp && gp.buttons) {
            if (gp.buttons[2] && gp.buttons[2].pressed) gpX = true // X = 2
            if (gp.buttons[1] && gp.buttons[1].pressed) gpB = true // B = 1
            if (gp.buttons[3] && gp.buttons[3].pressed) gpY = true // Y = 3
          }
        }

        if (gpB && !lastB) actionClearSelectionB()
        if (gpX && !lastX) actionFocusStoreX()
        if (gpY && !lastY) actionPlayY()

        lastB = gpB
        lastX = gpX
        lastY = gpY
      } catch {
        // Gamepad API not available or error polling
      }
      reqId = requestAnimationFrame(pollGamepad)
    }

    window.addEventListener('keydown', handleKeyboard, { capture: true })
    reqId = requestAnimationFrame(pollGamepad)

    return () => {
      window.removeEventListener('keydown', handleKeyboard, { capture: true })
      cancelAnimationFrame(reqId)
    }
  }, [])
  // ====================================================================

  let initialStoresfilters: StoresFilters
  const storesFiltersString = storage.getItem('storesFilters')
  if (storesFiltersString) {
    initialStoresfilters = JSON.parse(storesFiltersString) as StoresFilters
  } else {
    const storedCategory = (storage.getItem('category') as Category) || 'all'
    initialStoresfilters = {
      legendary: epicCategories.includes(storedCategory),
      gog: gogCategories.includes(storedCategory),
      nile: amazonCategories.includes(storedCategory),
      sideload: sideloadedCategories.includes(storedCategory),
      zoom: zoom.enabled && zoomCategories.includes(storedCategory)
    }
  }

  const [storesFilters, setStoresFilters_] =
    useState<StoresFilters>(initialStoresfilters)

  const setStoresFilters = (newFilters: StoresFilters) => {
    storage.setItem('storesFilters', JSON.stringify(newFilters))
    setStoresFilters_(newFilters)
  }

  let initialPlatformsfilters: PlatformsFilters
  const plaformsFiltersString = storage.getItem('platformsFilters')
  if (plaformsFiltersString) {
    initialPlatformsfilters = JSON.parse(
      plaformsFiltersString
    ) as PlatformsFilters
  } else {
    const storedCategory = storage.getItem('filterPlatform') || 'all'
    initialPlatformsfilters = {
      win: ['all', 'win'].includes(storedCategory),
      linux: ['all', 'linux'].includes(storedCategory),
      mac: ['all', 'mac'].includes(storedCategory),
      browser: ['all', 'browser'].includes(storedCategory)
    }
  }

  const [platformsFilters, setPlatformsFilters_] = useState<PlatformsFilters>(
    initialPlatformsfilters
  )

  const setPlatformsFilters = (newFilters: PlatformsFilters) => {
    storage.setItem('platformsFilters', JSON.stringify(newFilters))
    setPlatformsFilters_(newFilters)
  }

  const [filterText, setFilterText] = useState('')

  const [showHidden, setShowHidden] = useState<boolean>(
    JSON.parse(storage.getItem('show_hidden') || 'false') as boolean
  )
  const handleShowHidden = (value: boolean) => {
    storage.setItem('show_hidden', JSON.stringify(value))
    setShowHidden(value)
  }

  const [showFavouritesLibrary, setShowFavourites] = useState<boolean>(
    JSON.parse(storage.getItem('show_favorites') || 'false') as boolean
  )
  const handleShowFavourites = (value: boolean) => {
    storage.setItem('show_favorites', JSON.stringify(value))
    setShowFavourites(value)
  }

  const [showInstalledOnly, setShowInstalledOnly] = useState<boolean>(
    JSON.parse(storage.getItem('show_installed_only') || 'false') as boolean
  )
  const handleShowInstalledOnly = (value: boolean) => {
    storage.setItem('show_installed_only', JSON.stringify(value))
    setShowInstalledOnly(value)
  }

  const [showNonAvailable, setShowNonAvailable] = useState<boolean>(
    JSON.parse(storage.getItem('show_non_available') || 'true') as boolean
  )
  const handleShowNonAvailable = (value: boolean) => {
    storage.setItem('show_non_available', JSON.stringify(value))
    setShowNonAvailable(value)
  }

  const [showSupportOfflineOnly, setSupportOfflineOnly] = useState<boolean>(
    JSON.parse(
      storage.getItem('show_support_offline_only') || 'false'
    ) as boolean
  )
  const handleShowSupportOfflineOnly = (value: boolean) => {
    storage.setItem('show_support_offline_only', JSON.stringify(value))
    setSupportOfflineOnly(value)
  }

  const [showThirdPartyManagedOnly, setShowThirdPartyManagedOnly] =
    useState<boolean>(
      JSON.parse(
        storage.getItem('show_third_party_managed_only') || 'false'
      ) as boolean
    )
  const handleShowThirdPartyOnly = (value: boolean) => {
    storage.setItem('show_third_party_managed_only', JSON.stringify(value))
    setShowThirdPartyManagedOnly(value)
  }

  const [showUpdatesOnly, setShowUpdatesOnly] = useState<boolean>(
    JSON.parse(storage.getItem('show_updates_only') || 'false') as boolean
  )
  const handleShowUpdatesOnly = (value: boolean) => {
    storage.setItem('show_updates_only', JSON.stringify(value))
    setShowUpdatesOnly(value)
  }

  const [showCategories, setShowCategories] = useState(false)

  // ====================================================================
  // NOVO ESCUTADOR PARA O FILTRO LIMPO (Sem tocar no Heroic original)
  // ====================================================================
  const [showUnclassifiedOnly, setShowUnclassifiedOnly] = useState(false)
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false)

  useEffect(() => {
    const handleUnclassifiedFilter = (e: Event) => {
      const customEvent = e as CustomEvent<{ active: boolean }>
      const isActive = customEvent.detail?.active || false
      setShowUnclassifiedOnly(isActive)

      if (isActive) {
        setShowDuplicatesOnly(false)
        localStorage.removeItem('heroic_active_store_filter')
        setActiveStoreFilter(null)
        window.dispatchEvent(
          new CustomEvent('heroicFilterChanged', {
            detail: { storeFilter: null }
          })
        )
      }
    }
    const handleDuplicatesFilter = (e: Event) => {
      const customEvent = e as CustomEvent<{ active: boolean }>
      const isActive = customEvent.detail?.active || false
      setShowDuplicatesOnly(isActive)

      if (isActive) {
        setShowUnclassifiedOnly(false)
        localStorage.removeItem('heroic_active_store_filter')
        setActiveStoreFilter(null)
        window.dispatchEvent(
          new CustomEvent('heroicFilterChanged', {
            detail: { storeFilter: null }
          })
        )
      }
    }

    window.addEventListener(
      'heroicToggleUnclassifiedFilter',
      handleUnclassifiedFilter
    )
    window.addEventListener(
      'heroicToggleDuplicatesFilter',
      handleDuplicatesFilter
    )
    return () => {
      window.removeEventListener(
        'heroicToggleUnclassifiedFilter',
        handleUnclassifiedFilter
      )
      window.removeEventListener(
        'heroicToggleDuplicatesFilter',
        handleDuplicatesFilter
      )
    }
  }, [])

  const [duplicatesVersion, setDuplicatesVersion] = useState(0)

  useEffect(() => {
    const handleDupChange = () => setDuplicatesVersion((v) => v + 1)
    window.addEventListener('heroicDuplicatesChanged', handleDupChange)
    return () =>
      window.removeEventListener('heroicDuplicatesChanged', handleDupChange)
  }, [])
  // ====================================================================

  const [selectedInlineGame, setSelectedInlineGame] = useState<GameInfo | null>(null)
  const [showInlineSettings, setShowInlineSettings] = useState(false)

  useEffect(() => {
    const handleSelectInlineGame = (e: Event) => {
      const customEvent = e as CustomEvent<{ game: GameInfo }>
      if (customEvent.detail?.game) {
        setSelectedInlineGame(customEvent.detail.game)
      }
    }
    window.addEventListener('heroicSelectInlineGame', handleSelectInlineGame)
    return () =>
      window.removeEventListener('heroicSelectInlineGame', handleSelectInlineGame)
  }, [])

  const [showAlphabetFilter, setShowAlphabetFilter] = useState<boolean>(
    JSON.parse(storage.getItem('showAlphabetFilter') || 'true') as boolean
  )
  const handleToggleAlphabetFilter = () => {
    const newValue = !showAlphabetFilter
    storage.setItem('showAlphabetFilter', JSON.stringify(newValue))
    setShowAlphabetFilter(newValue)
  }
  const [alphabetFilterLetter, setAlphabetFilterLetter] = useState<
    string | null
  >(null)

  const [sortDescending, setSortDescending] = useState<boolean>(
    JSON.parse(storage?.getItem('sortDescending') || 'false') as boolean
  )
  function handleSortDescending(value: boolean) {
    storage.setItem('sortDescending', JSON.stringify(value))
    setSortDescending(value)
  }

  const [sortInstalled, setSortInstalled] = useState<boolean>(
    JSON.parse(storage?.getItem('sortInstalled') || 'true') as boolean
  )
  function handleSortInstalled(value: boolean) {
    storage.setItem('sortInstalled', JSON.stringify(value))
    setSortInstalled(value)
  }

  const [sortByRecent, setSortByRecent] = useState<boolean>(() => {
    return JSON.parse(storage?.getItem('sortByRecent') || 'false') as boolean
  })
  function handleSortByRecent(value: boolean) {
    storage.setItem('sortByRecent', JSON.stringify(value))
    setSortByRecent(value)
  }

  const backToTopElement = useRef<HTMLButtonElement | null>(null)
  const goToBottomElement = useRef<HTMLButtonElement | null>(null)

  const [activeStoreFilter, setActiveStoreFilter] = useState<string | null>(
    () => localStorage.getItem('heroic_active_store_filter')
  )
  const [assignments, setAssignments] = useState<Record<string, string>>(
    () =>
      JSON.parse(
        localStorage.getItem('heroic_game_assignments') || '{}'
      ) as Record<string, string>
  )

  useEffect(() => {
    const handleFilterChange = () => {
      const storeFilter = localStorage.getItem('heroic_active_store_filter')
      setActiveStoreFilter(storeFilter)
      if (storeFilter) {
        setShowUnclassifiedOnly(false)
        window.dispatchEvent(
          new CustomEvent('heroicToggleUnclassifiedFilter', {
            detail: { active: false }
          })
        )
      }
    }
    const handleAssignmentsChange = () =>
      setAssignments(
        JSON.parse(
          localStorage.getItem('heroic_game_assignments') || '{}'
        ) as Record<string, string>
      )

    window.addEventListener('heroicFilterChanged', handleFilterChange)
    window.addEventListener('gameAssignmentsChanged', handleAssignmentsChange)

    return () => {
      window.removeEventListener('heroicFilterChanged', handleFilterChange)
      window.removeEventListener(
        'gameAssignmentsChanged',
        handleAssignmentsChange
      )
    }
  }, [])

  useLayoutEffect(() => {
    const scrollPosition = parseInt(storage?.getItem('scrollPosition') || '0')
    const scrollArea = document.getElementById('games-scroll-area')

    const storeScrollPosition = (e: Event) => {
      const target = e.target as HTMLDivElement
      storage?.setItem('scrollPosition', target.scrollTop.toString() || '0')
    }

    if (scrollArea) {
      scrollArea.addEventListener('scroll', storeScrollPosition)
      scrollArea.scrollTo(0, scrollPosition || 0)
    }

    return () => {
      if (scrollArea)
        scrollArea.removeEventListener('scroll', storeScrollPosition)
    }
  }, [])

  useEffect(() => {
    const btn = document.getElementById('backToTopBtn')
    const bottomBtn = document.getElementById('goToBottomBtn')
    const scrollArea = document.getElementById('games-scroll-area')

    const scrollCallback = (e: Event) => {
      const target = e.target as HTMLDivElement
      if (target) {
        const isScrolledPast = target.scrollTop > 450
        if (btn) {
          btn.style.visibility = isScrolledPast ? 'visible' : 'hidden'
        }
        if (bottomBtn) {
          const isScrollable = target.scrollHeight > target.clientHeight
          const isNearBottom = target.scrollTop + target.clientHeight > target.scrollHeight - 450
          bottomBtn.style.visibility = (isScrolledPast && isScrollable && !isNearBottom) ? 'visible' : 'hidden'
        }
      }
    }

    if (scrollArea) {
      scrollArea.addEventListener('scroll', scrollCallback)
      const isScrolledPast = scrollArea.scrollTop > 450
      if (btn) {
        btn.style.visibility = isScrolledPast ? 'visible' : 'hidden'
      }
      if (bottomBtn) {
        const isScrollable = scrollArea.scrollHeight > scrollArea.clientHeight
        const isNearBottom = scrollArea.scrollTop + scrollArea.clientHeight > scrollArea.scrollHeight - 450
        bottomBtn.style.visibility = (isScrolledPast && isScrollable && !isNearBottom) ? 'visible' : 'hidden'
      }
    } else {
      if (btn) {
        btn.style.visibility = 'hidden'
      }
      if (bottomBtn) {
        bottomBtn.style.visibility = 'hidden'
      }
    }

    return () => {
      if (scrollArea) scrollArea.removeEventListener('scroll', scrollCallback)
    }
  }, [showInlineSettings])

  const prevShowInlineSettingsRef = useRef(showInlineSettings)

  useEffect(() => {
    if (prevShowInlineSettingsRef.current && !showInlineSettings && selectedInlineGame) {
      setTimeout(() => {
        const scrollArea = document.getElementById('games-scroll-area')
        if (scrollArea) {
          const card = scrollArea.querySelector(`[data-app-name="${selectedInlineGame.app_name}"]`) as HTMLElement
          if (card) {
            card.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
          }
        }
      }, 50)
    }
    prevShowInlineSettingsRef.current = showInlineSettings
  }, [showInlineSettings, selectedInlineGame])

  const backToTop = () => {
    const scrollArea = document.getElementById('games-scroll-area')
    if (scrollArea) {
      scrollArea.scrollTo({ top: 0, behavior: 'smooth' })
      setTimeout(() => {
        const firstCard = scrollArea.querySelector(
          '[data-sn-focusable="true"], .gameCard'
        ) as HTMLElement
        if (firstCard) {
          firstCard.focus({ preventScroll: true })
        }
      }, 50)
    }
  }

  const goToBottom = () => {
    const scrollArea = document.getElementById('games-scroll-area')
    if (scrollArea) {
      scrollArea.scrollTo({ top: scrollArea.scrollHeight, behavior: 'smooth' })
      setTimeout(() => {
        const cards = scrollArea.querySelectorAll(
          '[data-sn-focusable="true"], .gameCard'
        )
        const lastCard = cards[cards.length - 1] as HTMLElement
        if (lastCard) {
          lastCard.focus({ preventScroll: true })
        }
      }, 50)
    }
  }

  // Listen to selection mode changes reactively
  useEffect(() => {
    const handleModeChange = () => {
      const active = localStorage.getItem('heroic_use_inline_panel') !== 'false'
      if (!active) {
        setSelectedInlineGame(null)
      }
    }
    window.addEventListener('heroicUseInlinePanelChanged', handleModeChange)
    return () => window.removeEventListener('heroicUseInlinePanelChanged', handleModeChange)
  }, [])

  // Listen to select game inline events
  useEffect(() => {
    const handleSelectGame = (e: Event) => {
      const customEvent = e as CustomEvent<{ gameInfo: GameInfo }>
      const game = customEvent.detail.gameInfo
      setSelectedInlineGame((current) => {
        if (current?.app_name === game.app_name && current?.runner === game.runner) {
          return null
        }
        return game
      })
    }
    window.addEventListener('heroicSelectGameInline', handleSelectGame)
    return () => window.removeEventListener('heroicSelectGameInline', handleSelectGame)
  }, [])

  // Notify cards when active selection changes
  const prevSelectedRef = useRef<{ appName: string | null; runner: Runner | null }>({
    appName: null,
    runner: null
  })

  useEffect(() => {
    const currentAppName = selectedInlineGame?.app_name || null
    const currentRunner = selectedInlineGame?.runner || null

    window.dispatchEvent(new CustomEvent('heroicSelectedGameChanged', {
      detail: {
        appName: currentAppName,
        runner: currentRunner
      }
    }))

    // Only close settings if the selected game has actually changed to a DIFFERENT game (or null)
    if (
      currentAppName !== prevSelectedRef.current.appName ||
      currentRunner !== prevSelectedRef.current.runner
    ) {
      if ((window as any).heroicKeepInlineSettingsOpen) {
        (window as any).heroicKeepInlineSettingsOpen = false
      } else {
        setShowInlineSettings(false)
      }
    }

    prevSelectedRef.current = { appName: currentAppName, runner: currentRunner }
  }, [selectedInlineGame])



  const handleModal = useCallback((
    appName: string,
    runner: Runner,
    gameInfo?: GameInfo
  ) => {
    if (gameInfo) {
      setSelectedInlineGame((current) => {
        if (current?.app_name === appName && current?.runner === runner) {
          return null
        }
        return gameInfo
      })
    }
  }, [])

  const installing: string[] = useMemo(
    () =>
      (libraryStatus as { status: string; appName: string }[])
        .filter((st) => st.status === 'installing')
        .map((st) => st.appName),
    [libraryStatus]
  )

  const filterByPlatform = useCallback(
    (library: GameInfo[]) => {
      if (!library) {
        return []
      }

      let displayedPlatforms: string[] = []
      if (platformsFilters['win']) displayedPlatforms.push('win')
      if (platformsFilters['mac'] && platform === 'darwin')
        displayedPlatforms.push('mac')
      if (platformsFilters['linux'] && platform === 'linux')
        displayedPlatforms.push('linux')
      if (platformsFilters['browser']) displayedPlatforms.push('browser')

      if (!displayedPlatforms.length) {
        displayedPlatforms = Object.keys(platformsFilters)
      }

      if (displayedPlatforms.includes('win')) displayedPlatforms.push('windows')
      if (displayedPlatforms.includes('mac'))
        displayedPlatforms.push('osx', 'Mac')

      return library.filter((game) => {
        let gamePlatforms: string[] = []

        if (game?.is_installed) {
          gamePlatforms = [game?.install?.platform?.toLowerCase() || 'windows']
        } else {
          if (game.is_linux_native && platform === 'linux') {
            gamePlatforms.push('linux')
          }
          if (game.is_mac_native && platform === 'darwin') {
            gamePlatforms.push('mac')
          }
          gamePlatforms.push('windows')
        }
        return gamePlatforms.some((plat) => displayedPlatforms.includes(plat))
      })
    },
    [platformsFilters, platform]
  )

  const showRecentGames = libraryTopSection.startsWith('recently_played')

  const favouriteGamesList = useMemo(() => {
    if (showHidden) {
      return favouriteGames.list
    }

    const hiddenAppNames = hiddenGames.list.map(
      (hidden: HiddenGame) => hidden.appName
    )

    return favouriteGames.list.filter(
      (game) => !hiddenAppNames.includes(game.appName)
    )
  }, [favouriteGames, showHidden, hiddenGames])

  const showFavourites =
    libraryTopSection === 'favourites' && !!favouriteGamesList.length

  const favourites = useMemo(() => {
    const tempArray: GameInfo[] = []
    if (showFavourites || showFavouritesLibrary) {
      const favouriteAppNames = favouriteGamesList.map(
        (favourite: FavouriteGame) => favourite.appName
      )
      epic.library.forEach((game) => {
        if (favouriteAppNames.includes(game.app_name)) tempArray.push(game)
      })
      gog.library.forEach((game) => {
        if (favouriteAppNames.includes(game.app_name)) tempArray.push(game)
      })
      sideloadedLibrary.forEach((game) => {
        if (favouriteAppNames.includes(game.app_name)) tempArray.push(game)
      })
      amazon.library.forEach((game) => {
        if (favouriteAppNames.includes(game.app_name)) tempArray.push(game)
      })
      zoom.library.forEach((game) => {
        if (favouriteAppNames.includes(game.app_name)) tempArray.push(game)
      })
    }
    return tempArray.sort((a, b) => {
      const gameA = a.title.toUpperCase().replace('THE ', '')
      const gameB = b.title.toUpperCase().replace('THE ', '')
      return gameA.localeCompare(gameB)
    })
  }, [
    showFavourites,
    showFavouritesLibrary,
    favouriteGamesList,
    epic,
    gog,
    amazon,
    sideloadedLibrary,
    zoom
  ])

  const favouritesIds = useMemo(() => {
    return favourites.map((game) => `${game.app_name}_${game.runner}`)
  }, [favourites])

  const makeLibrary = useCallback(() => {
    return [
      ...(sideloadedLibrary ?? []),
      ...(epic.library ?? []),
      ...(gog.library ?? []),
      ...(amazon.library ?? []),
      ...(zoom.library ?? [])
    ]
  }, [epic.library, gog.library, amazon.library, zoom.library, sideloadedLibrary])

  // Keep selectedInlineGame synchronized with the latest library data
  useEffect(() => {
    if (!selectedInlineGame) return

    const allGames = makeLibrary()
    const latestGame = allGames.find(
      (g) => g.app_name === selectedInlineGame.app_name && g.runner === selectedInlineGame.runner
    )

    if (latestGame) {
      if (
        latestGame.title !== selectedInlineGame.title ||
        latestGame.overrides?.title !== selectedInlineGame.overrides?.title ||
        latestGame.art_cover !== selectedInlineGame.art_cover ||
        latestGame.overrides?.art_cover !== selectedInlineGame.overrides?.art_cover ||
        latestGame.art_square !== selectedInlineGame.art_square ||
        latestGame.overrides?.art_square !== selectedInlineGame.overrides?.art_square ||
        latestGame.is_installed !== selectedInlineGame.is_installed ||
        JSON.stringify(latestGame.install) !== JSON.stringify(selectedInlineGame.install)
      ) {
        setSelectedInlineGame(latestGame)
      }
    }
  }, [epic, gog, sideloadedLibrary, amazon, zoom, selectedInlineGame, makeLibrary])

  useEffect(() => {
    if (
      epic.library.length ||
      gog.library.length ||
      amazon.library.length ||
      zoom.library.length
    ) {
      syncAutoStoreAssignments(
        epic.library,
        gog.library,
        amazon.library,
        zoom.library
      )
    }

    if (customCategories && customCategories.removeCategory) {
      const autoInjected = ['Epic Games', 'GOG', 'Amazon Games', 'Zoom Platform']
      autoInjected.forEach((cat) => {
        if (customCategories.listCategories().includes(cat)) {
          customCategories.removeCategory(cat)
        }
      })
    }
  }, [
    epic.library,
    gog.library,
    amazon.library,
    zoom.library,
    customCategories
  ])

  const gamesForAlphabetFilter = useMemo(() => {
    let library: Array<GameInfo> = makeLibrary()

    if (showFavouritesLibrary) {
      library = library.filter((game) =>
        favouritesIds.includes(`${game.app_name}_${game.runner}`)
      )
    } else {
      library = library.filter((game) => !game.install.is_dlc)

      if (currentCustomCategories && currentCustomCategories.length > 0) {
        const gamesInSelectedCategories = new Set<string>()

        currentCustomCategories.forEach((category) => {
          if (category === 'preset_uncategorized') {
            const categorizedGames = Array.from(
              new Set(Object.values(customCategories.list).flat())
            )

            library.forEach((game) => {
              if (
                !categorizedGames.includes(`${game.app_name}_${game.runner}`)
              ) {
                gamesInSelectedCategories.add(`${game.app_name}_${game.runner}`)
              }
            })
          } else {
            const gamesInCustomCategory = customCategories.list[category]

            if (gamesInCustomCategory) {
              gamesInCustomCategory.forEach((game) => {
                gamesInSelectedCategories.add(game)
              })
            }
          }
        })

        library = library.filter((game) => {
          const mainKey = `${game.app_name}_${game.runner}`
          const legKey = `${game.app_name}_legendary`
          const epicKey = `${game.app_name}_epic`
          const nileKey = `${game.app_name}_nile`
          const amzKey = `${game.app_name}_amazon`
          const gogKey = `${game.app_name}_gog`
          const steamKey = `${game.app_name}_steam`
          const zoomKey = `${game.app_name}_zoom`

          return (
            gamesInSelectedCategories.has(mainKey) ||
            gamesInSelectedCategories.has(legKey) ||
            gamesInSelectedCategories.has(epicKey) ||
            gamesInSelectedCategories.has(nileKey) ||
            gamesInSelectedCategories.has(amzKey) ||
            gamesInSelectedCategories.has(gogKey) ||
            gamesInSelectedCategories.has(steamKey) ||
            gamesInSelectedCategories.has(zoomKey) ||
            gamesInSelectedCategories.has(game.app_name)
          )
        })
      }

      if (showSupportOfflineOnly) {
        library = library.filter((game) => game.canRunOffline)
      }

      if (showThirdPartyManagedOnly) {
        library = library.filter((game) => !!game.thirdPartyManagedApp)
      }

      if (showUpdatesOnly) {
        library = library.filter((game) => gameUpdates.includes(game.app_name))
      }

      if (!showNonAvailable) {
        const nonAvailbleGames = storage.getItem('nonAvailableGames') || '[]'
        const nonAvailbleGamesArray = JSON.parse(nonAvailbleGames) as string[]
        library = library.filter(
          (game) => !nonAvailbleGamesArray.includes(game.app_name)
        )
      }

      if (showInstalledOnly) {
        library = library.filter((game) => game.is_installed)
      }
    }

    try {
      const filteredLibrary = filterByPlatform(library)
      const searchableLibrary: SearchableGame[] = filteredLibrary.map(
        (game) => {
          const title = game.overrides?.title || game.title
          return {
            original: game,
            title,
            normalizedTitle: normalizeTitle(title)
          }
        }
      )

      const options = {
        minMatchCharLength: 1,
        threshold: 0.4,
        useExtendedSearch: true,
        keys: ['title', 'normalizedTitle']
      }
      const fuse = new Fuse(searchableLibrary, options)

      if (filterText) {
        const fuzzySearch: GameInfo[] = fuse
          .search(filterText)
          .map(
            (result: { item: { original: GameInfo } }) => result.item.original
          )
        library = fuzzySearch
      } else {
        library = filteredLibrary
      }
    } catch (error) {
      console.log(error)
    }

    const hiddenGamesAppNames = hiddenGames.list.map(
      (hidden: HiddenGame) => hidden?.appName
    )

    if (!showHidden) {
      library = library.filter(
        (game) => !hiddenGamesAppNames.includes(game?.app_name)
      )
    }

    return library
  }, [
    filterText,
    showHidden,
    hiddenGames,
    showFavouritesLibrary,
    favouritesIds,
    currentCustomCategories,
    customCategories,
    showInstalledOnly,
    showNonAvailable,
    showSupportOfflineOnly,
    showThirdPartyManagedOnly,
    showUpdatesOnly,
    gameUpdates,
    filterByPlatform,
    makeLibrary
  ])

  const libraryToShow = useMemo(() => {
    let library = [...gamesForAlphabetFilter]

    if (alphabetFilterLetter) {
      library = library.filter((game) => {
        const title = game.overrides?.title || game.title
        if (!title) return false

        const processedTitle = title.replace(/^the\s/i, '')
        const firstCharMatch = processedTitle.match(/[a-zA-Z0-9]/)
        if (!firstCharMatch) return false
        const firstChar = firstCharMatch[0].toUpperCase()

        if (alphabetFilterLetter === '#') {
          return /[0-9]/.test(firstChar)
        } else {
          return firstChar === alphabetFilterLetter
        }
      })
    }

    // ====================================================================
    // O FILTRO INDEPENDENTE QUE DEIXA O HEROIC EM PAZ
    // ====================================================================
    if (showDuplicatesOnly) {
      const allGames = makeLibrary()
      const duplicateIds = getDuplicateGameIds(allGames)
      const duplicateGames = allGames.filter((game) => {
        if (!game || game.install?.is_dlc) return false
        const runner = game.runner || 'sideload'
        const gameId = `${game.app_name}_${runner}`
        return duplicateIds.has(gameId) || duplicateIds.has(game.app_name)
      })
      return duplicateGames.sort((a, b) => {
        const titleA = normalizeTitleForDuplicateCheck(
          a.overrides?.title || a.title || ''
        )
        const titleB = normalizeTitleForDuplicateCheck(
          b.overrides?.title || b.title || ''
        )
        return titleA.localeCompare(titleB)
      })
    } else if (showUnclassifiedOnly) {
      const safeCategoriesList =
        customCategories && customCategories.list ? customCategories.list : {}
      const categorizedGames = new Set(Object.values(safeCategoriesList).flat())

      library = library.filter((game) => {
        if (!game || game.install?.is_dlc) return false
        const explicitlyAssignedStore = assignments[game.app_name]
        const runner = game.runner || 'sideload'
        const gameId = `${game.app_name}_${runner}`

        const hasCategory =
          categorizedGames.has(gameId) ||
          categorizedGames.has(game.app_name) ||
          categorizedGames.has(`${game.app_name}_sideload`)
        const hasAssignment = !!explicitlyAssignedStore

        return !hasCategory && !hasAssignment
      })
    } else if (activeStoreFilter) {
      library = library.filter((game) => {
        const explicitlyAssignedStore = (assignments[game.app_name] || '').toLowerCase()
        const activeFilterLower = activeStoreFilter.toLowerCase()
        const runnerLower = (game.runner || '').toLowerCase()

        if (explicitlyAssignedStore) {
          if (explicitlyAssignedStore === activeFilterLower) return true
          if (
            (activeFilterLower === 'epic' || activeFilterLower === 'legendary') &&
            (explicitlyAssignedStore === 'epic' ||
              explicitlyAssignedStore === 'legendary' ||
              explicitlyAssignedStore === 'epic games')
          )
            return true
          if (
            (activeFilterLower === 'amazon' || activeFilterLower === 'nile') &&
            (explicitlyAssignedStore === 'amazon' ||
              explicitlyAssignedStore === 'nile' ||
              explicitlyAssignedStore === 'amazon games')
          )
            return true
          if (activeFilterLower === 'gog' && explicitlyAssignedStore === 'gog') return true
          if (activeFilterLower === 'steam' && explicitlyAssignedStore === 'steam') return true
          if (activeFilterLower === 'zoom' && explicitlyAssignedStore === 'zoom') return true
          if (
            (activeFilterLower === 'sideloaded' || activeFilterLower === 'sideload') &&
            (explicitlyAssignedStore === 'sideload' || explicitlyAssignedStore === 'sideloaded')
          )
            return true
        }

        if (
          (activeFilterLower === 'epic' || activeFilterLower === 'legendary') &&
          (runnerLower === 'legendary' || runnerLower === 'epic')
        )
          return true
        if (activeFilterLower === 'gog' && runnerLower === 'gog') return true
        if (
          (activeFilterLower === 'amazon' || activeFilterLower === 'nile') &&
          (runnerLower === 'nile' || runnerLower === 'amazon')
        )
          return true
        if (activeFilterLower === 'steam' && runnerLower === 'steam') return true
        if (activeFilterLower === 'zoom' && runnerLower === 'zoom') return true
        if (
          (activeFilterLower === 'sideloaded' || activeFilterLower === 'sideload') &&
          (runnerLower === 'sideload' || runnerLower === 'sideloaded')
        )
          return true

        return false
      })
    }

    library = library.sort((a, b) => {
      const gameA = a.title.toUpperCase().replace('THE ', '')
      const gameB = b.title.toUpperCase().replace('THE ', '')
      return sortDescending
        ? -gameA.localeCompare(gameB)
        : gameA.localeCompare(gameB)
    })

    if (sortByRecent) {
      const recentGames = configStore.get('games.recent', [])
      const recentAppNames = recentGames.map((rg: any) => rg.appName)
      const recentPart: GameInfo[] = []
      const remainingPart = [...library]

      for (const appName of recentAppNames) {
        if (recentPart.length >= 12) break
        const idx = remainingPart.findIndex((g) => g.app_name === appName)
        if (idx !== -1) {
          recentPart.push(remainingPart[idx])
          remainingPart.splice(idx, 1)
        }
      }
      library = [...recentPart, ...remainingPart]
    } else {
      const installed = library.filter((game) => game?.is_installed)
      const notInstalled = library.filter(
        (game) => !game?.is_installed && !installing.includes(game?.app_name)
      )
      const installingGames = library.filter(
        (g) => !g.is_installed && installing.includes(g.app_name)
      )

      library = sortInstalled
        ? [...installed, ...installingGames, ...notInstalled]
        : library
    }

    return [...library]
  }, [
    gamesForAlphabetFilter,
    alphabetFilterLetter,
    sortDescending,
    sortInstalled,
    sortByRecent,
    installing,
    activeStoreFilter,
    assignments,
    customCategories,
    showUnclassifiedOnly,
    showDuplicatesOnly,
    duplicatesVersion,
    makeLibrary,
    epic,
    gog,
    amazon,
    zoom,
    sideloadedLibrary
  ])

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null

    const setHeaderHightCSS = () => {
      if (timer) clearTimeout(timer)

      timer = setTimeout(() => {
        const header = document.querySelector('.Header')
        if (header) {
          const headerHeight = header.getBoundingClientRect().height
          document.documentElement.style.setProperty(
            '--header-height',
            `${headerHeight}px`
          )
          const libraryHeader =
            document.querySelector<HTMLDivElement>('.libraryHeader')
          if (libraryHeader)
            libraryHeader.style.setProperty(
              '--header-height',
              `${headerHeight}px`
            )
        }
      }, 50)
    }
    setHeaderHightCSS()
    window.addEventListener('resize', setHeaderHightCSS)

    return () => {
      window.removeEventListener('resize', setHeaderHightCSS)
    }
  }, [])

  if (!epic && !gog && !amazon && !zoom) {
    return (
      <ErrorComponent
        message={t(
          'generic.error.component',
          'No Games found - Try to logout and login again or one of the options bellow'
        )}
      />
    )
  }

  return (
    <LibraryContext.Provider
      value={{
        storesFilters,
        platformsFilters,
        layout,
        showHidden,
        showFavourites: showFavouritesLibrary,
        showInstalledOnly,
        showNonAvailable,
        filterText,
        setStoresFilters,
        handleLayout: handleLayout,
        setPlatformsFilters,
        handleSearch: setFilterText,
        setShowHidden: handleShowHidden,
        setShowFavourites: handleShowFavourites,
        setShowInstalledOnly: handleShowInstalledOnly,
        setShowNonAvailable: handleShowNonAvailable,
        setSortDescending: handleSortDescending,
        setSortInstalled: handleSortInstalled,
        showSupportOfflineOnly,
        setShowSupportOfflineOnly: handleShowSupportOfflineOnly,
        showThirdPartyManagedOnly,
        setShowThirdPartyManagedOnly: handleShowThirdPartyOnly,
        showUpdatesOnly,
        setShowUpdatesOnly: handleShowUpdatesOnly,
        sortDescending,
        sortInstalled,
        sortByRecent,
        setSortByRecent: handleSortByRecent,
        handleAddGameButtonClick: () =>
          openInstallGameModal({ appName: '', runner: 'sideload', gameInfo: null }),
        setShowCategories,
        showAlphabetFilter: showAlphabetFilter,
        onToggleAlphabetFilter: handleToggleAlphabetFilter,
        gamesForAlphabetFilter,
        alphabetFilterLetter,
        setAlphabetFilterLetter,
        showUnclassifiedOnly
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100vh - 32px)'
        }}
      >
        <Header />
        <LibraryTour />
        <LibraryHeader list={libraryToShow} />

        <div
          className="listing"
          data-sn-section="main-games-grid"
          style={{
            display: 'flex',
            flexDirection: 'row',
            flex: 1,
            minHeight: 0,
            paddingTop: '4px'
          }}
        >
          {selectedInlineGame && (
            <HeroPanel 
              game={selectedInlineGame} 
              onClose={() => setSelectedInlineGame(null)} 
              onSettingsClick={() => setShowInlineSettings(true)}
            />
          )}

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
            {showInlineSettings && selectedInlineGame && (
              <InlineGameSettings 
                game={selectedInlineGame} 
                onClose={() => setShowInlineSettings(false)} 
              />
            )}

            <div
              style={{
                display: showInlineSettings && selectedInlineGame ? 'none' : 'flex',
                flexDirection: 'column',
                flex: 1,
                minHeight: 0
              }}
            >
              <div style={{ flexShrink: 0 }}>
                {showRecentGames && (
                  <RecentlyPlayed
                    handleModal={handleModal}
                    onlyInstalled={libraryTopSection.endsWith('installed')}
                    showHidden={showHidden}
                  />
                )}

                {showFavourites && !showFavouritesLibrary && (
                  <>
                    <div
                      className="library-section-header"
                      data-tour="library-header"
                    >
                      <h3 className="libraryHeader">
                        {t('favourites', 'Favourites')}
                      </h3>
                    </div>
                    <GamesList
                      library={favourites}
                      handleGameCardClick={handleModal}
                      isFavourite
                      isFirstLane
                    />
                  </>
                )}
              </div>

              <div
                id="games-scroll-area"
                data-sn-section="main-games-grid"
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  minHeight: 0,
                  paddingBottom: '30px',
                  paddingRight: '8px',
                  marginTop: '0px',
                  paddingTop: '6px'
                }}
              >
                <span id="top" />
                {refreshing && !refreshingInTheBackground && <UpdateComponent />}
                {libraryToShow.length === 0 && <EmptyLibraryMessage />}
                {libraryToShow.length > 0 &&
                  (!refreshing || refreshingInTheBackground) && (
                    <GamesList
                      library={libraryToShow}
                      layout={layout}
                      handleGameCardClick={handleModal}
                    />
                  )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <button
        id="goToBottomBtn"
        onClick={goToBottom}
        ref={goToBottomElement}
        tabIndex={0}
        data-sn-focusable="true"
      >
        <ArrowDropDown id="goToBottomArrow" className="material-icons" />
      </button>

      <button
        id="backToTopBtn"
        onClick={backToTop}
        ref={backToTopElement}
        tabIndex={0}
        data-sn-focusable="true"
      >
        <ArrowDropUp id="backToTopArrow" className="material-icons" />
      </button>

      {layout === 'grid' && (
        <div
          id="zoom-controls-container"
          style={{
            position: 'fixed',
            bottom: '-3px',
            right: '50px',
            height: '38px',
            padding: '0 12px',
            zIndex: 9998,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            userSelect: 'none'
          }}
        >
          <button
            id="zoom-minus-btn"
            onClick={() => {
              const steps = [160, 180, 210, 240, 280, 340, 360]
              let idx = steps.indexOf(cardZoom)
              if (idx === -1) {
                const smallerSteps = steps.filter(s => s < cardZoom)
                idx = smallerSteps.length > 0 ? steps.indexOf(smallerSteps[smallerSteps.length - 1]) : 0
              } else {
                idx = Math.max(0, idx - 1)
              }
              const newVal = steps[idx]
              setCardZoom(newVal)
              storage.setItem('heroic_card_zoom', newVal.toString())
              setTimeout(
                () => document.getElementById('zoom-minus-btn')?.focus(),
                10
              )
            }}
            tabIndex={0}
            data-sn-focusable="true"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.7)',
              cursor: 'pointer',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              transition: 'all 0.2s ease',
              padding: 0
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(0, 255, 255, 0.1)'
              e.currentTarget.style.color = '#00ffff'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)'
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>

          <span
            style={{
              fontSize: '12px',
              fontWeight: '600',
              minWidth: '42px',
              textAlign: 'center',
              color: 'rgba(255, 255, 255, 0.9)',
              fontFamily: 'inherit'
            }}
          >
            {cardZoom}px
          </span>

          <button
            id="zoom-plus-btn"
            onClick={() => {
              const steps = [160, 180, 210, 240, 280, 340, 360]
              let idx = steps.indexOf(cardZoom)
              if (idx === -1) {
                const largerSteps = steps.filter(s => s > cardZoom)
                idx = largerSteps.length > 0 ? steps.indexOf(largerSteps[0]) : steps.length - 1
              } else {
                idx = Math.min(steps.length - 1, idx + 1)
              }
              const newVal = steps[idx]
              setCardZoom(newVal)
              storage.setItem('heroic_card_zoom', newVal.toString())
              setTimeout(
                () => document.getElementById('zoom-plus-btn')?.focus(),
                10
              )
            }}
            tabIndex={0}
            data-sn-focusable="true"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.7)',
              cursor: 'pointer',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              transition: 'all 0.2s ease',
              padding: 0
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(0, 255, 255, 0.1)'
              e.currentTarget.style.color = '#00ffff'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)'
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>

          <div
            style={{
              height: '14px',
              width: '1px',
              background: 'rgba(255, 255, 255, 0.15)'
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', color: '#00ffff' }} title="Tamanho das Capas">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>

          <style>{`
             .gameList {
              grid-template-columns: repeat(auto-fill, minmax(${cardZoom}px, 1fr)) !important;
              gap: 20px !important; 
              padding: 15px 20px 20px 20px !important;
            }
            .gameCard {
              scroll-margin-top: 150px !important;
              scroll-margin-bottom: 50px !important;
            }
            .gameCard:focus-within {
              z-index: 100 !important;
            }
            
            /* Indicador de foco brutal para Dropdowns, Inputs e Checkboxes (excluindo a barra de pesquisa) */
            select:focus, [role="combobox"]:focus, input:focus:not(.searchBarInput), [role="checkbox"]:focus {
              outline: 3px solid #4CAF50 !important;
              outline-offset: 2px !important;
              box-shadow: 0 0 10px rgba(76, 175, 80, 0.8) !important;
              border-radius: 4px !important;
              transition: all 0.2s ease-in-out !important;
            }
          `}</style>
        </div>
      )}

      {showCategories && <CategoriesManager />}

      <div
        id="backup-status-container"
        className="footer-cloud-backup"
        onClick={handleCloudIconClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          position: 'fixed',
          bottom: '-3px',
          left: 'calc(var(--sidebar-width, 60px) + 15px)',
          height: '38px',
          zIndex: 9998,
          display: 'flex',
          alignItems: 'center',
          userSelect: 'none',
          cursor: isUploading ? 'default' : 'pointer'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            flexShrink: 0,
            transition: 'background 0.3s ease',
            background: 'transparent'
          }}
        >
          <FontAwesomeIcon
            icon={isUploading ? faSpinner : faCloud}
            spin={isUploading}
            style={{
              color: cloudColor,
              fontSize: '17px',
              transition: 'color 0.3s ease'
            }}
          />
        </div>
        
        <span
          style={{
            marginLeft: '8px',
            fontSize: '13px',
            color: 'rgba(255, 255, 255, 0.8)',
            opacity: isHovered ? 1 : 0,
            transform: isHovered ? 'translateX(0)' : 'translateX(-5px)',
            whiteSpace: 'nowrap',
            transition: 'opacity 0.2s ease, transform 0.2s ease',
            pointerEvents: 'none',
            fontWeight: 500,
            letterSpacing: '0.2px'
          }}
        >
          {cloudLabel}
        </span>
      </div>
    </LibraryContext.Provider>
  )
})

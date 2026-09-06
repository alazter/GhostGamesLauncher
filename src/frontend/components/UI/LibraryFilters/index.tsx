import { useContext, useState, useEffect } from 'react'
import ToggleSwitch from '../ToggleSwitch'
import { useTranslation } from 'react-i18next'
import LibraryContext from 'frontend/screens/Library/LibraryContext'
import { PlatformsFilters, CustomStore, StoresFilters } from 'frontend/types'
import ContextProvider from 'frontend/state/ContextProvider'
import Dropdown from '../Dropdown'
import { DEFAULT_GHOST_CUSTOM_STORES } from 'frontend/helpers/defaultCustomStores'

export default function LibraryFilters() {
  const { t } = useTranslation()
  const { platform } = useContext(ContextProvider)
  const {
    setShowFavourites,
    setShowHidden,
    setShowInstalledOnly,
    setShowNonAvailable,
    showFavourites,
    showHidden,
    showInstalledOnly,
    showNonAvailable,
    storesFilters,
    setStoresFilters,
    platformsFilters,
    setPlatformsFilters,
    showSupportOfflineOnly,
    setShowSupportOfflineOnly,
    showThirdPartyManagedOnly,
    setShowThirdPartyManagedOnly,
    showUpdatesOnly,
    setShowUpdatesOnly,
    sortByRecent,
    setSortByRecent,
    sortByNewlyAdded,
    setSortByNewlyAdded,
    sortByMostPlayed,
    setSortByMostPlayed,
    showPlaytestsAndDemos,
    setShowPlaytestsAndDemos
  } = useContext(LibraryContext)

  const [customStores, setCustomStores] = useState<CustomStore[]>(() => {
    const saved = localStorage.getItem('heroic_custom_stores')
    if (saved) {
      try {
        return JSON.parse(saved) as CustomStore[]
      } catch {}
    }
    return DEFAULT_GHOST_CUSTOM_STORES
  })

  useEffect(() => {
    const handleStoresChange = () => {
      const saved = localStorage.getItem('heroic_custom_stores')
      if (saved) {
        try {
          setCustomStores(JSON.parse(saved) as CustomStore[])
        } catch {}
      }
    }
    window.addEventListener('customStoresChanged', handleStoresChange)
    return () => window.removeEventListener('customStoresChanged', handleStoresChange)
  }, [])

  const [showHiddenDuplicates, setShowHiddenDuplicates] = useState<boolean>(() => {
    return localStorage.getItem('heroic_show_hidden_duplicates') === 'true'
  })

  const toggleShowHiddenDuplicates = () => {
    const nextVal = !showHiddenDuplicates
    setShowHiddenDuplicates(nextVal)
    localStorage.setItem('heroic_show_hidden_duplicates', String(nextVal))
    window.dispatchEvent(new Event('heroicDuplicatesChanged'))
  }

  const toggleShowPlaytestsAndDemos = () => {
    if (setShowPlaytestsAndDemos) {
      setShowPlaytestsAndDemos(!showPlaytestsAndDemos)
    }
  }

  const toggleShowHidden = () => {
    setShowHidden(!showHidden)
  }

  const toggleShowNonAvailable = () => {
    setShowNonAvailable(!showNonAvailable)
  }

  const toggleOnlyFavorites = () => {
    setShowFavourites(!showFavourites)
  }

  const toggleOnlyInstalled = () => {
    setShowInstalledOnly(!showInstalledOnly)
  }

  const toggleOnlySupportOffline = () => {
    setShowSupportOfflineOnly(!showSupportOfflineOnly)
  }

  const toggleThirdParty = () => {
    setShowThirdPartyManagedOnly(!showThirdPartyManagedOnly)
  }

  const toggleUpdatesOnly = () => {
    setShowUpdatesOnly(!showUpdatesOnly)
  }

  const toggleStoreFilter = (storeId: string) => {
    const currentValue = storesFilters[storeId] !== false
    const newFilters: StoresFilters = { ...storesFilters, [storeId]: !currentValue }

    const storeObj = customStores.find((s) => s.id === storeId)
    const nameLower = (storeObj?.name || storeId).toLowerCase()
    const idLower = storeId.toLowerCase()

    if (nameLower.includes('epic') || idLower === 'epic') newFilters['legendary'] = !currentValue
    if (nameLower.includes('gog') || idLower === 'gog') newFilters['gog'] = !currentValue
    if (nameLower.includes('amazon') || idLower === 'amazon') newFilters['nile'] = !currentValue
    if (nameLower.includes('zoom') || idLower === 'zoom') newFilters['zoom'] = !currentValue
    if (nameLower.includes('steam') || idLower === 'steam') newFilters['steam'] = !currentValue
    if (nameLower.includes('sideload') || idLower === 'sideload' || nameLower.includes('pirata') || nameLower.includes('indie')) {
      newFilters['sideload'] = !currentValue
    }

    setStoresFilters(newFilters)
  }

  const togglePlatformFilter = (plat: keyof PlatformsFilters) => {
    const currentValue = platformsFilters[plat]
    const newFilters = { ...platformsFilters, [plat]: !currentValue }
    setPlatformsFilters(newFilters)
  }

  const setPlatformOnly = (plat: string) => {
    let newFilters = { win: false, linux: false, mac: false, browser: false }
    newFilters = { ...newFilters, [plat]: true }
    setPlatformsFilters(newFilters)
  }

  const setStoreOnly = (selectedStoreId: string) => {
    const newFilters: StoresFilters = {}
    customStores.forEach((s) => {
      newFilters[s.id] = s.id === selectedStoreId
    })

    const selectedStore = customStores.find((s) => s.id === selectedStoreId)
    const nameLower = (selectedStore?.name || selectedStoreId).toLowerCase()
    const idLower = selectedStoreId.toLowerCase()

    newFilters['legendary'] = nameLower.includes('epic') || idLower === 'epic'
    newFilters['gog'] = nameLower.includes('gog') || idLower === 'gog'
    newFilters['nile'] = nameLower.includes('amazon') || idLower === 'amazon'
    newFilters['zoom'] = nameLower.includes('zoom') || idLower === 'zoom'
    newFilters['steam'] = nameLower.includes('steam') || idLower === 'steam'
    newFilters['sideload'] =
      nameLower.includes('sideload') ||
      idLower === 'sideload' ||
      nameLower.includes('pirata') ||
      nameLower.includes('indie')

    setStoresFilters(newFilters)
  }

  const toggleWithOnly = (key: string, toggle: JSX.Element, onOnlyClicked: () => void) => {
    return (
      <div key={key} className="toggleWithOnly">
        {toggle}
        <button className="only" onClick={() => onOnlyClicked()}>
          {t('header.only', 'only')}
        </button>
      </div>
    )
  }

  const platformToggle = (plat: keyof PlatformsFilters) => {
    const toggle = (
      <ToggleSwitch
        key={plat}
        htmlId={plat}
        handleChange={() => togglePlatformFilter(plat)}
        value={platformsFilters[plat]}
        title={t(`platforms.${plat}`)}
      />
    )

    const onOnlyClick = () => {
      setPlatformOnly(plat)
    }

    return toggleWithOnly(`platform-${plat}`, toggle, onOnlyClick)
  }

  const storeToggle = (store: CustomStore) => {
    const isChecked = storesFilters[store.id] !== false
    const toggle = (
      <ToggleSwitch
        key={store.id}
        htmlId={`store-filter-${store.id}`}
        handleChange={() => toggleStoreFilter(store.id)}
        value={isChecked}
        title={store.name}
      />
    )
    const onOnlyClick = () => {
      setStoreOnly(store.id)
    }
    return toggleWithOnly(`store-${store.id}`, toggle, onOnlyClick)
  }

  const resetFilters = () => {
    const defaultStores: StoresFilters = {
      legendary: true,
      gog: true,
      nile: true,
      sideload: true,
      zoom: true
    }
    customStores.forEach((s) => {
      defaultStores[s.id] = true
    })
    setStoresFilters(defaultStores)
    setPlatformsFilters({
      win: true,
      linux: true,
      mac: true,
      browser: true
    })
    setShowHidden(true)
    setShowNonAvailable(true)
    setShowFavourites(false)
    setShowInstalledOnly(false)
    setShowSupportOfflineOnly(false)
    setShowThirdPartyManagedOnly(false)
    setShowUpdatesOnly(false)
    setSortByRecent(false)
    if (setSortByMostPlayed) setSortByMostPlayed(false)
    if (setSortByNewlyAdded) setSortByNewlyAdded(false)
    setShowHiddenDuplicates(false)
    if (setShowPlaytestsAndDemos) setShowPlaytestsAndDemos(false)
    localStorage.removeItem('heroic_show_hidden_duplicates')
    localStorage.removeItem('heroic_show_playtests_demos')
    window.dispatchEvent(new Event('heroicDuplicatesChanged'))
    window.dispatchEvent(new Event('heroicPlaytestsFilterChanged'))
  }

  return (
    <Dropdown
      buttonClass="selectStyle"
      title={t('header.filters', 'Filters')}
      className="libraryFilters"
      data-tour="library-filters"
      popUpOnHover
    >
      {customStores
        .filter((store) => store.isVisible !== false)
        .map((store) => storeToggle(store))}
      <hr />
      {platformToggle('win')}
      {platformToggle('linux')}
      {platformToggle('mac')}
      {platformToggle('browser')}
      <hr />
      <ToggleSwitch
        key="show-hidden"
        htmlId="show-hidden"
        handleChange={() => toggleShowHidden()}
        value={showHidden}
        title={t('header.show_hidden', 'Show Hidden')}
      />
      <ToggleSwitch
        key="show-hidden-duplicates"
        htmlId="show-hidden-duplicates"
        handleChange={toggleShowHiddenDuplicates}
        value={showHiddenDuplicates}
        title="👁️ Jogos duplicados ocultados"
      />
      <ToggleSwitch
        key="show-playtests-demos"
        htmlId="show-playtests-demos"
        handleChange={toggleShowPlaytestsAndDemos}
        value={showPlaytestsAndDemos}
        title="🧪 Exibir Playtests, Demos e Betas"
      />
      <ToggleSwitch
        key="show-non-available"
        htmlId="show-non-available"
        handleChange={() => toggleShowNonAvailable()}
        value={showNonAvailable}
        title={t('header.show_available_games', 'Show non-Available games')}
      />
      <ToggleSwitch
        key="only-favorites"
        htmlId="only-favorites"
        handleChange={() => toggleOnlyFavorites()}
        value={showFavourites}
        title={t('header.show_favourites_only', 'Show Favourites only')}
      />
      <ToggleSwitch
        key="only-installed"
        htmlId="only-installed"
        handleChange={() => toggleOnlyInstalled()}
        value={showInstalledOnly}
        title={t('header.show_installed_only', 'Show Installed only')}
      />
      <ToggleSwitch
        key="only-support-offline"
        htmlId="only-support-offline"
        handleChange={() => toggleOnlySupportOffline()}
        value={showSupportOfflineOnly}
        title={t(
          'header.show_support_offline_only',
          'Show offline-supported only'
        )}
      />
      <ToggleSwitch
        key="only-third-party-managed"
        htmlId="only-third-party-managed"
        handleChange={() => toggleThirdParty()}
        value={showThirdPartyManagedOnly}
        title={t(
          'header.show_third_party_managed_only',
          'Show third-party managed only'
        )}
      />
      <ToggleSwitch
        key="only-updates-available"
        htmlId="only-updates-available"
        handleChange={() => toggleUpdatesOnly()}
        value={showUpdatesOnly}
        title={t('header.show_updates_only', 'Show games with updates only')}
      />
      <ToggleSwitch
        key="sort-by-newly-added"
        htmlId="sort-by-newly-added"
        handleChange={() => {
          if (setSortByNewlyAdded) {
            setSortByNewlyAdded(!sortByNewlyAdded)
          }
        }}
        value={!!sortByNewlyAdded}
        title="✨ Classificar por Adicionados Recentemente"
      />
      <ToggleSwitch
        key="sort-by-recent"
        htmlId="sort-by-recent"
        handleChange={() => {
          if (!sortByRecent && sortByMostPlayed && setSortByMostPlayed) {
            setSortByMostPlayed(false)
          }
          setSortByRecent(!sortByRecent)
        }}
        value={sortByRecent}
        title={t('header.sort_by_recent', 'Sort by Last Played')}
      />
      <ToggleSwitch
        key="sort-by-most-played"
        htmlId="sort-by-most-played"
        handleChange={() => {
          if (setSortByMostPlayed) {
            if (!sortByMostPlayed && sortByRecent) {
              setSortByRecent(false)
            }
            setSortByMostPlayed(!sortByMostPlayed)
          }
        }}
        value={!!sortByMostPlayed}
        title="⏱️ Classificar por Mais Jogados"
      />
      <hr />
      <button
        type="reset"
        className="button is-primary"
        onClick={() => resetFilters()}
      >
        {t('header.reset', 'Reset')}
      </button>
    </Dropdown>
  )
}

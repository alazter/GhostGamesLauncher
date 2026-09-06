import { PlatformsFilters } from 'frontend/types'

export interface StoreFilterSettings {
  showInstalledOnly: boolean
  showFavourites: boolean
  showHidden: boolean
  showNonAvailable: boolean
  showSupportOfflineOnly: boolean
  showThirdPartyManagedOnly: boolean
  showUpdatesOnly: boolean
  platformsFilters: PlatformsFilters
  sortDescending: boolean
  sortInstalled: boolean
  sortByRecent: boolean
  sortByMostPlayed: boolean
  sortByNewlyAdded: boolean
  showAlphabetFilter: boolean
  alphabetFilterLetter: string | null
  showPlaytestsAndDemos: boolean
}

export const DEFAULT_STORE_FILTER_SETTINGS: StoreFilterSettings = {
  showInstalledOnly: false,
  showFavourites: false,
  showHidden: false,
  showNonAvailable: true,
  showSupportOfflineOnly: false,
  showThirdPartyManagedOnly: false,
  showUpdatesOnly: false,
  platformsFilters: { win: true, linux: true, mac: true, browser: true },
  sortDescending: false,
  sortInstalled: true,
  sortByRecent: false,
  sortByMostPlayed: false,
  sortByNewlyAdded: false,
  showAlphabetFilter: true,
  alphabetFilterLetter: null,
  showPlaytestsAndDemos: false
}

export function getStoreFilterStorageKey(storeId: string | null): string {
  const normalized = (storeId || '__all__').trim().toLowerCase()
  return `heroic_store_filters_${normalized}`
}

export function loadStoreFilterSettings(storeId: string | null): StoreFilterSettings {
  const key = getStoreFilterStorageKey(storeId)
  const saved = localStorage.getItem(key)
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      return {
        ...DEFAULT_STORE_FILTER_SETTINGS,
        ...parsed,
        platformsFilters: {
          ...DEFAULT_STORE_FILTER_SETTINGS.platformsFilters,
          ...(parsed.platformsFilters || {})
        }
      }
    } catch {}
  }

  // Fallback inicial para '__all__' (ou caso nunca configurado) usando as chaves globais históricas
  if (!storeId || storeId === '__all__') {
    try {
      const platformsSaved = localStorage.getItem('platforms') || localStorage.getItem('platformsFilters')
      const platforms: PlatformsFilters = platformsSaved
        ? (JSON.parse(platformsSaved) as PlatformsFilters)
        : DEFAULT_STORE_FILTER_SETTINGS.platformsFilters

      return {
        showInstalledOnly: JSON.parse(localStorage.getItem('show_installed_only') || 'false') as boolean,
        showFavourites: JSON.parse(localStorage.getItem('show_favorites') || 'false') as boolean,
        showHidden: JSON.parse(localStorage.getItem('show_hidden') || 'false') as boolean,
        showNonAvailable: JSON.parse(localStorage.getItem('show_non_available') || 'true') as boolean,
        showSupportOfflineOnly: JSON.parse(localStorage.getItem('show_support_offline_only') || 'false') as boolean,
        showThirdPartyManagedOnly: JSON.parse(localStorage.getItem('show_third_party_managed_only') || 'false') as boolean,
        showUpdatesOnly: JSON.parse(localStorage.getItem('show_updates_only') || 'false') as boolean,
        platformsFilters: platforms,
        sortDescending: JSON.parse(localStorage.getItem('sortDescending') || 'false') as boolean,
        sortInstalled: JSON.parse(localStorage.getItem('sortInstalled') || 'true') as boolean,
        sortByRecent: JSON.parse(localStorage.getItem('sortByRecent') || 'false') as boolean,
        sortByMostPlayed: JSON.parse(localStorage.getItem('sortByMostPlayed') || 'false') as boolean,
        sortByNewlyAdded: JSON.parse(localStorage.getItem('sortByNewlyAdded') || 'false') as boolean,
        showAlphabetFilter: JSON.parse(localStorage.getItem('showAlphabetFilter') || 'true') as boolean,
        alphabetFilterLetter: null,
        showPlaytestsAndDemos: localStorage.getItem('heroic_show_playtests_demos') === 'true'
      }
    } catch {}
  }

  return { ...DEFAULT_STORE_FILTER_SETTINGS }
}

export function saveStoreFilterSettings(
  storeId: string | null,
  settings: Partial<StoreFilterSettings>
): void {
  const current = loadStoreFilterSettings(storeId)
  const updated: StoreFilterSettings = {
    ...current,
    ...settings,
    platformsFilters: settings.platformsFilters
      ? { ...current.platformsFilters, ...settings.platformsFilters }
      : current.platformsFilters
  }

  const key = getStoreFilterStorageKey(storeId)
  localStorage.setItem(key, JSON.stringify(updated))

  // Se for '__all__', espelha também nas chaves legadas globais para compatibilidade total
  if (!storeId || storeId === '__all__') {
    if (settings.showInstalledOnly !== undefined) {
      localStorage.setItem('show_installed_only', JSON.stringify(settings.showInstalledOnly))
    }
    if (settings.showFavourites !== undefined) {
      localStorage.setItem('show_favorites', JSON.stringify(settings.showFavourites))
    }
    if (settings.showHidden !== undefined) {
      localStorage.setItem('show_hidden', JSON.stringify(settings.showHidden))
    }
    if (settings.showNonAvailable !== undefined) {
      localStorage.setItem('show_non_available', JSON.stringify(settings.showNonAvailable))
    }
    if (settings.showSupportOfflineOnly !== undefined) {
      localStorage.setItem('show_support_offline_only', JSON.stringify(settings.showSupportOfflineOnly))
    }
    if (settings.showThirdPartyManagedOnly !== undefined) {
      localStorage.setItem('show_third_party_managed_only', JSON.stringify(settings.showThirdPartyManagedOnly))
    }
    if (settings.showUpdatesOnly !== undefined) {
      localStorage.setItem('show_updates_only', JSON.stringify(settings.showUpdatesOnly))
    }
    if (settings.platformsFilters !== undefined) {
      localStorage.setItem('platforms', JSON.stringify(updated.platformsFilters))
      localStorage.setItem('platformsFilters', JSON.stringify(updated.platformsFilters))
    }
    if (settings.sortDescending !== undefined) {
      localStorage.setItem('sortDescending', JSON.stringify(settings.sortDescending))
    }
    if (settings.sortInstalled !== undefined) {
      localStorage.setItem('sortInstalled', JSON.stringify(settings.sortInstalled))
    }
    if (settings.sortByRecent !== undefined) {
      localStorage.setItem('sortByRecent', JSON.stringify(settings.sortByRecent))
    }
    if (settings.sortByMostPlayed !== undefined) {
      localStorage.setItem('sortByMostPlayed', JSON.stringify(settings.sortByMostPlayed))
    }
    if (settings.sortByNewlyAdded !== undefined) {
      localStorage.setItem('sortByNewlyAdded', JSON.stringify(settings.sortByNewlyAdded))
    }
    if (settings.showAlphabetFilter !== undefined) {
      localStorage.setItem('showAlphabetFilter', JSON.stringify(settings.showAlphabetFilter))
    }
    if (settings.showPlaytestsAndDemos !== undefined) {
      localStorage.setItem('heroic_show_playtests_demos', String(settings.showPlaytestsAndDemos))
    }
  }
}

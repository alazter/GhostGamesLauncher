export const LIBRARY_GO_TO_END_EVENT = 'heroicLibraryGoToEnd'
export const LIBRARY_GO_TO_START_EVENT = 'heroicLibraryGoToStart'

export interface LibraryNavigation {
  total: number
  columns: number
  pageRows: number
  focus: (index: number) => void
}

const libraries = new WeakMap<Element, LibraryNavigation>()

export function registerLibraryNavigation(
  list: Element,
  navigation: LibraryNavigation
) {
  libraries.set(list, navigation)
  return () => {
    libraries.delete(list)
  }
}

/** Used before the legacy geometry navigation, including synthesized gamepad keys. */
export function navigateVirtualLibrary(event: KeyboardEvent): boolean {
  const active = document.activeElement
  if (!active?.matches('.gameCard, .gameListItem')) return false
  const cell = active.closest<HTMLElement>('[data-library-index]')
  const list = cell?.closest('[data-library-window]')
  const navigation = list && libraries.get(list)
  if (!cell || !navigation) return false
  const index = Number(cell.dataset.libraryIndex)
  const { total, columns, pageRows, focus } = navigation
  let target = index
  switch (event.key) {
    case 'ArrowRight':
      target = Math.min(index + 1, total - 1)
      break
    case 'ArrowLeft':
      target = index % columns === 0 ? index : index - 1
      break
    case 'ArrowDown':
      if (Math.floor(index / columns) === Math.floor((total - 1) / columns))
        return false
      target = Math.min(index + columns, total - 1)
      break
    case 'ArrowUp':
      if (index < columns) return false
      target = index - columns
      break
    case 'Home':
      target = 0
      break
    case 'End':
      target = total - 1
      break
    case 'PageDown':
      target = Math.min(index + columns * pageRows, total - 1)
      break
    case 'PageUp':
      target = Math.max(index - columns * pageRows, 0)
      break
    default:
      return false
  }
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
  if (target !== index) focus(target)
  return true
}

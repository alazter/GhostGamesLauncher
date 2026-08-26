import { GameInfo } from 'common/types'

export const STORE_NAME_MAP: Record<string, string> = {}

export function syncAutoStoreCategories(
  games: GameInfo[],
  currentCustomCategories: Record<string, string[]>,
  updateCustomCategories: (updatedCategories: Record<string, string[]>) => void,
  defaultRunner?: string
) {
  // Disabled: Games are directly assigned to Custom Stores via syncAutoStoreAssignments
}


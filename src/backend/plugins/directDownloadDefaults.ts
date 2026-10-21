import type { DownloadAction } from 'common/directDownloadLearning'

export interface DownloadRecipe {
  source: string
  origin: string
  route: string
  steps: DownloadAction[]
}

// Data-only controls validated by successful Anker downloads. No account,
// cookies, signed URL, game ID or personal profile is distributed.
export const defaultDownloadRecipes: DownloadRecipe[] = [
  {
    source: 'com.ghost.ankergames-source',
    origin: 'https://ankergames.net',
    route: '/game/*',
    steps: [
      { tag: 'BUTTON', label: 'download' },
      { tag: 'A', label: 'download', row: 'direct' }
    ]
  },
  {
    source: 'com.ghost.ankergames-source',
    origin: 'https://ankergames.net',
    route: '/download/*/*',
    steps: [{ tag: 'A', label: 'download now' }]
  }
]

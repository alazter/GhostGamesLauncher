export const accountProviders = ['xbox', 'ea', 'ubisoft', 'battlenet'] as const
export type AccountProvider = (typeof accountProviders)[number]

export const accountProviderNames: Record<AccountProvider, string> = {
  xbox: 'Xbox',
  ea: 'EA',
  ubisoft: 'Ubisoft Connect',
  battlenet: 'Battle.net'
}

export interface ConnectedAccountStatus {
  provider: AccountProvider
  connected: boolean
  username?: string
  lastSync?: number
  gameCount: number
  error?: string
}

export type AccountResult =
  | { success: true; status: ConnectedAccountStatus }
  | { success: false; error: string; cancelled?: boolean }

export interface AccountGame {
  id: string
  title: string
  cover?: string
  description?: string
  storeUrl: string
}

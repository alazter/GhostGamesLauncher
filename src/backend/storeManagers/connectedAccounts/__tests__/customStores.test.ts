import {
  CONNECTED_ACCOUNT_STORES,
  ensureConnectedAccountCustomStore
} from 'frontend/helpers/connectedAccountStores'
import { isGameAssignedToStore } from 'frontend/helpers/customStoreFiltering'
import { syncAutoStoreAssignments } from 'frontend/helpers/autoStoreAssignments'
import { GameInfo } from 'common/types'

describe('Connected Account Custom Stores', () => {
  let localStorageMock: Record<string, string> = {}

  beforeAll(() => {
    ;(global as any).window = global
    ;(global as any).Event = class Event {
      type: string
      constructor(type: string) {
        this.type = type
      }
    }
    ;(global as any).StorageEvent = class StorageEvent {
      type: string
      key?: string
      constructor(type: string, init?: any) {
        this.type = type
        this.key = init?.key
      }
    }
  })

  beforeEach(() => {
    localStorageMock = {}
    ;(global as any).localStorage = {
      getItem: jest.fn((key: string) => localStorageMock[key] ?? null),
      setItem: jest.fn((key: string, value: string) => {
        localStorageMock[key] = value
      }),
      removeItem: jest.fn((key: string) => {
        delete localStorageMock[key]
      }),
      clear: jest.fn(() => {
        localStorageMock = {}
      }),
      key: jest.fn(),
      length: 0
    }
    ;(global as any).window.dispatchEvent = jest.fn()
  })

  it('defines canonical store configs with exact names and base64 PNG icons for Xbox, EA Games, Battle.net and Ubisoft', () => {
    expect(CONNECTED_ACCOUNT_STORES.xbox.name).toBe('Xbox')
    expect(CONNECTED_ACCOUNT_STORES.xbox.id).toBe('store-1782835258378')
    expect(CONNECTED_ACCOUNT_STORES.xbox.icon).toMatch(/^data:image\/png;base64,/)
    expect(CONNECTED_ACCOUNT_STORES.xbox.aliases).toContain('xbox')

    expect(CONNECTED_ACCOUNT_STORES.ea.name).toBe('EA Games')
    expect(CONNECTED_ACCOUNT_STORES.ea.id).toBe('store-1782833766006')
    expect(CONNECTED_ACCOUNT_STORES.ea.icon).toMatch(/^data:image\/png;base64,/)
    expect(CONNECTED_ACCOUNT_STORES.ea.aliases).toEqual(
      expect.arrayContaining(['ea', 'ea games', 'origin'])
    )

    expect(CONNECTED_ACCOUNT_STORES.battlenet.name).toBe('Battle.net')
    expect(CONNECTED_ACCOUNT_STORES.battlenet.id).toBe('store-1790309300464')
    expect(CONNECTED_ACCOUNT_STORES.battlenet.icon).toMatch(/^data:image\/png;base64,/)
    expect(CONNECTED_ACCOUNT_STORES.battlenet.aliases).toEqual(
      expect.arrayContaining(['battlenet', 'battle.net', 'blizzard'])
    )

    expect(CONNECTED_ACCOUNT_STORES.ubisoft.name).toBe('Ubisoft')
    expect(CONNECTED_ACCOUNT_STORES.ubisoft.id).toBe('store-1790309448685')
    expect(CONNECTED_ACCOUNT_STORES.ubisoft.icon).toMatch(/^data:image\/png;base64,/)
    expect(CONNECTED_ACCOUNT_STORES.ubisoft.aliases).toEqual(
      expect.arrayContaining(['ubisoft', 'ubisoft connect', 'uplay'])
    )
  })

  it('automatically creates custom store on demand and dispatches customStoresChanged', () => {
    const storeId = ensureConnectedAccountCustomStore('battlenet')
    expect(storeId).toBe('store-1790309300464')

    const savedStores = JSON.parse(localStorageMock['heroic_custom_stores'])
    expect(savedStores).toHaveLength(1)
    expect(savedStores[0].id).toBe('store-1790309300464')
    expect(savedStores[0].name).toBe('Battle.net')
    expect(savedStores[0].icon).toBe(CONNECTED_ACCOUNT_STORES.battlenet.icon)
    expect(savedStores[0].isVisible).toBe(true)

    expect((global as any).window.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'customStoresChanged' })
    )
  })

  it('does not duplicate existing stores when matched by id or alias', () => {
    localStorageMock['heroic_custom_stores'] = JSON.stringify([
      {
        id: 'existing-xbox-id',
        name: 'Xbox',
        icon: 'data:image/png;base64,sample',
        isVisible: true
      }
    ])

    const storeId = ensureConnectedAccountCustomStore('xbox')
    expect(storeId).toBe('existing-xbox-id')

    const savedStores = JSON.parse(localStorageMock['heroic_custom_stores'])
    expect(savedStores).toHaveLength(1)
  })

  it('filters connected account games properly in isGameAssignedToStore', () => {
    const bnetGame: GameInfo = {
      app_name: 'account-battlenet-5730135',
      title: 'World of Warcraft',
      runner: 'sideload',
      accountProvider: 'battlenet'
    } as any

    const bnetStore = {
      id: 'store-1790309300464',
      name: 'Battle.net'
    }

    // 1. Explicit assignment
    const assignments: Record<string, string> = {
      'account-battlenet-5730135': 'store-1790309300464'
    }
    expect(isGameAssignedToStore(bnetGame, bnetStore, assignments)).toBe(true)

    // 2. Unassigned fallback matching via accountProvider
    expect(isGameAssignedToStore(bnetGame, bnetStore, {})).toBe(true)

    // 3. Different store
    const steamStore = { id: 'store-steam', name: 'Steam' }
    expect(isGameAssignedToStore(bnetGame, steamStore, {})).toBe(false)
  })

  it('syncAutoStoreAssignments creates missing stores and assigns connected account games to them', () => {
    const games: GameInfo[] = [
      {
        app_name: 'account-ea-10042',
        title: 'Battlefield 2042',
        runner: 'sideload',
        accountProvider: 'ea'
      } as any,
      {
        app_name: 'account-ubisoft-99',
        title: 'Far Cry 6',
        runner: 'sideload',
        accountProvider: 'ubisoft'
      } as any
    ]

    syncAutoStoreAssignments([], [], [], [], [], games)

    const savedStores = JSON.parse(localStorageMock['heroic_custom_stores'])
    expect(savedStores.map((s: any) => s.name)).toContain('EA Games')
    expect(savedStores.map((s: any) => s.name)).toContain('Ubisoft')

    const savedAssignments = JSON.parse(localStorageMock['heroic_game_assignments'])
    expect(savedAssignments['account-ea-10042']).toBe(CONNECTED_ACCOUNT_STORES.ea.id)
    expect(savedAssignments['account-ubisoft-99']).toBe(CONNECTED_ACCOUNT_STORES.ubisoft.id)

    expect((global as any).window.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'gameAssignmentsChanged' })
    )
  })
})

jest.mock('backend/game_overrides/electronStores', () => ({
  gameOverridesStore: { get: jest.fn(), set: jest.fn() }
}))

import { resolveBestDownloadSource } from '../pluginManager'
import type { GhostDownloadSource } from 'common/types/plugins'

describe('resolveBestDownloadSource - Seleção Automática Inteligente de Fontes de Download e Updates', () => {
  const mockOptions: GhostDownloadSource[] = [
    {
      id: 'anker-official-torrent',
      name: 'Torrent (TorBox)',
      type: 'torbox',
      url: 'https://torbox.app/torrent/123'
    },
    {
      id: 'anker-official-direct',
      name: 'Download Direto',
      type: 'direct',
      url: 'https://ankergames.net/download/game.zip'
    }
  ]

  it('retorna a fonte exata quando requestedSourceId corresponde a uma das opções', () => {
    const selected = resolveBestDownloadSource(mockOptions, 'anker-official-direct', false)
    expect(selected).toBeDefined()
    expect(selected?.id).toBe('anker-official-direct')
  })

  it('seleciona automaticamente a fonte direta quando TorBox não está configurado e requestedSourceId é providerId', () => {
    const selected = resolveBestDownloadSource(mockOptions, 'com.ghost.ankergames-source', false)
    expect(selected).toBeDefined()
    expect(selected?.id).toBe('anker-official-direct')
    expect(selected?.type).toBe('direct')
  })

  it('seleciona automaticamente a fonte TorBox quando TorBox está configurado e requestedSourceId é providerId', () => {
    const selected = resolveBestDownloadSource(mockOptions, 'com.ghost.ankergames-source', true)
    expect(selected).toBeDefined()
    expect(selected?.id).toBe('anker-official-torrent')
    expect(selected?.type).toBe('torbox')
  })

  it('retorna undefined de forma segura quando a lista de opções está vazia', () => {
    const selected = resolveBestDownloadSource([], 'com.ghost.ankergames-source', false)
    expect(selected).toBeUndefined()
  })

  it('faz fallback para options[0] se nenhuma fonte satisfazer o filtro direto', () => {
    const torrentOnlyOptions: GhostDownloadSource[] = [
      {
        id: 'torrent-only',
        name: 'Apenas Torrent',
        type: 'torbox',
        url: 'https://torbox.app/torrent/456'
      }
    ]
    const selected = resolveBestDownloadSource(torrentOnlyOptions, 'provider-xyz', false)
    expect(selected).toBeDefined()
    expect(selected?.id).toBe('torrent-only')
  })

  it('respeita preferredTransport quando o jogo anterior usava direct download mesmo com TorBox configurado', () => {
    const selected = resolveBestDownloadSource(mockOptions, 'com.ghost.ankergames-source', true, 'anker-direct')
    expect(selected).toBeDefined()
    expect(selected?.id).toBe('anker-official-direct')
    expect(selected?.type).toBe('direct')
  })

  it('respeita preferredTransport quando o jogo anterior usava torbox', () => {
    const selected = resolveBestDownloadSource(mockOptions, 'com.ghost.ankergames-source', true, 'torbox')
    expect(selected).toBeDefined()
    expect(selected?.id).toBe('anker-official-torrent')
    expect(selected?.type).toBe('torbox')
  })
})


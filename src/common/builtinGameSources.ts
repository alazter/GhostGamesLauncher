import type { WebsiteSourceConfig } from './types/plugins'

export const builtinGameSources: Array<{
  id: string
  name: string
  domain: string
  config: WebsiteSourceConfig
}> = [
  {
    id: 'com.ghost.ankergames-source',
    name: 'AnkerGames',
    domain: 'ankergames.net',
    config: {
      catalogPath: '/games-list',
      gamePathPrefix: '/game/',
      platform: 'windows'
    }
  },
  {
    id: 'com.ghost.online-fix-source',
    name: 'Online-Fix',
    domain: 'online-fix.me',
    config: { catalogPath: '/', platform: 'windows' }
  },
  {
    id: 'com.ghost.steamrip-source',
    name: 'SteamRIP',
    domain: 'steamrip.com',
    config: { catalogPath: '/', platform: 'windows' }
  },
  {
    id: 'com.ghost.nxbrew-source',
    name: 'NXBrew',
    domain: 'nxbrew.net',
    config: { catalogPath: '/', platform: 'switch' }
  },
  {
    id: 'com.ghost.nswgf-source',
    name: 'NSWGF',
    domain: 'nswgf.com',
    config: { catalogPath: '/', platform: 'switch' }
  },
  {
    id: 'com.ghost.romslab-source',
    name: 'RomsLab',
    domain: 'romslab.com',
    config: { catalogPath: '/', platform: 'switch' }
  }
]

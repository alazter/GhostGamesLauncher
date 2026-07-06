import { app } from 'electron'

function getHeroicVersion(): string {
  return app.getVersion()
}

export { getHeroicVersion }


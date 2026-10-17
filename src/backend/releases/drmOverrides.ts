import { app } from 'electron'
import { createHash } from 'crypto'
import { mkdir, readFile, writeFile, rename, unlink } from 'fs/promises'
import { join } from 'path'
import {
  manualDrmStatuses,
  type ManualDrmStatus,
  type ReleaseDrmOverride
} from 'common/releaseDrm'

type Game = { id: string; title: string }
export function validateDrmIdentity(game: Game) {
  if (
    !game ||
    typeof game.id !== 'string' ||
    !/^[a-z0-9._~-]{1,200}$/i.test(game.id) ||
    typeof game.title !== 'string' ||
    !game.title.trim() ||
    game.title.length > 300 ||
    [...game.title].some((character) => character.charCodeAt(0) < 32)
  )
    throw new Error('Jogo inválido para edição de DRM.')
}
const directory = () =>
  join(app.getPath('userData'), 'releases', 'drm-overrides')
const target = (game: Game) =>
  join(
    directory(),
    createHash('sha256')
      .update(game.id + ':' + game.title)
      .digest('hex') + '.json'
  )
let writer: Promise<unknown> = Promise.resolve()

export async function readDrmOverride(
  game: Game
): Promise<ReleaseDrmOverride | undefined> {
  validateDrmIdentity(game)
  await writer.catch(() => undefined)
  try {
    const text = await readFile(target(game), 'utf8')
    if (text.length > 4096) return undefined
    const data: unknown = JSON.parse(text)
    if (!data || typeof data !== 'object') return undefined
    const value = data as Record<string, unknown>
    if (
      value.id !== game.id ||
      value.title !== game.title ||
      typeof value.status !== 'string' ||
      !manualDrmStatuses.includes(value.status as ManualDrmStatus) ||
      typeof value.updatedAt !== 'string' ||
      !Number.isFinite(Date.parse(value.updatedAt))
    )
      return undefined
    return {
      status: value.status as ManualDrmStatus,
      updatedAt: value.updatedAt
    }
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException).code === 'ENOENT' ||
      error instanceof SyntaxError
    )
      return undefined
    throw new Error('Não foi possível ler o status manual de DRM salvo.')
  }
}

export async function writeDrmOverride(
  game: Game,
  status: ManualDrmStatus | null
) {
  validateDrmIdentity(game)
  if (status !== null && !manualDrmStatuses.includes(status))
    throw new Error('Status manual de DRM inválido.')
  const result = writer
    .catch(() => undefined)
    .then(async () => {
      if (status === null) {
        await unlink(target(game)).catch((error: NodeJS.ErrnoException) => {
          if (error.code !== 'ENOENT') throw error
        })
        return
      }
      await mkdir(directory(), { recursive: true })
      const value = {
        id: game.id,
        title: game.title,
        status,
        updatedAt: new Date().toISOString()
      }
      await writeFile(target(game) + '.tmp', JSON.stringify(value), 'utf8')
      await rename(target(game) + '.tmp', target(game))
    })
  writer = result
  await result
}

import { stat } from 'fs/promises'
import shlex from 'shlex'

export function romLaunchArguments(template: string, rom: string): string[] {
  const tokens = shlex.split(template || '{rom}')
  if (!tokens.some((token) => token.includes('{rom}')))
    throw new Error('Os argumentos do emulador precisam incluir {rom}.')
  return tokens.map((token) => token.replaceAll('{rom}', rom))
}

export async function prepareRomLaunch(
  rom: string,
  emulator: string,
  template = '{rom}'
) {
  if (!emulator || !(await stat(emulator).catch(() => undefined))?.isFile())
    throw new Error(
      'Selecione um executável de emulador em Configurações → Geral → Emulador de Nintendo Switch.'
    )
  if (
    !/\.(nsp|xci|nsz|xcz)$/i.test(rom) ||
    !(await stat(rom).catch(() => undefined))?.isFile()
  )
    throw new Error(
      'A ROM não foi encontrada. Confira os arquivos da instalação.'
    )
  return { executable: emulator, args: romLaunchArguments(template, rom) }
}

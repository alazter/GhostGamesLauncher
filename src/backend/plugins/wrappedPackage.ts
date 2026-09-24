import { relative } from 'path'

/** Select one game package; never guess between multiple main releases. */
export function selectWrappedPackage(
  files: string[],
  root: string,
  onlineFix: boolean
): string {
  const packages = files.filter(
    (file) =>
      /\.(zip|rar|7z|tar)$/i.test(file) &&
      !/\.part(?!0*1\.)\d+\.rar$/i.test(file)
  )
  const main = onlineFix
    ? packages.filter(
        (file) =>
          !relative(root, file)
            .split(/[/\\]/)
            .some((part) =>
              /(?:^|[\s_.-])fix[\s_.-]+repair(?:[\s_.-]|$)/i.test(part)
            )
      )
    : packages
  if (main.length !== 1)
    throw new Error(
      main.length
        ? 'O pacote contém mais de um arquivo principal de jogo. Não foi possível escolher automaticamente.'
        : 'Nenhum pacote principal de jogo reconhecido foi encontrado no torrent.'
    )
  return main[0]
}

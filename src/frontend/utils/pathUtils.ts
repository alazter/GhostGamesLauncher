/**
 * Utilitários para resolução e manipulação de diretórios e caminhos de jogos no Ghost Launcher.
 */

/**
 * Extrai o diretório de uma pasta ou caminho de executável.
 * Se o caminho apontar para um arquivo (ex: .exe, .bin, .bat), retorna a pasta pai.
 * Se já for uma pasta, retorna o caminho limpo da pasta.
 *
 * @param targetPath Caminho bruto informado (arquivo executável ou pasta)
 * @param isKnownFile Se true, força o tratamento como arquivo, extraindo o diretório pai caso haja separador
 */
export const getFolderFromPath = (targetPath?: string, isKnownFile = false): string => {
  if (!targetPath) return ''
  let trimmed = targetPath.trim()
  if (!trimmed) return ''

  // Remover aspas caso existam (ex: "N:\Alazter Games\game.exe")
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim()
  }

  // Se for raiz de drive (ex: C:\, C:/, N:\), mantém intacto
  if (/^[a-zA-Z]:[\\/]?$/.test(trimmed) || trimmed === '/' || trimmed === '\\') {
    return trimmed
  }

  // Remove barras finais se não for raiz de drive
  while (
    trimmed.length > 3 &&
    (trimmed.endsWith('\\') || trimmed.endsWith('/'))
  ) {
    trimmed = trimmed.slice(0, -1)
  }

  const lastSlashIndex = Math.max(
    trimmed.lastIndexOf('\\'),
    trimmed.lastIndexOf('/')
  )

  if (lastSlashIndex > -1) {
    const fileName = trimmed.slice(lastSlashIndex + 1)
    if (
      isKnownFile ||
      (fileName.includes('.') &&
        /\.(exe|bat|cmd|sh|com|bin|appimage|x86_64|x86|lnk|jar)$/i.test(fileName))
    ) {
      return trimmed.slice(0, lastSlashIndex)
    }
  }

  return trimmed
}

/**
 * Abre o diretório do jogo no Explorador de Arquivos do sistema operacional (Windows Explorer / Finder / File Manager).
 *
 * @param targetPath Caminho do executável ou pasta do jogo
 * @param isKnownFile Se true, indica que o alvo é um arquivo executável
 */
export const openGameFolder = (targetPath?: string, isKnownFile = false): void => {
  if (!targetPath) return
  const folder = getFolderFromPath(targetPath, isKnownFile)
  if (folder && window.api?.openFolder) {
    window.api.openFolder(folder)
  } else if (targetPath && window.api?.showItemInFolder) {
    window.api.showItemInFolder(targetPath)
  }
}

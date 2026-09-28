/** Human-readable messages for filesystem/network failures in external installations. */
export function externalErrorMessage(error: unknown): string {
  const details =
    error && typeof error === 'object'
      ? (error as { code?: unknown; message?: unknown })
      : undefined
  const message =
    typeof error === 'string'
      ? error
      : typeof details?.message === 'string'
        ? details.message
        : ''
  const code =
    typeof details?.code === 'string'
      ? details.code
      : message.match(
          /\b(?:ENOENT|EACCES|EPERM|ENOSPC|EBUSY|EEXIST|ENOTDIR|ECONNRESET|ETIMEDOUT)\b/
        )?.[0]
  const messages: Record<string, string> = {
    ENOENT:
      'Um arquivo ou uma pasta necessária não foi encontrado. Verifique os caminhos da instalação e dos saves.',
    EACCES:
      'O Windows negou acesso ao arquivo ou à pasta. Verifique as permissões.',
    EPERM:
      'O Windows não permitiu alterar o arquivo ou a pasta. Feche o jogo e verifique as permissões.',
    ENOSPC: 'Não há espaço suficiente no disco para concluir a operação.',
    EBUSY:
      'Um arquivo está em uso. Feche o jogo ou o programa que está usando a pasta e tente novamente.',
    EEXIST:
      'A pasta ou o arquivo de destino já existe. Verifique o destino da instalação.',
    ENOTDIR: 'O caminho configurado não corresponde a uma pasta válida.',
    ECONNRESET: 'A conexão com o servidor foi interrompida. Tente novamente.',
    ETIMEDOUT: 'O servidor demorou demais para responder. Tente novamente.'
  }
  // Keep contextual recovery instructions that are already written in Portuguese.
  if (
    /^(?:Falha na conexão|Não foi possível|O servidor|A conexão)/.test(
      message
    ) &&
    !/no such file|permission denied|fetch failed/i.test(message)
  )
    return message
  if (code && messages[code]) return messages[code]
  if (/fetch failed|failed to fetch|network error/i.test(message))
    return 'Não foi possível conectar ao servidor. Verifique a conexão e tente novamente.'
  return message || 'Não foi possível concluir a operação. Tente novamente.'
}

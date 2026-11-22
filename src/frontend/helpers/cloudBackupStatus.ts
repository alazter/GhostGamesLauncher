export type CloudBackupVisualState =
  | 'inactive'
  | 'error'
  | 'updated'
  | 'warning'
  | 'overdue'

export const MS_PER_DAY = 24 * 60 * 60 * 1000

export interface CloudBackupVisualStatus {
  state: CloudBackupVisualState
  daysSinceBackup: number
}

/**
 * Calcula o status visual da nuvem de backup com base nos dias desde o último backup bem-sucedido:
 * - 0 a 3 dias: 'updated' (nuvem verde)
 * - 4 a 6 dias: 'warning' (nuvem amarela)
 * - 7+ dias: 'overdue' (nuvem vermelha)
 * - Sem provedor ou nunca sincronizado sem erro: 'inactive' (nuvem cinza)
 * - Nunca sincronizado com erro: 'error' (nuvem vermelha)
 */
export function computeCloudBackupVisualStatus(params: {
  provider: string
  lastSuccess: number
  lastError?: string
  now?: number
}): CloudBackupVisualStatus {
  const { provider, lastSuccess, lastError = '', now = Date.now() } = params

  if (!provider || provider === 'none') {
    return { state: 'inactive', daysSinceBackup: 0 }
  }

  if (!lastSuccess || lastSuccess <= 0) {
    return {
      state: lastError ? 'error' : 'inactive',
      daysSinceBackup: 0
    }
  }

  const elapsedMs = Math.max(0, now - lastSuccess)
  const daysSinceBackup = Math.floor(elapsedMs / MS_PER_DAY)

  if (daysSinceBackup <= 3) {
    return { state: 'updated', daysSinceBackup }
  }

  if (daysSinceBackup <= 6) {
    return { state: 'warning', daysSinceBackup }
  }

  return { state: 'overdue', daysSinceBackup }
}

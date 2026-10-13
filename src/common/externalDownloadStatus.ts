import type { ExternalDownloadJob } from './types/plugins'

export function torboxTransferMessage(
  job: ExternalDownloadJob
): string | undefined {
  if (job.status !== 'downloading' || job.transport !== 'torbox')
    return undefined
  if (job.transferPhase === 'torrent') {
    return `Obtendo o torrent de ${job.game.providerName}…`
  }
  if (job.transferPhase !== 'remote') return undefined
  if (job.remoteStatus === 'Enviando o torrent ao TorBox') {
    return 'Enviando o torrent ao TorBox…'
  }
  if (
    job.remoteStatus?.startsWith('Consultando') ||
    job.remoteStatus?.startsWith('Verificando')
  ) {
    return 'Verificando o torrent na conta TorBox…'
  }
  return 'Aguardando o TorBox concluir o download para iniciar a transferência para o PC.'
}

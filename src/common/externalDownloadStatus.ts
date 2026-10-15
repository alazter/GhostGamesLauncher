import type { ExternalDownloadJob } from './types/plugins'

export function directDownloadWaitMessage(job: ExternalDownloadJob, now = Date.now()) {
  const state = job.directWait
  if (job.status !== 'downloading' || !state) return undefined
  const seconds = Math.max(0, Math.ceil((state.deadline - now) / 1000))
  const time = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
  const manual = state.phase === 'manual'
  return {
    title: state.returningToGame ? 'Reabrindo a página deste jogo' : manual ? `Confirme na janela de ${state.hoster}` : `Preparando download · ${state.hoster}`,
    detail: state.returningToGame
      ? 'O link ficou indisponível. Aguarde: o Ghost está voltando à página do jogo para confirmação.'
      : state.confirmOnGamePage
      ? 'Na página do jogo, clique em Download e conclua a verificação, se solicitada.'
      : manual
      ? `A janela está aberta. Confirme o download ou a verificação.${state.next ? ` Se não iniciar, tentaremos ${state.next}.` : ''}`
      : seconds ? 'Aguarde. Se o download não iniciar, o Ghost abrirá a janela para confirmação.' : 'Abrindo a janela para confirmação…',
    timerLabel: state.returningToGame ? 'Tempo para reabrir a página do jogo' : manual ? 'Tempo para confirmação manual' : 'Tempo até a confirmação manual',
    time
  }
}

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

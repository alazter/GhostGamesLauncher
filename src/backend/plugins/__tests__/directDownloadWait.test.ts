import { directDownloadWaitMessage } from 'common/externalDownloadStatus'
import type { ExternalDownloadJob } from 'common/types/plugins'

const job = { status: 'downloading', transport: 'anker-direct', directWait: {
  phase: 'automatic', deadline: 45000, hoster: 'FileKeeper', next: 'Gofile', attempt: 1, attempts: 2
} } as ExternalDownloadJob

it('counts to the backend deadline without restarting when the card refreshes', () => {
  expect(directDownloadWaitMessage(job, 10000)?.time).toBe('00:35')
  expect(directDownloadWaitMessage({ ...job }, 11000)?.time).toBe('00:34')
  expect(directDownloadWaitMessage(job, 50000)).toMatchObject({ time: '00:00', detail: 'Abrindo a janela para confirmação…' })
})

it('explains manual confirmation and the next observed hoster', () => {
  expect(directDownloadWaitMessage({ ...job, directWait: { ...job.directWait!, phase: 'manual', deadline: 165000 } }, 45000))
    .toMatchObject({ title: 'Confirme na janela de FileKeeper', time: '02:00', timerLabel: 'Tempo para confirmação manual' })
})

it('removes the countdown after capture, pause, cancellation, error or completion', () => {
  expect(directDownloadWaitMessage({ ...job, directWait: undefined })).toBeUndefined()
  for (const status of ['paused', 'cancelled', 'error', 'completed', 'extracting'] as const)
    expect(directDownloadWaitMessage({ ...job, status })).toBeUndefined()
})

it('describes returning to the game instead of telling the user to confirm an error page', () => {
  expect(directDownloadWaitMessage({ ...job, directWait: { ...job.directWait!, phase: 'manual', returningToGame: true } }, 10000))
    .toMatchObject({ title: 'Reabrindo a página deste jogo', timerLabel: 'Tempo para reabrir a página do jogo' })
  expect(directDownloadWaitMessage({ ...job, directWait: { ...job.directWait!, phase: 'manual', confirmOnGamePage: true } }, 10000)?.detail)
    .toContain('clique em Download')
})

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { torboxTransferMessage } from 'common/externalDownloadStatus'
import type { ExternalDownloadJob } from 'common/types/plugins'
import ExternalActiveCard from 'frontend/screens/DownloadManager/components/ExternalActiveCard'

jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }))
jest.mock('frontend/screens/ExternalGames/shared', () => ({
  bytes: () => '0 MB'
}))
jest.mock(
  'frontend/screens/DownloadManager/components/ExternalStoreLogo',
  () => () => null
)
jest.mock(
  'frontend/screens/DownloadManager/hooks/useExternalGameCover',
  () => ({ useExternalGameCover: () => '' })
)
jest.mock('frontend/components/UI/CachedImage', () => () => null)
jest.mock('frontend/assets/heroic_card.jpg', () => 'cover.jpg')
jest.mock(
  'frontend/screens/DownloadManager/components/DownloadManagerItem/index.css',
  () => ({})
)
jest.mock(
  'frontend/screens/DownloadManager/components/ExternalActiveCard/index.css',
  () => ({})
)

const job: ExternalDownloadJob = {
  id: 'uno',
  installationId: 'uno',
  operation: 'install',
  status: 'downloading',
  bytes: 0,
  speed: 0,
  candidates: [],
  createdAt: '2026-10-13',
  transport: 'torbox',
  transferPhase: 'remote',
  remoteStatus: 'downloading',
  remoteProgress: 0.3,
  game: {
    id: 'uno',
    title: 'UNO',
    providerId: 'com.ghost.online-fix-source',
    providerName: 'Online-Fix',
    platform: 'windows'
  }
}

it('renders the wait notice on the real active game card while TorBox downloads', () => {
  const html = renderToStaticMarkup(createElement(ExternalActiveCard, { job }))
  expect(html).toContain(
    'Aguardando o TorBox concluir o download para iniciar a transferência para o PC.'
  )
  expect(html).toContain('role="status"')
  expect(html).toContain('30%')
})

it('distinguishes torrent capture, submission and cloud preparation', () => {
  expect(torboxTransferMessage({ ...job, transferPhase: 'torrent' })).toContain(
    'Obtendo o torrent'
  )
  expect(
    torboxTransferMessage({
      ...job,
      remoteStatus: 'Enviando o torrent ao TorBox'
    })
  ).toBe('Enviando o torrent ao TorBox…')
  expect(
    torboxTransferMessage({
      ...job,
      remoteStatus: 'Verificando o torrent na conta TorBox'
    })
  ).toContain('Verificando')
  expect(
    torboxTransferMessage({ ...job, remoteProgress: 1, remoteStatus: 'cached' })
  ).toContain('Aguardando o TorBox')
})

it.each(['paused', 'error', 'completed'] as const)(
  'does not show an active wait notice for %s jobs',
  (status) => {
    expect(torboxTransferMessage({ ...job, status })).toBeUndefined()
  }
)

it('clears the cloud wait notice once transfer to the PC starts', () => {
  const local = {
    ...job,
    transferPhase: 'local' as const,
    total: 1000,
    bytes: 100
  }
  expect(torboxTransferMessage(local)).toBeUndefined()
  const html = renderToStaticMarkup(
    createElement(ExternalActiveCard, { job: local })
  )
  expect(html).not.toContain('Aguardando o TorBox concluir')
  expect(html).toContain('Transferindo para o PC')
})

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader } from '../Dialog'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import classNames from 'classnames'
import { Release } from 'common/types'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faRotate,
  faCheck,
  faRocket,
  faTriangleExclamation
} from '@fortawesome/free-solid-svg-icons'
import './index.scss'

type Props = {
  onClose: () => void
  dimissVersionCheck?: boolean
  onUpdateFound?: (release: Release) => void
}

const storage = window.localStorage
const lastChangelog = storage.getItem('last_changelog')?.replaceAll('"', '')

export function ChangelogModal({
  onClose,
  dimissVersionCheck,
  onUpdateFound
}: Props) {
  const [currentChangelog, setCurrentChangelog] = useState<Release | null>(null)
  const [heroicVersion, setHeroicVersion] = useState<string>('')
  const [loadingChangelog, setLoadingChangelog] = useState<boolean>(true)
  const [checkingUpdate, setCheckingUpdate] = useState<boolean>(false)
  const [updateStatus, setUpdateStatus] = useState<
    'idle' | 'up-to-date' | 'found' | 'error'
  >('idle')
  const [statusMessage, setStatusMessage] = useState<string>('')

  useEffect(() => {
    if (!currentChangelog) {
      window.api.getHeroicVersion().then((version) => {
        setHeroicVersion(version)
        if (dimissVersionCheck || version !== lastChangelog) {
          setLoadingChangelog(true)
          window.api
            .getCurrentChangelog()
            .then((release) => {
              setCurrentChangelog(release)
              setLoadingChangelog(false)
            })
            .catch(() => {
              setLoadingChangelog(false)
            })
        } else {
          setLoadingChangelog(false)
        }
      })
    }
  }, [])

  const handleManualUpdateCheck = async () => {
    if (checkingUpdate) return
    setCheckingUpdate(true)
    setUpdateStatus('idle')
    setStatusMessage('')
    try {
      const releases = await window.api.getLatestReleases(true)
      const newStable = releases.find((r) => r.type === 'stable')
      const newBeta = releases.find((r) => r.type === 'beta')
      const latestRelease = newStable || newBeta

      if (latestRelease) {
        setUpdateStatus('found')
        setStatusMessage(
          `Nova versão disponível (${latestRelease.tag_name})! Abrindo atualização...`
        )
        if (onUpdateFound) {
          onUpdateFound(latestRelease)
          onClose()
        } else {
          window.api.openExternalUrl(latestRelease.html_url)
        }
      } else {
        setUpdateStatus('up-to-date')
        setStatusMessage(
          `Você já está na versão mais recente (v${heroicVersion || 'atual'}).`
        )
      }
    } catch (error) {
      console.error('Failed to check for updates manually:', error)
      setUpdateStatus('error')
      setStatusMessage(
        'Não foi possível verificar atualizações no momento. Verifique sua conexão.'
      )
    } finally {
      setCheckingUpdate(false)
    }
  }

  if (!currentChangelog && !dimissVersionCheck) {
    return <></>
  }

  if (!currentChangelog && loadingChangelog && !heroicVersion) {
    return <></>
  }

  return (
    <div className={classNames('changelogModal')}>
      <Dialog onClose={onClose} showCloseButton={true}>
        <DialogHeader onClose={onClose}>
          <div className="changelogModalHeader">
            <div className="changelogModalTitle">
              {currentChangelog?.name ||
                (heroicVersion ? `👻 Ghost v${heroicVersion}` : '👻 Ghost')}
            </div>
            <button
              type="button"
              className={classNames('changelogCheckUpdateBtn', {
                'is-checking': checkingUpdate,
                'is-up-to-date': updateStatus === 'up-to-date',
                'is-found': updateStatus === 'found',
                'is-error': updateStatus === 'error'
              })}
              onClick={handleManualUpdateCheck}
              disabled={checkingUpdate}
              title="Forçar verificação manual de atualização no GitHub"
            >
              <FontAwesomeIcon
                icon={
                  checkingUpdate
                    ? faRotate
                    : updateStatus === 'up-to-date'
                      ? faCheck
                      : updateStatus === 'found'
                        ? faRocket
                        : updateStatus === 'error'
                          ? faTriangleExclamation
                          : faRotate
                }
                spin={checkingUpdate}
              />
              <span>
                {checkingUpdate
                  ? 'Verificando...'
                  : updateStatus === 'up-to-date'
                    ? 'Versão Atualizada'
                    : updateStatus === 'found'
                      ? 'Atualização Encontrada!'
                      : 'Verificar Atualização'}
              </span>
            </button>
          </div>
        </DialogHeader>
        <DialogContent>
          {statusMessage && (
            <div
              className={classNames(
                'changelogUpdateStatusBanner',
                `is-${updateStatus}`
              )}
            >
              {statusMessage}
            </div>
          )}
          <div className={classNames('changelogModalContent')}>
            {currentChangelog?.body ? (
              <ReactMarkdown
                className="changelogModalContent"
                linkTarget={'_blank'}
                rehypePlugins={[rehypeRaw]}
              >
                {currentChangelog.body}
              </ReactMarkdown>
            ) : loadingChangelog ? (
              <p>Carregando notas de lançamento...</p>
            ) : (
              <p>
                Notas de lançamento da versão v{heroicVersion} carregadas
                localmente. Utilize o botão <b>Verificar Atualização</b> acima
                para consultar novas versões no servidor oficial.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

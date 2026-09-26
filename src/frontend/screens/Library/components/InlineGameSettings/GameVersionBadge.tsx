import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTag, faSpinner, faPen, faCheck, faTimes, faBolt, faSyncAlt } from '@fortawesome/free-solid-svg-icons'
import { GameInfo } from 'common/types'
import { DetectedVersionResult } from 'common/types/ipc'
import { useExternalGames, SourceBadge } from 'frontend/screens/ExternalGames/shared'

interface GameVersionBadgeProps {
  game: GameInfo
}

export default function GameVersionBadge({ game }: GameVersionBadgeProps) {
  const navigate = useNavigate()
  const [versionInfo, setVersionInfo] = useState<DetectedVersionResult | null>(null)
  const [loading, setLoading] = useState(false)
  const { state: extState } = useExternalGames()
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [checkError, setCheckError] = useState('')
  const [updating, setUpdating] = useState(false)

  const extInstallation = useMemo(() => {
    const gameAppName = String(game.app_name || '').toLowerCase()
    const gameTitle = String(game.title || '').trim().toLowerCase()
    const gameFolder = String(game.folder_name || game.install?.install_path || '').trim().toLowerCase()
    const gameExe = String(game.install?.executable || '').trim().toLowerCase()

    return extState.installations?.find((i) => {
      if (!i) return false
      const instAppName = String(i.appName || '').toLowerCase()
      const instId = String(i.id || '').toLowerCase()

      // 1. Direct AppName or ID match
      if (gameAppName && (instAppName === gameAppName || instId === gameAppName)) return true
      if (gameAppName && instAppName && (gameAppName.includes(instId) || instAppName.includes(gameAppName))) return true

      // 2. Folder / Directory match (critical for sideload/piratas where install_path is in folder_name)
      const instDir = String(i.directory || '').trim().toLowerCase()
      if (gameFolder && instDir && (gameFolder === instDir || gameFolder.replace(/[/\\]+$/, '') === instDir.replace(/[/\\]+$/, ''))) return true

      // 3. Executable match
      const instExe = String(i.executable || '').trim().toLowerCase()
      if (gameExe && instExe && gameExe === instExe) return true

      // 4. Title match
      const instTitle = String(i.game?.title || '').trim().toLowerCase()
      if (gameTitle && instTitle && (gameTitle === instTitle || gameTitle.replace(/[^a-z0-9]/g, '') === instTitle.replace(/[^a-z0-9]/g, ''))) return true

      return false
    })
  }, [extState.installations, game.app_name, game.folder_name, game.install?.install_path, game.install?.executable, game.title])

  const [isResolvingDate, setIsResolvingDate] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let isMounted = true
    if (!game || !game.app_name) return

    async function loadVersion() {
      setLoading(true)
      try {
        const res: DetectedVersionResult | null = extInstallation
          ? extInstallation.game.version ? { version: extInstallation.game.version, source: 'manifest', details: `Versão instalada registrada pelo Ghost · ${extInstallation.game.providerName}` } : null
          : await window.api.detectGameVersion(game)
        if (!isMounted) return

        if (res) {
          if (res.isDate && res.rawDate) {
            // Exibe a data de compilação temporariamente e resolve na internet em background
            setVersionInfo(res)
            setIsResolvingDate(true)
            try {
              const onlineRes = await window.api.resolveDateVersionOnline(
                game.title,
                res.rawDate
              )
              if (isMounted && onlineRes) {
                setVersionInfo(onlineRes)
              }
            } catch {
              // Mantém a data original se falhar a resolução online
            } finally {
              if (isMounted) setIsResolvingDate(false)
            }
          } else {
            setVersionInfo(res)
          }
        } else {
          setVersionInfo(null)
        }
      } catch (err) {
        console.error('Erro ao detectar versão do jogo:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadVersion()

    return () => {
      isMounted = false
    }
  }, [game?.app_name, game?.version, extInstallation?.id, extInstallation?.game.version, extInstallation?.installedAt])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditValue(versionInfo?.version || '')
    setEditing(true)
  }

  const handleSave = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.stopPropagation()
    const clean = editValue.trim()
    if (!clean) {
      setEditing(false)
      return
    }

    try {
      const res = await window.api.setGameVersion(game.app_name, clean)
      if (res?.success) {
        setVersionInfo({
          version: res.version,
          source: 'manual',
          details: 'Definido manualmente / AnkerGames'
        })
      }
    } catch (err) {
      console.error('Erro ao salvar versão:', err)
    } finally {
      setEditing(false)
    }
  }

  const handleCancel = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      e.stopPropagation()
      handleCancel()
    }
  }

  if (loading && !versionInfo) {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 12px',
          borderRadius: '16px',
          background: 'rgba(0, 229, 255, 0.05)',
          border: '1px solid rgba(0, 229, 255, 0.2)',
          color: 'rgba(0, 229, 255, 0.6)',
          fontSize: '11px',
          fontWeight: '600'
        }}
      >
        <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: '10px' }} />
        <span>Identificando versão...</span>
      </div>
    )
  }

  if (editing) {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '2px 8px',
          borderRadius: '16px',
          background: 'rgba(10, 15, 25, 0.95)',
          border: '1px solid #00ffff',
          boxShadow: '0 0 10px rgba(0, 229, 255, 0.3)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <FontAwesomeIcon icon={faTag} style={{ color: '#00ffff', fontSize: '11px' }} />
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ex: v1.0.4 ou Build 12345"
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#fff',
            fontSize: '12px',
            fontWeight: '600',
            width: '130px',
            padding: '2px 4px'
          }}
        />
        <button
          onClick={handleSave}
          title="Salvar versão (Enter)"
          style={{
            background: 'rgba(0, 229, 255, 0.2)',
            border: 'none',
            borderRadius: '50%',
            width: '20px',
            height: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#00ffff',
            cursor: 'pointer'
          }}
        >
          <FontAwesomeIcon icon={faCheck} style={{ fontSize: '10px' }} />
        </button>
        <button
          onClick={handleCancel}
          title="Cancelar (Esc)"
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            borderRadius: '50%',
            width: '20px',
            height: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#aaa',
            cursor: 'pointer'
          }}
        >
          <FontAwesomeIcon icon={faTimes} style={{ fontSize: '10px' }} />
        </button>
      </div>
    )
  }

  const currentVer = versionInfo?.version || 'Sem Versão'
  const isPlaceholder = !versionInfo?.version

  const tooltipTitle = isPlaceholder
    ? 'Nenhuma versão identificada. Clique para definir manualmente para o AnkerGames'
    : `${versionInfo.details || 'Versão instalada do jogo'}${
        isResolvingDate ? ' (Sincronizando com histórico de updates online...)' : ''
      }\n• Vital para integração de updates com o AnkerGames\n• Clique para editar manualmente`

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap' }}>
      {extInstallation && (
        <SourceBadge
          name={extInstallation.game.providerName}
          icon={extInstallation.game.providerIcon}
        />
      )}
      <div
        onClick={handleStartEdit}
        title={tooltipTitle}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 12px',
          borderRadius: '16px',
          background: isPlaceholder ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 229, 255, 0.08)',
          border: isPlaceholder
            ? '1px dashed rgba(255, 255, 255, 0.2)'
            : '1px solid rgba(0, 229, 255, 0.35)',
          color: isPlaceholder ? '#888' : '#00ffff',
          boxShadow: isPlaceholder ? 'none' : '0 0 10px rgba(0, 229, 255, 0.12)',
          fontSize: '12px',
          fontWeight: '600',
          letterSpacing: '0.4px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          userSelect: 'none',
          maxWidth: '220px',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.background = isPlaceholder
            ? 'rgba(255, 255, 255, 0.08)'
            : 'rgba(0, 229, 255, 0.16)'
          e.currentTarget.style.borderColor = isPlaceholder
            ? 'rgba(255, 255, 255, 0.4)'
            : 'rgba(0, 229, 255, 0.7)'
          e.currentTarget.style.boxShadow = isPlaceholder
            ? 'none'
            : '0 0 16px rgba(0, 229, 255, 0.3)'
          e.currentTarget.style.transform = 'translateY(-1px)'
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = isPlaceholder
            ? 'rgba(255, 255, 255, 0.04)'
            : 'rgba(0, 229, 255, 0.08)'
          e.currentTarget.style.borderColor = isPlaceholder
            ? '1px dashed rgba(255, 255, 255, 0.2)'
            : '1px solid rgba(0, 229, 255, 0.35)'
          e.currentTarget.style.boxShadow = isPlaceholder
            ? 'none'
            : '0 0 10px rgba(0, 229, 255, 0.12)'
          e.currentTarget.style.transform = 'translateY(0)'
        }}
      >
        {isResolvingDate ? (
          <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: '11px', color: '#00ffff' }} />
        ) : (
          <FontAwesomeIcon
            icon={faTag}
            style={{ fontSize: '11px', color: isPlaceholder ? '#888' : '#00ffff' }}
          />
        )}
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {currentVer}
        </span>
        <FontAwesomeIcon
          icon={faPen}
          style={{
            fontSize: '9px',
            opacity: 0.5,
            marginLeft: '2px'
          }}
        />
      </div>

      {extInstallation?.availableUpdate && (
        <button
          onClick={async (e) => {
            e.stopPropagation()
            if (!extInstallation?.availableUpdate || updating) return
            setUpdating(true)
            try {
              await window.api.externalGamesInstall({
                game: extInstallation.availableUpdate,
                sourceId: extInstallation.availableUpdate.providerId,
                replaceInstallationId: extInstallation.id,
                confirmed: true
              })
              navigate('/download-manager')
            } catch (err) {
              console.error('Falha ao disparar atualização:', err)
            } finally {
              setUpdating(false)
            }
          }}
          disabled={updating}
          title={`Nova versão ${extInstallation.availableUpdate.version || ''} disponível via ${extInstallation.availableUpdate.providerName || extInstallation.game.providerName}!\nClique para baixar e atualizar automaticamente preservando seus saves.`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(255, 183, 3, 0.22), rgba(255, 107, 0, 0.32))',
            border: '1px solid #ffb703',
            boxShadow: '0 0 12px rgba(255, 183, 3, 0.35)',
            color: '#fff',
            fontSize: '11px',
            fontWeight: '700',
            cursor: updating ? 'wait' : 'pointer',
            transition: 'all 0.2s ease',
            userSelect: 'none'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.boxShadow = '0 0 18px rgba(255, 183, 3, 0.6)'
            e.currentTarget.style.transform = 'translateY(-1px)'
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.boxShadow = '0 0 12px rgba(255, 183, 3, 0.35)'
            e.currentTarget.style.transform = 'translateY(0)'
          }}
        >
          <FontAwesomeIcon icon={updating ? faSpinner : faBolt} spin={updating} style={{ color: '#ffb703' }} />
          <span>{updating ? 'Iniciando...' : `Atualizar: v${extInstallation.availableUpdate.version || 'Nova'}`}</span>
        </button>
      )}

      {!extInstallation?.availableUpdate && (
        <button
          onClick={async (e) => {
            e.stopPropagation()
            if (checkingUpdate) return
            setCheckingUpdate(true)
            setCheckError('')
            try {
              let targetId = extInstallation?.id
              if (!targetId) {
                // Autocria / vincula a instalação externa para o jogo sideload
                const created = await window.api.externalGamesGetOrCreateInstallation(game.app_name, game)
                if (created?.id) targetId = created.id
              }
              if (targetId) {
                const result = await window.api.externalGamesAction({
                  type: 'check-update',
                  installationId: targetId
                })
                if (result.error) setCheckError(result.error)
              } else {
                navigate(`/external-games?q=${encodeURIComponent(game.title)}`)
              }
            } catch (err) {
              setCheckError('Não foi possível consultar a fonte. Tente novamente.')
              console.error('Falha ao verificar update:', err)
            } finally {
              setCheckingUpdate(false)
            }
          }}
          disabled={checkingUpdate}
          title={extInstallation ? `Verificar se há nova versão em ${extInstallation.game.providerName}` : 'Verificar se há nova versão nas fontes comunitárias'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '4px 10px',
            borderRadius: '16px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: '#94a3b8',
            fontSize: '11px',
            fontWeight: '600',
            cursor: checkingUpdate ? 'wait' : 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.color = '#00ffff'
            e.currentTarget.style.borderColor = 'rgba(0, 229, 255, 0.4)'
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.color = '#94a3b8'
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
          }}
        >
          <FontAwesomeIcon icon={checkingUpdate ? faSpinner : faSyncAlt} spin={checkingUpdate} style={{ fontSize: '10px' }} />
          <span>{checkingUpdate ? 'Checando...' : 'Buscar Update'}</span>
        </button>
      )}
      {(checkError || extInstallation?.updateMessage) && <span role="status" style={{ fontSize: '11px', maxWidth: '320px', color: checkError ? '#f87171' : '#94a3b8' }}>{checkError || extInstallation?.updateMessage}</span>}
    </div>
  )
}

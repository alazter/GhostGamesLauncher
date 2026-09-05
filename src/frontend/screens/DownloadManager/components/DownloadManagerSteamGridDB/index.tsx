import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faGlobe } from '@fortawesome/free-solid-svg-icons'
import { faApple, faLinux, faWindows } from '@fortawesome/free-brands-svg-icons'
import { GameInfo } from 'common/types'
import { SteamGridDBPicker, CachedImage } from 'frontend/components/UI'
import StoreLogos from 'frontend/components/UI/StoreLogos'
import fallbackImage from 'frontend/assets/heroic_card.jpg'
import { gameOverridesStore, sideloadLibrary, configStore } from 'frontend/helpers/electronStores'
import useGlobalState from 'frontend/state/GlobalStateV2'
import './index.scss'

interface Props {
  game: GameInfo
  onBack: () => void
}

export default function DownloadManagerSteamGridDB({ game, onBack }: Props) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<'grids' | 'heroes'>('grids')

  const initialOverrides = gameOverridesStore.get('overrides', {})?.[game.app_name] || game.overrides

  const [editCover, setEditCover] = useState(
    initialOverrides?.art_cover || game.art_cover || ''
  )
  const [editSquare, setEditSquare] = useState(
    initialOverrides?.art_square || game.art_square || ''
  )

  const title = game.overrides?.title || game.title || game.app_name

  const handleSaveAndFinish = async () => {
    try {
      const finalCover = editCover || ''
      const finalSquare = editSquare || ''

      // 1. Atualizar overrides na store e Zustand
      const overrides = gameOverridesStore.get('overrides', {})
      overrides[game.app_name] = {
        ...overrides[game.app_name],
        title,
        art_cover: finalCover,
        art_square: finalSquare,
        is_manual: true
      }
      gameOverridesStore.set('overrides', overrides)
      useGlobalState.getState().setGameOverrides(overrides)

      ;(configStore as any).set('backup.lastModified', Date.now())
      window.dispatchEvent(new Event('backupStateChanged'))

      // 2. Se for sideload, sincronizar sideloadLibrary
      if (game.runner === 'sideload') {
        const updatedGame: GameInfo = {
          ...game,
          art_cover: finalCover,
          art_square: finalSquare
        }
        const games = sideloadLibrary.get('games', [])
        const idx = games.findIndex((g) => g.app_name === game.app_name)
        if (idx !== -1) {
          games[idx] = { ...games[idx], ...updatedGame }
        } else {
          games.push(updatedGame)
        }
        sideloadLibrary.set('games', games)
        await window.api.addNewApp(updatedGame)
      }

      // 3. Salvar no backend
      await window.api.setGameMetadataOverride({
        appName: game.app_name,
        title,
        art_cover: finalCover,
        art_square: finalSquare
      })

      // 4. Disparar evento global para atualizar todos os cards
      window.dispatchEvent(
        new CustomEvent('heroicGameCoverChanged', {
          detail: {
            appName: game.app_name,
            runner: game.runner,
            art_cover: finalCover,
            art_square: finalSquare
          }
        })
      )
    } catch (err) {
      console.error('Erro ao salvar capas no SteamGridDB:', err)
    } finally {
      onBack()
    }
  }

  const platformIcon = () => {
    const appPlatform = (game.install?.platform || 'windows').toLowerCase()
    let icon = faGlobe
    if (appPlatform.includes('win')) icon = faWindows
    else if (appPlatform.includes('linux')) icon = faLinux
    else if (appPlatform.includes('mac') || appPlatform.includes('osx')) icon = faApple

    return (
      <FontAwesomeIcon
        style={{ opacity: 0.7, fontSize: '15px' }}
        icon={icon}
      />
    )
  }

  return (
    <div className="dmSteamGridDBPage">
      {/* Barra de Navegação Superior */}
      <div className="dmSteamGridDBTopBar">
        <button
          type="button"
          className="dmSteamGridDBBackBtn"
          onClick={onBack}
          title={t('button.back', 'Voltar para Downloads')}
        >
          <FontAwesomeIcon icon={faArrowLeft} />
          <span>Voltar para Downloads</span>
        </button>

        <div className="dmSteamGridDBGameHeader">
          <div className="dmSteamGridDBStoreLogo" title={game.runner}>
            <StoreLogos runner={game.runner} appName={game.app_name} className="dmStoreLogoSvg" />
          </div>
          <h3 className="dmSteamGridDBGameTitle" title={title}>
            {title}
          </h3>
          <span className="dmSteamGridDBBadge">
            SteamGridDB
          </span>
        </div>
      </div>

      {/* Corpo Principal: Previews à Esquerda + Picker à Direita */}
      <div className="dmSteamGridDBContent">
        {/* Coluna Esquerda: Previews Interativos */}
        <div className="dmSteamGridDBLeftCol">
          <div className="dmSteamGridDBColHeader">
            <span>Prévia das Capas</span>
          </div>

          {/* Capa Vertical (Poster 2:3) */}
          <div
            className={`dmSteamGridDBPreviewBox ${mode === 'grids' ? 'isActive' : ''}`}
            onClick={() => setMode('grids')}
            title="Clique para buscar capas verticais (pôsteres)"
          >
            <div className="dmSteamGridDBPreviewLabelRow">
              <span className="dmSteamGridDBPreviewLabel">Capa Vertical (Pôster)</span>
              {mode === 'grids' && <span className="dmSteamGridDBActiveTag">Editando</span>}
            </div>
            <div className="dmSteamGridDBCoverWrapper vertical">
              <CachedImage
                key={editSquare}
                src={editSquare || fallbackImage}
                alt={title}
                className="dmSteamGridDBPosterImg"
              />
            </div>
          </div>

          {/* Banner Horizontal (Hero 16:9) */}
          <div
            className={`dmSteamGridDBPreviewBox ${mode === 'heroes' ? 'isActive' : ''}`}
            onClick={() => setMode('heroes')}
            title="Clique para buscar banners horizontais (heroes)"
          >
            <div className="dmSteamGridDBPreviewLabelRow">
              <span className="dmSteamGridDBPreviewLabel">Banner Horizontal (Hero)</span>
              {mode === 'heroes' && <span className="dmSteamGridDBActiveTag">Editando</span>}
            </div>
            <div className="dmSteamGridDBCoverWrapper horizontal">
              <CachedImage
                key={editCover}
                src={editCover || fallbackImage}
                alt={title}
                className="dmSteamGridDBHeroImg"
              />
            </div>
          </div>

          {/* Rodapé da Coluna Esquerda */}
          <div className="dmSteamGridDBGameMeta">
            <span className="dmSteamGridDBMetaTitle">{title}</span>
            {platformIcon()}
          </div>
        </div>

        {/* Coluna Direita: SteamGridDBPicker */}
        <div className="dmSteamGridDBRightCol">
          <SteamGridDBPicker
            initialTitle={title}
            mode={mode}
            hideCloseButton={true}
            onClose={onBack}
            onCancel={onBack}
            onFinish={handleSaveAndFinish}
            onSelect={(url: string) => {
              if (mode === 'grids') {
                setEditSquare(url)
              } else {
                setEditCover(url)
              }
            }}
          />
        </div>
      </div>
    </div>
  )
}

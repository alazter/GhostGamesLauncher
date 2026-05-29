import { useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlay, faCog, faStore, faUsers, faDownload, faNewspaper, faUser } from '@fortawesome/free-solid-svg-icons'
import { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { GameInfo } from 'common/types'

interface Props {
  game: GameInfo
  onClose: () => void
}

export default function HeroPanel({ game, onClose }: Props) {
  const navigate = useNavigate()

  // O mock mostra playtime em horas, vou tentar formatar o que tiver em `game.playtime` ou colocar 0
  const playTimeStr = '125h' // Mockado pois playtime real não vem direto no GameInfo

  const handlePlay = () => {
    // Isso deve chamar a api de launch real se estivéssemos integrando profundamente,
    // mas o Heroic gerencia isso via GameCardPlayButton.
    // Para simplificar no mockup:
    console.log('Launch game: ', game.app_name)
    // window.api.launch({ appName: game.app_name, runner: game.runner }) // Exemplo de uso real
  }

  const handleSettings = () => {
    navigate(`/gamepage/${game.runner}/${game.app_name}`, { state: { gameInfo: game } })
  }

  const handleStore = () => {
    let storeParam = 'epic'
    if (game.runner === 'gog') storeParam = 'gog'
    if (game.runner === 'nile') storeParam = 'amazon'
    if (game.runner === 'zoom') storeParam = 'zoom'
    navigate(`/store/${storeParam}`)
  }

  return (
    <div style={{
      width: '280px',
      flexShrink: 0,
      background: 'rgba(20, 25, 30, 0.7)',
      backdropFilter: 'blur(10px)',
      borderRadius: '16px',
      padding: '20px',
      marginRight: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '15px',
      border: '1px solid rgba(0, 255, 255, 0.2)',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)'
    }}>
      {/* Imagem */}
      <img
        src={game.art_cover || ''}
        alt={game.title}
        style={{
          width: '100%',
          aspectRatio: '3/4',
          objectFit: 'cover',
          borderRadius: '12px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
          cursor: 'pointer'
        }}
        onClick={onClose}
      />

      {/* Titulo */}
      <h2 style={{
        fontSize: '20px',
        fontWeight: 'bold',
        color: '#fff',
        margin: '0 0 5px 0',
        textAlign: 'center'
      }}>
        {game.title}
      </h2>

      {/* Ações primárias */}
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
        <button
          onClick={handleSettings}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            color: '#fff',
            cursor: 'pointer'
          }}
        >
          <FontAwesomeIcon icon={faCog} />
        </button>
        <button
          onClick={handlePlay}
          style={{
            background: '#00ffff',
            border: 'none',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            color: '#000',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          <FontAwesomeIcon icon={faPlay} />
        </button>
      </div>

      {/* Infos */}
      <div style={{ color: '#aaa', fontSize: '14px' }}>
        <p style={{ margin: '5px 0' }}><strong>Tempo de jogo:</strong> {playTimeStr}</p>
        <p style={{ margin: '5px 0' }}><strong>Última jogada:</strong> Ontem</p>
      </div>

      <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.1)', margin: '10px 0' }} />

      {/* Links de Sistema (do Mockup) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <HeroLink icon={faStore} label="Loja" onClick={handleStore} />
        <HeroLink icon={faUsers} label="Comunidade" onClick={() => window.api.openExternalUrl('https://discord.gg/heroicgameslauncher')} />
        <HeroLink icon={faDownload} label="Downloads" onClick={() => navigate('/download-manager')} />
        <HeroLink icon={faNewspaper} label="Notícias" onClick={() => {}} />
        <HeroLink icon={faUser} label="Perfil do Usuário" onClick={() => navigate('/login')} />
        <HeroLink icon={faCog} label="Configurações do Launcher" onClick={() => navigate('/settings/general')} />
      </div>
    </div>
  )
}

function HeroLink({ icon, label, onClick }: { icon: IconDefinition, label: string, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 'none',
        color: '#ccc',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '8px',
        cursor: 'pointer',
        fontSize: '14px',
        textAlign: 'left',
        borderRadius: '6px',
        transition: 'all 0.2s ease'
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.background = 'rgba(0, 255, 255, 0.1)'
        e.currentTarget.style.color = '#00ffff'
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = '#ccc'
      }}
    >
      <FontAwesomeIcon icon={icon} style={{ width: '16px' }} />
      {label}
    </button>
  )
}

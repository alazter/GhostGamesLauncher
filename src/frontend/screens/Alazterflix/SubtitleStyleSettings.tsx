import React, { useState, useEffect, useCallback } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faClosedCaptioning,
  faTextHeight,
  faPalette,
  faSquareCheck,
  faUpDown,
  faRotateRight
} from '@fortawesome/free-solid-svg-icons'

export interface SubtitleStyleConfig {
  fontSize: string
  color: string
  bgStyle: 'shadow' | 'box'
  position: number
}

const DEFAULT_SUBTITLE_SETTINGS: SubtitleStyleConfig = {
  fontSize: '24px',
  color: '#ffffff',
  bgStyle: 'shadow',
  position: 78
}

export default function SubtitleStyleSettings() {
  const [settings, setSettings] = useState<SubtitleStyleConfig>(() => {
    try {
      const saved = localStorage.getItem('ghost_alazterflix_sub_settings')
      if (saved) {
        const parsed = JSON.parse(saved)
        return {
          fontSize: parsed.fontSize || DEFAULT_SUBTITLE_SETTINGS.fontSize,
          color: parsed.color || DEFAULT_SUBTITLE_SETTINGS.color,
          bgStyle: parsed.bgStyle || DEFAULT_SUBTITLE_SETTINGS.bgStyle,
          position:
            typeof parsed.position === 'number'
              ? parsed.position === 85
                ? 78
                : parsed.position
              : DEFAULT_SUBTITLE_SETTINGS.position
        }
      }
    } catch {}
    return DEFAULT_SUBTITLE_SETTINGS
  })

  const [feedback, setFeedback] = useState<string | null>(null)

  const updateSettings = useCallback(
    (updates: Partial<SubtitleStyleConfig>) => {
      setSettings((prev) => {
        const next: SubtitleStyleConfig = {
          ...prev,
          ...updates
        }
        try {
          localStorage.setItem(
            'ghost_alazterflix_sub_settings',
            JSON.stringify(next)
          )
          window.dispatchEvent(new Event('storage'))
        } catch {}
        return next
      })
      setFeedback('Estilo padrão atualizado!')
      setTimeout(() => setFeedback(null), 2500)
    },
    []
  )

  const handleResetDefaults = () => {
    updateSettings(DEFAULT_SUBTITLE_SETTINGS)
  }

  // Sincroniza com alterações externas de storage
  useEffect(() => {
    const handleStorage = () => {
      try {
        const saved = localStorage.getItem('ghost_alazterflix_sub_settings')
        if (saved) {
          const parsed = JSON.parse(saved)
          setSettings({
            fontSize: parsed.fontSize || DEFAULT_SUBTITLE_SETTINGS.fontSize,
            color: parsed.color || DEFAULT_SUBTITLE_SETTINGS.color,
            bgStyle: parsed.bgStyle || DEFAULT_SUBTITLE_SETTINGS.bgStyle,
            position:
              typeof parsed.position === 'number'
                ? parsed.position === 85
                  ? 78
                  : parsed.position
                : DEFAULT_SUBTITLE_SETTINGS.position
          })
        }
      } catch {}
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  return (
    <div className="settings-card alazter-subtitle-style-settings">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px'
        }}
      >
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FontAwesomeIcon
            icon={faClosedCaptioning}
            style={{ color: 'var(--alazter-cyan, #00e5ff)' }}
          />
          <span>Estilo Padrão de Legendas</span>
        </h3>
        <button
          type="button"
          className="button is-small is-ghost"
          style={{ fontSize: '11px', color: '#94a3b8' }}
          onClick={handleResetDefaults}
          title="Restaurar padrão cinema"
        >
          <FontAwesomeIcon icon={faRotateRight} />
          <span style={{ marginLeft: '4px' }}>Restaurar Padrão</span>
        </button>
      </div>

      <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#94a3b8' }}>
        Defina a tipografia, cor, contraste e posicionamento vertical que serão
        usados por padrão em todas as reproduções de filmes e séries.
      </p>

      {/* LIVE PREVIEW BOX */}
      <div
        className="subtitle-live-preview-box"
        style={{
          position: 'relative',
          width: '100%',
          height: '140px',
          borderRadius: '8px',
          background:
            'linear-gradient(180deg, rgba(15, 23, 42, 0.8) 0%, rgba(2, 6, 23, 0.95) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          overflow: 'hidden',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'inset 0 0 24px rgba(0,0,0,0.8)'
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '8px',
            left: '12px',
            fontSize: '10px',
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            fontWeight: 700
          }}
        >
          Prévia em Tempo Real
        </div>

        <div
          className={`player-subtitle-cue-box ${settings.bgStyle === 'box' ? 'style-box' : 'style-shadow'}`}
          style={{
            position: 'absolute',
            bottom: `calc(${Math.max(1, Math.min(90, 100 - settings.position))}% - 10px)`,
            fontSize: settings.fontSize,
            color: settings.color,
            backgroundColor:
              settings.bgStyle === 'box' ? 'rgba(0, 0, 0, 0.85)' : 'transparent',
            padding: settings.bgStyle === 'box' ? '3px 12px' : '0 4px',
            borderRadius: settings.bgStyle === 'box' ? '6px' : '0',
            fontWeight: 700,
            textAlign: 'center',
            lineHeight: 1.25,
            pointerEvents: 'none',
            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            textShadow:
              settings.bgStyle === 'shadow'
                ? '0 0 4px rgba(0,0,0,0.9), 0 2px 4px rgba(0,0,0,0.9), 0 -1px 2px rgba(0,0,0,0.9), 1px 1px 2px rgba(0,0,0,0.9), -1px -1px 2px rgba(0,0,0,0.9)'
                : 'none'
          }}
        >
          Esta é uma prévia do seu estilo padrão de legenda.
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: '6px',
            right: '12px',
            fontSize: '10px',
            color: '#64748b'
          }}
        >
          Posição: {settings.position}% | Tam: {settings.fontSize} | {settings.bgStyle === 'box' ? 'Caixa' : 'Sombra'}
        </div>
      </div>

      {/* CONTROLES EM GRADE */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          fontSize: '13px'
        }}
      >
        {/* TAMANHO DO TEXTO */}
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '6px',
              fontWeight: 600,
              color: '#fff'
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FontAwesomeIcon icon={faTextHeight} style={{ color: '#94a3b8' }} />
              Tamanho do Texto
            </span>
            <span
              className="settings-val-badge"
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                background: 'rgba(255,255,255,0.08)',
                borderRadius: '4px',
                color: 'var(--alazter-cyan, #00e5ff)'
              }}
            >
              {settings.fontSize}
            </span>
          </div>
          <div className="pills-options-row" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { label: 'Pequena', val: '18px' },
              { label: 'Média (Padrão)', val: '24px' },
              { label: 'Grande', val: '30px' },
              { label: 'Extra Grande', val: '36px' }
            ].map((opt) => (
              <button
                key={opt.val}
                type="button"
                className={`sub-pill-btn ${settings.fontSize === opt.val ? 'active' : ''}`}
                onClick={() => updateSettings({ fontSize: opt.val })}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* COR DO TEXTO */}
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '6px',
              fontWeight: 600,
              color: '#fff'
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FontAwesomeIcon icon={faPalette} style={{ color: '#94a3b8' }} />
              Cor da Legenda
            </span>
          </div>
          <div className="pills-options-row" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { label: 'Branco', val: '#ffffff', dotColor: '#ffffff' },
              { label: 'Amarelo Stremio', val: '#ffd700', dotColor: '#ffd700' },
              { label: 'Ciano Neon', val: '#00e5ff', dotColor: '#00e5ff' },
              { label: 'Verde Lima', val: '#a6e22e', dotColor: '#a6e22e' }
            ].map((opt) => (
              <button
                key={opt.val}
                type="button"
                className={`sub-pill-btn ${settings.color === opt.val ? 'active' : ''}`}
                onClick={() => updateSettings({ color: opt.val })}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: opt.dotColor,
                    boxShadow: '0 0 4px rgba(0,0,0,0.5)'
                  }}
                />
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ESTILO DE FUNDO */}
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '6px',
              fontWeight: 600,
              color: '#fff'
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FontAwesomeIcon icon={faSquareCheck} style={{ color: '#94a3b8' }} />
              Estilo de Fundo & Contraste
            </span>
          </div>
          <div className="pills-options-row" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { label: 'Sombra Cinema (Sem Tarja)', val: 'shadow' },
              { label: 'Caixa Translúcida (Tarja Escura)', val: 'box' }
            ].map((opt) => (
              <button
                key={opt.val}
                type="button"
                className={`sub-pill-btn ${settings.bgStyle === opt.val ? 'active' : ''}`}
                onClick={() => updateSettings({ bgStyle: opt.val as 'shadow' | 'box' })}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* POSIÇÃO VERTICAL PADRÃO */}
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '6px',
              fontWeight: 600,
              color: '#fff'
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FontAwesomeIcon icon={faUpDown} style={{ color: '#94a3b8' }} />
              Altura / Posição Vertical Padrão
            </span>
            <span
              className="settings-val-badge"
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                background: 'rgba(255,255,255,0.08)',
                borderRadius: '4px',
                color: 'var(--alazter-cyan, #00e5ff)'
              }}
            >
              {settings.position}% (
              {settings.position >= 94
                ? 'Rodapé'
                : settings.position >= 85
                  ? 'Baixa'
                  : settings.position === 78
                    ? 'Padrão Cinema'
                    : settings.position >= 65
                      ? 'Média'
                      : settings.position >= 50
                        ? 'Alta'
                        : settings.position <= 20
                          ? 'Topo'
                          : settings.position < 78
                            ? 'Mais Alta'
                            : 'Mais Baixa'}
              )
            </span>
          </div>
          <div className="pills-options-row" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { label: 'Rodapé (96%)', val: 96 },
              { label: 'Baixa (88%)', val: 88 },
              { label: 'Padrão Cinema (78%)', val: 78 },
              { label: 'Média (68%)', val: 68 },
              { label: 'Alta (55%)', val: 55 },
              { label: 'Topo (15%)', val: 15 }
            ].map((opt) => (
              <button
                key={opt.val}
                type="button"
                className={`sub-pill-btn ${settings.position === opt.val ? 'active' : ''}`}
                onClick={() => updateSettings({ position: opt.val })}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Micro-ajustes de altura */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginTop: '8px'
            }}
          >
            <button
              type="button"
              className="sub-pill-btn"
              style={{ fontSize: '11px', padding: '3px 8px' }}
              onClick={() =>
                updateSettings({
                  position: Math.max(10, Math.min(95, settings.position - 5))
                })
              }
              title="Subir 5%"
            >
              ▲ Subir (-5%)
            </button>
            <button
              type="button"
              className="sub-pill-btn"
              style={{ fontSize: '11px', padding: '3px 8px' }}
              onClick={() =>
                updateSettings({
                  position: Math.max(10, Math.min(95, settings.position - 1))
                })
              }
              title="Subir 1%"
            >
              ▲ -1%
            </button>
            <button
              type="button"
              className="sub-pill-btn reset-btn"
              style={{ fontSize: '11px', padding: '3px 8px' }}
              onClick={() => updateSettings({ position: 78 })}
              title="Voltar para 78%"
            >
              78% Padrão
            </button>
            <button
              type="button"
              className="sub-pill-btn"
              style={{ fontSize: '11px', padding: '3px 8px' }}
              onClick={() =>
                updateSettings({
                  position: Math.max(10, Math.min(95, settings.position + 1))
                })
              }
              title="Descer 1%"
            >
              ▼ +1%
            </button>
            <button
              type="button"
              className="sub-pill-btn"
              style={{ fontSize: '11px', padding: '3px 8px' }}
              onClick={() =>
                updateSettings({
                  position: Math.max(10, Math.min(95, settings.position + 5))
                })
              }
              title="Descer 5%"
            >
              ▼ Descer (+5%)
            </button>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          style={{
            marginTop: '12px',
            fontSize: '12px',
            color: 'var(--alazter-cyan, #00e5ff)',
            fontWeight: 600
          }}
        >
          ✓ {feedback}
        </div>
      )}
    </div>
  )
}

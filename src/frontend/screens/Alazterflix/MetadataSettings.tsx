import React, { useEffect, useState } from 'react'
import type { CinemaMetadataSettings } from 'common/types/plugins'

interface Props {
  settings?: CinemaMetadataSettings
  onSaved: (settings: CinemaMetadataSettings) => void
}

export default function MetadataSettings({ settings, onSaved }: Props) {
  const [autoFetch, setAutoFetch] = useState(settings?.autoFetch ?? true)
  const [language, setLanguage] = useState<CinemaMetadataSettings['language']>(
    settings?.language || 'pt-BR'
  )
  const [titleSource, setTitleSource] = useState<
    CinemaMetadataSettings['titleSource']
  >(settings?.titleSource || 'file')
  const [token, setToken] = useState('')
  const [removeToken, setRemoveToken] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    setAutoFetch(settings?.autoFetch ?? true)
    setLanguage(settings?.language || 'pt-BR')
    setTitleSource(settings?.titleSource || 'file')
  }, [settings?.autoFetch, settings?.language, settings?.titleSource])
  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      const updated = await window.api.cinemaUpdateMetadataSettings({
        autoFetch,
        language,
        titleSource,
        tmdbToken: removeToken ? '' : token.trim() || undefined
      })
      onSaved(updated)
      setToken('')
      setRemoveToken(false)
      setMessage('Preferências de metadados e títulos salvas.')
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar as preferências.'
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="settings-card alazter-metadata-settings" onSubmit={save}>
      <h3>Capas e identificação das obras</h3>
      <p>
        As imagens locais têm prioridade. Capas escolhidas manualmente ficam
        protegidas nas atualizações. A busca de capas também procura fundos
        horizontais para as indicações.
      </p>

      {/* Origem do Nome das Mídias no Escaneamento com Proteção Inteligente */}
      <div
        className="alazter-title-source-section"
        style={{
          marginTop: '16px',
          marginBottom: '20px',
          padding: '16px',
          background: 'rgba(15, 23, 42, 0.65)',
          borderRadius: '10px',
          border: '1px solid rgba(0, 240, 255, 0.25)'
        }}
      >
        <h4
          style={{
            margin: '0 0 6px 0',
            color: '#00f0ff',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span>🏷️ Origem do Nome dos Vídeos no Escaneamento</span>
        </h4>
        <p
          style={{
            margin: '0 0 12px 0',
            fontSize: '12px',
            color: '#94a3b8',
            lineHeight: 1.5
          }}
        >
          Defina de onde o Alazterflix deve extrair os títulos durante a
          varredura das pastas monitoradas.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '12px',
            marginBottom: '12px'
          }}
        >
          {/* Opção 1: Nome do Arquivo */}
          <div
            onClick={() => setTitleSource('file')}
            style={{
              padding: '14px',
              borderRadius: '8px',
              cursor: 'pointer',
              border:
                titleSource === 'file'
                  ? '2px solid #00f0ff'
                  : '1px solid rgba(255, 255, 255, 0.1)',
              background:
                titleSource === 'file'
                  ? 'rgba(0, 240, 255, 0.1)'
                  : 'rgba(255, 255, 255, 0.03)',
              boxShadow:
                titleSource === 'file'
                  ? '0 0 12px rgba(0, 240, 255, 0.25)'
                  : 'none',
              transition: 'all 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <span
                style={{
                  fontWeight: 700,
                  color: titleSource === 'file' ? '#00f0ff' : '#fff',
                  fontSize: '13px'
                }}
              >
                📄 Baseado no Nome do Arquivo
              </span>
              <input
                type="radio"
                name="titleSource"
                checked={titleSource === 'file'}
                onChange={() => setTitleSource('file')}
                style={{ cursor: 'pointer', accentColor: '#00f0ff' }}
              />
            </div>
            <p
              style={{
                margin: 0,
                fontSize: '11px',
                color: '#cbd5e1',
                lineHeight: 1.4
              }}
            >
              Extrai o título limpo do arquivo de vídeo (ex:{' '}
              <code>Interestelar.2014.1080p.mkv</code> →{' '}
              <strong>Interestelar</strong>). Ideal para pastas com múltiplos
              filmes soltos.
            </p>
            <div
              style={{
                fontSize: '10px',
                color: '#38bdf8',
                marginTop: '4px',
                background: 'rgba(56, 189, 248, 0.1)',
                padding: '4px 8px',
                borderRadius: '4px'
              }}
            >
              🛡️ Se o arquivo tiver nome genérico ("video.mp4", "01.mkv"), usará
              a pasta automaticamente.
            </div>
          </div>

          {/* Opção 2: Nome da Pasta */}
          <div
            onClick={() => setTitleSource('folder')}
            style={{
              padding: '14px',
              borderRadius: '8px',
              cursor: 'pointer',
              border:
                titleSource === 'folder'
                  ? '2px solid #00f0ff'
                  : '1px solid rgba(255, 255, 255, 0.1)',
              background:
                titleSource === 'folder'
                  ? 'rgba(0, 240, 255, 0.1)'
                  : 'rgba(255, 255, 255, 0.03)',
              boxShadow:
                titleSource === 'folder'
                  ? '0 0 12px rgba(0, 240, 255, 0.25)'
                  : 'none',
              transition: 'all 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <span
                style={{
                  fontWeight: 700,
                  color: titleSource === 'folder' ? '#00f0ff' : '#fff',
                  fontSize: '13px'
                }}
              >
                📁 Baseado no Nome da Pasta
              </span>
              <input
                type="radio"
                name="titleSource"
                checked={titleSource === 'folder'}
                onChange={() => setTitleSource('folder')}
                style={{ cursor: 'pointer', accentColor: '#00f0ff' }}
              />
            </div>
            <p
              style={{
                margin: 0,
                fontSize: '11px',
                color: '#cbd5e1',
                lineHeight: 1.4
              }}
            >
              Extrai o título limpo da pasta onde o vídeo está (ex:{' '}
              <code>Interestelar (2014)/video.mkv</code> →{' '}
              <strong>Interestelar</strong>). Ideal para pastas individuais por
              obra.
            </p>
            <div
              style={{
                fontSize: '10px',
                color: '#38bdf8',
                marginTop: '4px',
                background: 'rgba(56, 189, 248, 0.1)',
                padding: '4px 8px',
                borderRadius: '4px'
              }}
            >
              🛡️ Se a pasta for raiz ou genérica ("Filmes", "Downloads"),
              usará o arquivo automaticamente.
            </div>
          </div>
        </div>

        {/* Banner Informativo da Proteção Inteligente */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            borderRadius: '6px',
            background: 'rgba(0, 240, 255, 0.06)',
            border: '1px solid rgba(0, 240, 255, 0.2)',
            fontSize: '11px',
            color: '#93c5fd'
          }}
        >
          <span>🧠</span>
          <span>
            <strong>Proteção Inteligente Ativa:</strong> Se ambos forem
            válidos, sua definição acima prevalece. Se a opção escolhida não
            contiver um título válido, o plugin não comete erros e usa a fonte
            disponível.
          </span>
        </div>
      </div>

      <label>
        <input
          type="checkbox"
          checked={autoFetch}
          onChange={(event) => setAutoFetch(event.target.checked)}
        />{' '}
        Buscar capas e informações após escanear as pastas
      </label>
      <label>
        Idioma das informações
        <select
          value={language}
          onChange={(event) =>
            setLanguage(
              event.target.value as CinemaMetadataSettings['language']
            )
          }
        >
          <option value="pt-BR">Português (Brasil)</option>
          <option value="en-US">Inglês</option>
          <option value="ja-JP">Japonês</option>
        </select>
      </label>
      <label>
        Token de leitura TMDB (opcional)
        <input
          type="password"
          autoComplete="off"
          value={token}
          onChange={(event) => {
            setToken(event.target.value)
            setRemoveToken(false)
          }}
          placeholder={
            settings?.tmdbConfigured
              ? 'TMDB conectado. Deixe vazio para manter.'
              : 'API Read Access Token do TMDB'
          }
        />
      </label>
      <p>
        Os nomes existentes permanecem em português do Brasil. Só pôsteres
        marcados como português no TMDB são aplicados pela busca online. Sem
        token, o Cinemeta identifica as obras e você pode escolher capas locais.
      </p>
      <p>
        O TMDB marca o idioma como português, sem distinguir Brasil de Portugal.
        No editor, escolha a capa da edição brasileira entre as opções
        disponíveis.
      </p>
      {settings?.tmdbConfigured && (
        <label>
          <input
            type="checkbox"
            checked={removeToken}
            onChange={(event) => setRemoveToken(event.target.checked)}
          />{' '}
          Remover o token salvo
        </label>
      )}
      <button type="submit" className="btn-action primary" disabled={busy}>
        {busy ? 'Verificando e salvando…' : 'Salvar preferências de capas'}
      </button>
      {message && <p role="status">{message}</p>}
      <div className="metadata-credits">
        <img
          src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_1-5bdc75aaebeb75dc7ae79426ddd9be3b2be1e342510f8202baf6bffa71d7f5c4.svg"
          alt="TMDB"
          onError={(event) => {
            event.currentTarget.style.display = 'none'
          }}
        />
        <strong>Créditos: TMDB e Cinemeta</strong>
        <p>
          This product uses the TMDB API but is not endorsed or certified by
          TMDB.
        </p>
      </div>
    </form>
  )
}

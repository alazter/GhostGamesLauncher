import React, { useState, useEffect, useCallback } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPuzzlePiece,
  faFolderOpen,
  faBoxArchive,
  faTrashAlt,
  faShieldHalved,
  faPalette,
  faGlobe,
  faBolt,
  faTag,
  faExclamationTriangle,
  faCheckCircle,
  faCloudUploadAlt,
  faCode,
  faStore,
  faSearch,
  faDownload,
  faExternalLinkAlt,
  faSlidersH
} from '@fortawesome/free-solid-svg-icons'
import type { PluginInfo, PluginType } from 'common/types/plugins'
import './index.scss'
import { Link } from 'react-router-dom'
import { builtinGameSources } from 'common/builtinGameSources'
import '../ExternalGames/index.css'

export default function PluginsScreen() {
  const [activeTab, setActiveTab] = useState<'installed' | 'store' | 'dev'>('installed')
  const [plugins, setPlugins] = useState<PluginInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [isDragOver, setIsDragOver] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | PluginType>('all')

  const loadPlugins = useCallback(async () => {
    try {
      setLoading(true)
      const list = await window.api.pluginsGetList()
      setPlugins(list || [])
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Falha ao carregar plugins.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPlugins()

    let remove: (() => void) | undefined
    if (window.api?.onPluginsUpdated) {
      remove = window.api.onPluginsUpdated((e, updatedList) => {
        setPlugins(updatedList || [])
      })
    }

    return () => {
      if (typeof remove === 'function') remove()
    }
  }, [loadPlugins])

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text })
    setTimeout(() => {
      setFeedback(null)
    }, 4000)
  }

  const handleToggle = async (plugin: PluginInfo) => {
    try {
      const res = await window.api.pluginsToggle(plugin.id, !plugin.isEnabled)
      if (res.success) {
        showFeedback('success', `Plugin "${plugin.name}" ${!plugin.isEnabled ? 'ativado' : 'desativado'} com sucesso.`)
        loadPlugins()
      } else {
        showFeedback('error', res.error || 'Erro ao alterar estado do plugin.')
      }
    } catch (err: any) {
      showFeedback('error', err.message || 'Erro inesperado.')
    }
  }

  const handleUninstall = async (plugin: PluginInfo) => {
    if (!window.confirm(`Deseja realmente desinstalar o plugin "${plugin.name}"?`)) {
      return
    }

    try {
      const res = await window.api.pluginsUninstall(plugin.id)
      if (res.success) {
        showFeedback('success', `Plugin "${plugin.name}" desinstalado com sucesso.`)
        loadPlugins()
      } else {
        showFeedback('error', res.error || 'Erro ao desinstalar plugin.')
      }
    } catch (err: any) {
      showFeedback('error', err.message || 'Erro ao desinstalar.')
    }
  }

  const handleInstallFile = async () => {
    try {
      const res = await window.api.pluginsInstall()
      if (res.success && res.plugin) {
        showFeedback('success', `Plugin "${res.plugin.name}" instalado e ativado!`)
        loadPlugins()
      } else if (res.error && res.error !== 'Instalação cancelada.') {
        showFeedback('error', res.error)
      }
    } catch (err: any) {
      showFeedback('error', err.message || 'Erro ao instalar arquivo.')
    }
  }

  const handleLoadUnpacked = async () => {
    try {
      const res = await window.api.pluginsLoadUnpacked()
      if (res.success && res.plugin) {
        showFeedback('success', `Plugin "${res.plugin.name}" carregado em Modo Desenvolvedor!`)
        loadPlugins()
      } else if (res.error && res.error !== 'Ação cancelada.') {
        showFeedback('error', res.error)
      }
    } catch (err: any) {
      showFeedback('error', err.message || 'Erro ao carregar pasta descompactada.')
    }
  }

  const handlePackPlugin = async () => {
    try {
      const res = await window.api.pluginsPack()
      if (res.success && res.outputPath) {
        showFeedback('success', `Pacote .ghost gerado com sucesso em: ${res.outputPath}`)
      } else if (res.error && res.error !== 'Operação cancelada.') {
        showFeedback('error', res.error)
      }
    } catch (err: any) {
      showFeedback('error', err.message || 'Erro ao empacotar plugin.')
    }
  }

  // Drag & Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const files = e.dataTransfer.files
    if (!files || files.length === 0) return

    const file = files[0]
    if (!file.name.endsWith('.ghost') && !file.name.endsWith('.zip')) {
      showFeedback('error', 'Por favor, arraste um arquivo com extensão .ghost ou .zip')
      return
    }

    try {
      const arrayBuffer = await file.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString('base64')
      const res = await window.api.pluginsInstallFromBuffer(file.name, base64)
      if (res.success && res.plugin) {
        showFeedback('success', `Plugin "${res.plugin.name}" instalado via Drag & Drop!`)
        loadPlugins()
      } else {
        showFeedback('error', res.error || 'Falha ao instalar arquivo arrastado.')
      }
    } catch (err: any) {
      showFeedback('error', err.message || 'Erro ao processar arquivo arrastado.')
    }
  }

  const getTypeIcon = (type: PluginType) => {
    switch (type) {
      case 'ui':
      case 'theme':
      case 'layout':
        return faPalette
      case 'game-source':
        return faGlobe
      case 'utility':
        return faBolt
      case 'metadata':
        return faTag
      default:
        return faPuzzlePiece
    }
  }

  const getTypeLabel = (type: PluginType) => {
    switch (type) {
      case 'layout':
      case 'ui':
        return 'Layout & Personalização'
      case 'theme':
        return 'Tema Visual'
      case 'game-source':
        return 'Fonte de Download'
      case 'utility':
        return 'Utilitário & Estabilidade'
      case 'metadata':
        return 'Metadados & Badges'
      default:
        return 'Extensão Geral'
    }
  }

  const filteredPlugins = plugins.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.author.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = typeFilter === 'all' || p.type === typeFilter
    return matchesSearch && matchesType
  })

  // Curated Community Plugins catalog
  const curatedStorePlugins = [
    {
      id: 'com.ghost.cyber-neon-expanded',
      name: 'Cyber Neon Layout & Customizer',
      version: '1.2.0',
      author: 'Ghost Team',
      type: 'layout' as PluginType,
      description:
        'Personalização profunda do layout da Biblioteca: alteração do formato dos botões (cyberpunk angular, neon glow), proporção das capas (modo poster 2:3 ou widescreen 16:9) e grid dinâmico.',
      tier: 1,
      permissions: ['ui:inject-css']
    },
    {
      id: 'com.ghost.cache-cleaner-booster',
      name: 'Ghost Cleaner & Stability Booster',
      version: '1.0.1',
      author: 'Comunidade Ghost',
      type: 'utility' as PluginType,
      description:
        'Monitoramento de integridade e estabilidade do sistema, purga automática de caches temporários obsoletos e otimizador de memória RAM/VRAM.',
      tier: 1,
      permissions: ['storage']
    },
    {
      id: 'com.ghost.howlongtobeat-badges',
      name: 'HowLongToBeat & Metacritic Badges',
      version: '1.1.0',
      author: 'Comunidade Ghost',
      type: 'metadata' as PluginType,
      description:
        'Exibe badges flutuantes nos cards da biblioteca com a nota oficial do Metacritic e o tempo estimado de zeramento do HowLongToBeat.',
      tier: 1,
      permissions: ['ui:widgets', 'network'],
      allowedDomains: ['howlongtobeat.com', 'metacritic.com']
    }
  ]

  return (
    <div
      className={`ghost-plugins-screen ${isDragOver ? 'drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag & Drop Overlay */}
      {isDragOver && (
        <div className="ghost-plugins-drag-overlay">
          <div className="ghost-plugins-drag-card">
            <FontAwesomeIcon icon={faCloudUploadAlt} className="ghost-plugins-drag-icon" />
            <h2>Solte o arquivo .ghost aqui</h2>
            <p>O GhostShield irá validar a integridade e instalar o plugin instantaneamente!</p>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="ghost-plugins-header">
        <div className="ghost-plugins-title-area">
          <div className="ghost-plugins-title-row">
            <FontAwesomeIcon icon={faPuzzlePiece} className="ghost-plugins-main-icon" />
            <h1>Ecossistema de Plugins do Ghost</h1>
            <span className="ghost-shield-pill">
              <FontAwesomeIcon icon={faShieldHalved} /> GhostShield Sandbox Ativo
            </span>
          </div>
          <p className="ghost-plugins-subtitle">
            Liberdade criativa total para a comunidade: <b>Personalização de Layout, Capas e Botões</b> •{' '}
            <b>Fontes de Jogos</b> • <b>Utilitários e Estabilidade do Sistema</b>.
          </p>
        </div>

        <div className="ghost-plugins-header-actions">
          {plugins.some((plugin) => plugin.type === 'game-source' && plugin.isEnabled) && <Link className="button" to="/external-games"><FontAwesomeIcon icon={faSearch} /> Buscar jogos</Link>}
          <button className="ghost-btn-primary" onClick={handleInstallFile}>
            <FontAwesomeIcon icon={faCloudUploadAlt} />
            <span>Instalar Plugin (.ghost)</span>
          </button>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div className={`ghost-plugins-feedback ${feedback.type}`}>
          <FontAwesomeIcon icon={feedback.type === 'success' ? faCheckCircle : faExclamationTriangle} />
          <span>{feedback.text}</span>
        </div>
      )}

        <details className="externalPanel">
          <summary>Fontes de jogos disponíveis</summary>
          <p>Adaptadores experimentais: catálogo público e download pelo site. Instalação ZIP para Windows; fontes de Switch disponíveis para consulta.</p>
          <div className="externalActions">{builtinGameSources.map((source) => <button key={source.id} className="ghost-btn-primary" disabled={loading || plugins.some((plugin) => plugin.id === source.id && plugin.version === '1.1.0')} onClick={async () => {
            setLoading(true)
            try {
              const result = await window.api.pluginsInstallBuiltinSource(source.id)
              if (result.success) { showFeedback('success', `${source.name} instalado.`); await loadPlugins() }
              else showFeedback('error', result.error || 'Não foi possível instalar a fonte.')
            } catch (error) { showFeedback('error', String(error)) }
            finally { setLoading(false) }
          }}>{source.name}{plugins.some((plugin) => plugin.id === source.id && plugin.version === '1.1.0') ? ' · Instalado' : ' · Instalar'}</button>)}</div>
        </details>
      {/* Navigation Tabs */}
      <div className="ghost-plugins-tabs-bar">
        <button
          className={`ghost-tab-btn ${activeTab === 'installed' ? 'active' : ''}`}
          onClick={() => setActiveTab('installed')}
        >
          <FontAwesomeIcon icon={faPuzzlePiece} />
          <span>Plugins Instalados ({plugins.length})</span>
        </button>

        <button
          className={`ghost-tab-btn ${activeTab === 'store' ? 'active' : ''}`}
          onClick={() => setActiveTab('store')}
        >
          <FontAwesomeIcon icon={faStore} />
          <span>Loja da Comunidade (Verificados)</span>
        </button>

        <button
          className={`ghost-tab-btn ${activeTab === 'dev' ? 'active' : ''}`}
          onClick={() => setActiveTab('dev')}
        >
          <FontAwesomeIcon icon={faCode} />
          <span>Modo Desenvolvedor</span>
        </button>
      </div>

      {/* TAB 1: INSTALLED PLUGINS */}
      {activeTab === 'installed' && (
        <div className="ghost-tab-content">
          {/* Filter and Search Bar */}
          <div className="ghost-plugins-controls-bar">
            <div className="ghost-plugins-search-box">
              <FontAwesomeIcon icon={faSearch} />
              <input
                type="text"
                placeholder="Buscar plugins instalados por nome, autor ou descrição..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="ghost-plugins-type-filter">
              <button
                className={`type-btn ${typeFilter === 'all' ? 'active' : ''}`}
                onClick={() => setTypeFilter('all')}
              >
                Todos
              </button>
              <button
                className={`type-btn ${typeFilter === 'layout' || typeFilter === 'ui' ? 'active' : ''}`}
                onClick={() => setTypeFilter('layout')}
              >
                <FontAwesomeIcon icon={faPalette} /> Layout & UI
              </button>
              <button
                className={`type-btn ${typeFilter === 'game-source' ? 'active' : ''}`}
                onClick={() => setTypeFilter('game-source')}
              >
                <FontAwesomeIcon icon={faGlobe} /> Fontes de Download
              </button>
              <button
                className={`type-btn ${typeFilter === 'utility' ? 'active' : ''}`}
                onClick={() => setTypeFilter('utility')}
              >
                <FontAwesomeIcon icon={faBolt} /> Utilitários
              </button>
            </div>
          </div>

          {loading ? (
            <div className="ghost-plugins-loading">Carregando ecossistema de plugins...</div>
          ) : filteredPlugins.length === 0 ? (
            <div className="ghost-plugins-empty-state">
              <FontAwesomeIcon icon={faPuzzlePiece} className="empty-icon" />
              <h3>Nenhum plugin instalado encontrado</h3>
              <p>
                Arraste e solte um arquivo <code>.ghost</code> aqui ou explore os plugins verificados na{' '}
                <b>Loja da Comunidade</b>.
              </p>
              <button className="ghost-btn-secondary" onClick={() => setActiveTab('store')}>
                <FontAwesomeIcon icon={faStore} />
                <span>Explorar Loja da Comunidade</span>
              </button>
            </div>
          ) : (
            <div className="ghost-plugins-grid">
              {filteredPlugins.map((plugin) => (
                <div
                  key={plugin.id}
                  className={`ghost-plugin-card ${plugin.isEnabled ? 'enabled' : 'disabled'}`}
                >
                  <div className="ghost-plugin-card-header">
                    <div className="ghost-plugin-icon-box">
                      <FontAwesomeIcon icon={getTypeIcon(plugin.type)} />
                    </div>

                    <div className="ghost-plugin-header-titles">
                      <div className="ghost-plugin-title-row">
                        <h3>{plugin.name}</h3>
                        <span className="ghost-plugin-version">v{plugin.version}</span>
                      </div>
                      <span className="ghost-plugin-author">por {plugin.author}</span>
                    </div>

                    {/* Switch Toggle */}
                    <label className="ghost-plugin-switch" title={plugin.isEnabled ? 'Desativar Plugin' : 'Ativar Plugin'}>
                      <input
                        type="checkbox"
                        checked={plugin.isEnabled}
                        onChange={() => handleToggle(plugin)}
                      />
                      <span className="slider round"></span>
                    </label>
                  </div>

                  <div className="ghost-plugin-badges-row">
                    <span className={`ghost-badge-type type-${plugin.type}`}>
                      <FontAwesomeIcon icon={getTypeIcon(plugin.type)} />
                      <span>{getTypeLabel(plugin.type)}</span>
                    </span>

                    {plugin.tier === 1 ? (
                      <span className="ghost-badge-tier verified" title="Código auditado e aprovado pela comunidade e admin">
                        <FontAwesomeIcon icon={faShieldHalved} /> 🛡️ Verificado
                      </span>
                    ) : (
                      <span className="ghost-badge-tier sideload" title="Instalado manualmente via pacote externo">
                        <FontAwesomeIcon icon={faExclamationTriangle} /> ⚠️ Sideload
                      </span>
                    )}

                    {plugin.isDev && (
                      <span className="ghost-badge-dev" title="Plugin em modo de desenvolvimento">
                        <FontAwesomeIcon icon={faCode} /> Dev
                      </span>
                    )}
                  </div>

                  <p className="ghost-plugin-description">{plugin.description}</p>

                  {/* Permissions & Safeguards */}
                  <div className="ghost-plugin-permissions">
                    <span className="perm-label">Permissões Solicitadas:</span>
                    <div className="perm-tags">
                      {plugin.permissions.map((perm) => (
                        <span key={perm} className="perm-tag">
                          {perm === 'ui:inject-css' && '🎨 Injeção de CSS / Layout'}
                          {perm === 'ui:widgets' && '🧩 Widgets de Interface'}
                          {perm === 'network' && '🌐 Acesso à Rede'}
                          {perm === 'storage' && '💾 Armazenamento Escopado'}
                          {perm === 'game-lifecycle' && '🎮 Hooks de Ciclo de Jogo'}
                          {perm === 'game-sources' && '📦 Fontes de Download'}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Allowed Domains */}
                  {plugin.allowedDomains && plugin.allowedDomains.length > 0 && (
                    <div className="ghost-plugin-domains">
                      <span className="domain-label">Domínios Autorizados:</span>
                      <span className="domain-list">{plugin.allowedDomains.join(', ')}</span>
                    </div>
                  )}

                  <div className="ghost-plugin-card-footer">
                    <button
                      className="ghost-btn-danger"
                      onClick={() => handleUninstall(plugin)}
                      title="Desinstalar Plugin"
                    >
                      <FontAwesomeIcon icon={faTrashAlt} />
                      <span>Desinstalar</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: COMMUNITY STORE */}
      {activeTab === 'store' && (
        <div className="ghost-tab-content">
          <div className="ghost-store-banner">
            <div className="ghost-store-banner-text">
              <h2>Loja Oficial de Plugins da Comunidade Ghost</h2>
              <p>
                Todos os plugins abaixo são <b>auditados abertamente no GitHub</b> pela comunidade e
                validados com o selo <b>🛡️ Tier 1 Verificado</b>.
              </p>
            </div>
          </div>

          <div className="ghost-plugins-grid">
            {curatedStorePlugins.map((item) => {
              const isAlreadyInstalled = plugins.some((p) => p.id === item.id)

              return (
                <div key={item.id} className="ghost-plugin-card store-card">
                  <div className="ghost-plugin-card-header">
                    <div className="ghost-plugin-icon-box">
                      <FontAwesomeIcon icon={getTypeIcon(item.type)} />
                    </div>

                    <div className="ghost-plugin-header-titles">
                      <div className="ghost-plugin-title-row">
                        <h3>{item.name}</h3>
                        <span className="ghost-plugin-version">v{item.version}</span>
                      </div>
                      <span className="ghost-plugin-author">por {item.author}</span>
                    </div>
                  </div>

                  <div className="ghost-plugin-badges-row">
                    <span className={`ghost-badge-type type-${item.type}`}>
                      <FontAwesomeIcon icon={getTypeIcon(item.type)} />
                      <span>{getTypeLabel(item.type)}</span>
                    </span>

                    <span className="ghost-badge-tier verified">
                      <FontAwesomeIcon icon={faShieldHalved} /> 🛡️ Verificado
                    </span>
                  </div>

                  <p className="ghost-plugin-description">{item.description}</p>

                  <div className="ghost-plugin-permissions">
                    <span className="perm-label">Capacidades:</span>
                    <div className="perm-tags">
                      {item.permissions.map((perm) => (
                        <span key={perm} className="perm-tag">
                          {perm === 'ui:inject-css' && '🎨 Injeção de CSS / Layout'}
                          {perm === 'ui:widgets' && '🧩 Widgets de Interface'}
                          {perm === 'network' && '🌐 Acesso à Rede'}
                          {perm === 'storage' && '💾 Armazenamento Escopado'}
                          {perm === 'game-sources' && '📦 Fontes de Download'}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="ghost-plugin-card-footer">
                    {isAlreadyInstalled ? (
                      <button className="ghost-btn-installed" disabled>
                        <FontAwesomeIcon icon={faCheckCircle} />
                        <span>Já Instalado</span>
                      </button>
                    ) : (
                      <button
                        className="ghost-btn-primary"
                        onClick={() => {
                          showFeedback(
                            'success',
                            `Instalando ${item.name}... O pacote de demonstração oficial está disponível!`
                          )
                        }}
                      >
                        <FontAwesomeIcon icon={faDownload} />
                        <span>Instalar com 1 Clique</span>
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* TAB 3: DEVELOPER MODE */}
      {activeTab === 'dev' && (
        <div className="ghost-tab-content dev-tab">
          <div className="ghost-dev-header">
            <h2>🛠️ Central do Desenvolvedor de Plugins</h2>
            <p>
              Crie, teste e empacote plugins para a comunidade com facilidade e ferramentas dedicadas.
            </p>
          </div>

          <div className="ghost-dev-actions-row">
            <div className="ghost-dev-action-card">
              <div className="dev-card-icon">
                <FontAwesomeIcon icon={faFolderOpen} />
              </div>
              <h3>Carregar Pasta Descompactada</h3>
              <p>
                Abra a pasta do seu código em desenvolvimento. O Ghost carrega o <code>plugin.json</code>{' '}
                e executa em tempo real, permitindo testes instantâneos.
              </p>
              <button className="ghost-btn-secondary" onClick={handleLoadUnpacked}>
                <FontAwesomeIcon icon={faFolderOpen} />
                <span>Selecionar Pasta de Código</span>
              </button>
            </div>

            <div className="ghost-dev-action-card">
              <div className="dev-card-icon">
                <FontAwesomeIcon icon={faBoxArchive} />
              </div>
              <h3>Empacotar em Formato Oficial .ghost</h3>
              <p>
                Gera o arquivo <code>.ghost</code> final com cálculo de checksum SHA-256 de todos os
                arquivos e validação rigorosa de segurança do GhostShield.
              </p>
              <button className="ghost-btn-primary" onClick={handlePackPlugin}>
                <FontAwesomeIcon icon={faBoxArchive} />
                <span>Empacotar Pasta em .ghost</span>
              </button>
            </div>
          </div>

          <div className="ghost-dev-docs-box">
            <h3>📖 Estrutura Mínima de um Plugin do Ghost</h3>
            <pre>
{`meu-plugin/
├── plugin.json        # Manifesto obrigatório com id, nome, versão e permissões
├── index.js           # Código JavaScript executado na Sandbox GhostShield
├── theme.css          # (Opcional) Estilos CSS injetados para layout, capas e botões
└── icon.png           # (Opcional) Ícone 128x128`}
            </pre>

            <h3>🛡️ Segurança e APIs Disponíveis (`ghost.*`)</h3>
            <pre>
{`// 1. Modificação de Layout, Formato de Capas e Botões
ghost.ui.injectCSS(\`
  .primary { border-radius: 20px !important; box-shadow: 0 0 15px #00ffff !important; }
  .games-grid { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)) !important; }
\`);

// 2. Registro de Fontes de Download (AnkerGames, FitGirl, TorBox API)
ghost.registerSourceProvider({
  id: 'meu-provedor',
  name: 'Meu Provedor de Jogos',
  search: async (query) => [...],
  getSources: async (gameId) => [...]
});

// 3. Rede Segura (Restrito aos domínios listados em allowedDomains)
const res = await ghost.http.fetch('https://api.meusite.com/search?q=' + query);

// 4. Armazenamento Escopado Seguro
await ghost.storage.set('minha_chave', { valor: 123 });`}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

import React, { useState, useEffect } from 'react'

interface CustomStore {
  id: string
  name: string
  icon: string | null
  isVisible?: boolean
}

export default function PersonalizationScreen() {
  const [bgImage, setBgImage] = useState<string | null>(() => {
    return localStorage.getItem('heroic_custom_bg')
  })

  // Lógica funcional de Lojas
  const [stores, setStores] = useState<CustomStore[]>(() => {
    const saved = localStorage.getItem('heroic_custom_stores')
    if (saved) {
      try {
        const parsedStores = JSON.parse(saved) as CustomStore[]
        return parsedStores.map((s) => ({
          ...s,
          isVisible: s.isVisible ?? true
        }))
      } catch (err) {
        console.error('Erro ao ler stores:', err)
      }
    }
    return [
      { id: 'epic', name: 'Epic Games', icon: null, isVisible: true },
      { id: 'gog', name: 'GOG', icon: null, isVisible: true }
    ]
  })

  // ==============================================================
  // ESTADOS DOS TOGGLES DE INTERFACE (GAMEPAD / MOUSE)
  // ==============================================================
  const [hideIconsGamepad, setHideIconsGamepad] = useState<boolean>(() => {
    const saved = localStorage.getItem('heroic_hide_icons_gamepad')
    return saved !== null ? (JSON.parse(saved) as boolean) : true
  })

  const [hideIconsMouse, setHideIconsMouse] = useState<boolean>(() => {
    const saved = localStorage.getItem('heroic_hide_icons_mouse')
    return saved !== null ? (JSON.parse(saved) as boolean) : false
  })

  const [hideSearchSuggestions, setHideSearchSuggestions] = useState<boolean>(() => {
    const saved = localStorage.getItem('heroic_hide_search_suggestions')
    return saved !== null ? (JSON.parse(saved) as boolean) : false
  })

  const [alphabetAlignment, setAlphabetAlignment] = useState<string>(() => {
    return localStorage.getItem('heroic_alphabet_alignment') || 'center'
  })

  // ==============================================================
  // DRAG & DROP PARA ORDENAÇÃO DAS LOJAS
  // ==============================================================
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const updatedStores = [...stores]
    const draggedItem = updatedStores[draggedIndex]
    
    // Rearranja os itens
    updatedStores.splice(draggedIndex, 1)
    updatedStores.splice(index, 0, draggedItem)

    setDraggedIndex(index)
    setStores(updatedStores)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }
  // ==============================================================


  useEffect(() => {
    localStorage.setItem('heroic_custom_stores', JSON.stringify(stores))
    window.dispatchEvent(new Event('customStoresChanged'))
  }, [stores])

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result as string
      setBgImage(base64)
      localStorage.setItem('heroic_custom_bg', base64)
      window.dispatchEvent(new Event('customBgChanged'))
    }
    reader.readAsDataURL(file)
  }

  const handleIconUpload = (
    id: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result as string
      setStores((prev) =>
        prev.map((s) => (s.id === id ? { ...s, icon: base64 } : s))
      )
    }
    reader.readAsDataURL(file)
  }

  const handleNameChange = (id: string, newName: string) => {
    setStores((prev) =>
      prev.map((s) => (s.id === id ? { ...s, name: newName } : s))
    )
  }

  const handleToggleVisibility = (id: string) => {
    setStores((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, isVisible: !(s.isVisible ?? true) } : s
      )
    )
  }

  const handleAddStore = () => {
    const newStore: CustomStore = {
      id: 'store-' + Date.now(),
      name: '',
      icon: null,
      isVisible: true
    }
    setStores((prev) => [...prev, newStore])
  }

  const handleRemoveStore = (id: string) => {
    setStores((prev) => prev.filter((s) => s.id !== id))
  }

  // ==============================================================
  // FUNÇÕES DE DISPARO PARA MUDANÇA DE COMPORTAMENTO
  // ==============================================================
  const handleToggleGamepadIcons = () => {
    const newVal = !hideIconsGamepad
    setHideIconsGamepad(newVal)
    localStorage.setItem('heroic_hide_icons_gamepad', JSON.stringify(newVal))
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleToggleMouseIcons = () => {
    const newVal = !hideIconsMouse
    setHideIconsMouse(newVal)
    localStorage.setItem('heroic_hide_icons_mouse', JSON.stringify(newVal))
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleToggleSearchSuggestions = () => {
    const newVal = !hideSearchSuggestions
    setHideSearchSuggestions(newVal)
    localStorage.setItem('heroic_hide_search_suggestions', JSON.stringify(newVal))
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }

  const handleToggleAlphabetAlignment = (val: string) => {
    setAlphabetAlignment(val)
    localStorage.setItem('heroic_alphabet_alignment', val)
    window.dispatchEvent(new Event('heroicSettingsChanged'))
  }
  // ==============================================================

  // Estilos CSS Inline
  const styles = {
    screen: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      color: '#fff',
      overflow: 'hidden',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      fontFamily: 'sans-serif'
    } as React.CSSProperties,

    backgroundBlur: {
      position: 'absolute',
      inset: 0,
      backgroundImage: bgImage ? `url(${bgImage})` : 'none',
      backgroundColor: bgImage ? 'transparent' : '#121212',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      filter: 'blur(5px) brightness(0.6)',
      zIndex: 0
    } as React.CSSProperties,

    masterContainer: {
      position: 'relative',
      width: '100%',
      height: '100%',
      background: 'transparent',
      zIndex: 2,
      display: 'flex',
      overflow: 'hidden'
    } as React.CSSProperties,

    sectionTitle: {
      fontSize: '11px',
      color: '#8a9bb0',
      textTransform: 'uppercase',
      fontWeight: 'bold',
      letterSpacing: '1px',
      marginBottom: '15px',
      display: 'block',
      flexShrink: 0
    } as React.CSSProperties,

    // =========================================
    // 1. COLUNA ESQUERDA (LOJAS)
    // =========================================
    sidebarLeft: {
      width: '420px',
      height: '100%',
      padding: '30px 0 30px 70px',
      background: 'rgba(30, 34, 40, 0.6)',
      backdropFilter: 'blur(8px)',
      borderRight: '1px solid rgba(255,255,255,0.05)',
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box'
    } as React.CSSProperties,

    storeListContext: {
      flex: '1 1 auto',
      height: 0,
      minHeight: 0,
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      paddingRight: '20px'
    } as React.CSSProperties,

    storeBlockCompact: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      background: 'rgba(0, 0, 0, 0.2)',
      padding: '8px',
      borderRadius: '8px',
      border: '1px solid rgba(255,255,255,0.05)'
    } as React.CSSProperties,

    dragHandle: {
      cursor: 'grab',
      color: '#8a9bb0',
      fontSize: '18px',
      padding: '0 5px',
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center'
    } as React.CSSProperties,

    squareIcon: {
      width: '32px',
      height: '32px',
      background: 'rgba(255, 255, 255, 0.1)',
      borderRadius: '4px',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
      color: '#fff'
    } as React.CSSProperties,

    textInputCompact: {
      flex: 1,
      minWidth: 0,
      height: '32px',
      background: 'rgba(0, 0, 0, 0.3)',
      border: '1px solid #4CAF50',
      borderRadius: '4px',
      color: '#fff',
      padding: '0 8px',
      fontSize: '13px',
      outline: 'none',
      boxSizing: 'border-box'
    } as React.CSSProperties,

    actionBtn: {
      width: '32px',
      height: '32px',
      background: 'rgba(255, 255, 255, 0.1)',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      flexShrink: 0,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      color: '#fff',
      fontSize: '14px'
    } as React.CSSProperties,

    deleteBtnCompact: {
      width: '32px',
      height: '32px',
      background: '#c62828',
      color: '#fff',
      border: 'none',
      borderRadius: '4px',
      fontWeight: 'bold',
      cursor: 'pointer',
      flexShrink: 0,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    } as React.CSSProperties,

    addStoreBtn: {
      width: '100%',
      height: '45px',
      background: 'rgba(0, 0, 0, 0.4)',
      color: '#fff',
      border: '1px solid rgba(255,255,255,0.05)',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: 'bold',
      cursor: 'pointer',
      marginTop: '20px',
      flexShrink: 0
    } as React.CSSProperties,

    // =========================================
    // 2. COLUNA CENTRAL (PREVIEW)
    // =========================================
    centerPreview: {
      flex: 1,
      height: '100%',
      background: 'rgba(20, 24, 30, 0.4)',
      backdropFilter: 'blur(4px)',
      padding: '0px',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    } as React.CSSProperties,

    previewArea: {
      flex: 1,
      border: '2px dashed rgba(255, 255, 255, 0.2)',
      borderRadius: '0px',
      borderTop: 'none',
      borderBottom: 'none',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      color: '#8a9bb0',
      fontSize: '18px',
      fontWeight: 'bold',
      textTransform: 'uppercase',
      letterSpacing: '2px',
      backgroundColor: 'rgba(0,0,0,0.2)'
    } as React.CSSProperties,

    // =========================================
    // 3. COLUNA DIREITA (BACKGROUND E CONFIGS)
    // =========================================
    sidebarRight: {
      width: '350px',
      height: '100%',
      background: 'rgba(30, 34, 40, 0.6)',
      backdropFilter: 'blur(8px)',
      borderLeft: '1px solid rgba(255,255,255,0.05)',
      padding: '30px',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto'
    } as React.CSSProperties,

    dropZone: {
      width: '100%',
      border: '2px dashed rgba(255, 255, 255, 0.2)',
      borderRadius: '12px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '15px',
      padding: '40px 20px',
      boxSizing: 'border-box'
    } as React.CSSProperties,

    dropZoneText: {
      fontSize: '16px',
      color: '#8a9bb0',
      textAlign: 'center'
    } as React.CSSProperties,

    searchFileBtn: {
      background: 'rgba(255, 255, 255, 0.15)',
      color: '#fff',
      border: 'none',
      borderRadius: '6px',
      padding: '10px 25px',
      fontSize: '14px',
      fontWeight: 'bold',
      cursor: 'pointer'
    } as React.CSSProperties,

    recommendationText: {
      fontSize: '12px',
      color: '#8a9bb0',
      textAlign: 'center',
      marginTop: '20px'
    } as React.CSSProperties,

    // Estilos dos Novos Toggles
    toggleRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: 'rgba(0, 0, 0, 0.2)',
      padding: '12px 15px',
      borderRadius: '8px',
      border: '1px solid rgba(255,255,255,0.05)',
      cursor: 'pointer',
      transition: 'background 0.2s'
    } as React.CSSProperties,

    toggleTextGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px'
    } as React.CSSProperties,

    toggleTitle: {
      fontSize: '13px',
      fontWeight: 'bold',
      color: '#fff'
    } as React.CSSProperties,

    toggleSub: {
      fontSize: '11px',
      color: '#8a9bb0'
    } as React.CSSProperties,

    checkbox: {
      width: '18px',
      height: '18px',
      accentColor: '#4CAF50',
      cursor: 'pointer',
      margin: 0
    } as React.CSSProperties
  }

  return (
    <div style={styles.screen}>
      <div style={styles.backgroundBlur} />

      <div style={styles.masterContainer}>
        {/* ========================================= */}
        {/* 1. SIDEBAR ESQUERDA (LOJAS)               */}
        {/* ========================================= */}
        <div style={styles.sidebarLeft}>
          <div style={{ paddingRight: '30px' }}>
            <span style={styles.sectionTitle}>GERENCIAMENTO DE LOJAS</span>
          </div>

          <div style={styles.storeListContext}>
            {stores.map((store, index) => {
              const isStoreVisible = store.isVisible ?? true
              const isDragged = draggedIndex === index

              return (
                <div
                  key={store.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  style={{
                    ...styles.storeBlockCompact,
                    opacity: isDragged ? 0.35 : (isStoreVisible ? 1 : 0.5),
                    transform: isDragged ? 'scale(0.98)' : 'none',
                    border: isDragged ? '1px dashed #00ffff' : '1px solid rgba(255,255,255,0.05)',
                    cursor: 'grab',
                    transition: 'transform 0.1s ease, border 0.1s ease'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isStoreVisible}
                    onChange={() => handleToggleVisibility(store.id)}
                    title="Mostrar/Esconder Loja"
                    style={{
                      cursor: 'pointer',
                      width: '16px',
                      height: '16px',
                      margin: 0,
                      accentColor: '#4CAF50',
                      flexShrink: 0
                    }}
                  />

                  <div style={styles.dragHandle}>≡</div>

                  <div style={styles.squareIcon}>
                    {store.icon ? (
                      <img
                        src={store.icon}
                        alt=""
                        style={{
                          width: '20px',
                          height: '20px',
                          objectFit: 'contain'
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: '12px', color: '#5c6b7f' }}>
                        ?
                      </span>
                    )}
                  </div>

                  <input
                    type="text"
                    value={store.name}
                    placeholder="Nome da Loja"
                    onChange={(e) => handleNameChange(store.id, e.target.value)}
                    style={styles.textInputCompact}
                  />

                  <label style={styles.actionBtn} title="Adicionar Ícone">
                    <input
                      type="file"
                      accept=".png"
                      onChange={(e) => handleIconUpload(store.id, e)}
                      style={{ display: 'none' }}
                    />
                    📷
                  </label>

                  <button
                    style={styles.deleteBtnCompact}
                    onClick={() => handleRemoveStore(store.id)}
                    title="Deletar Loja"
                  >
                    X
                  </button>
                </div>
              )
            })}
          </div>

          <div style={{ paddingRight: '30px' }}>
            <button style={styles.addStoreBtn} onClick={handleAddStore}>
              + Adicionar Loja
            </button>
          </div>
        </div>

        {/* ========================================= */}
        {/* 2. ÁREA CENTRAL (PREVIEW DE PERSONALIZAÇÃO) */}
        {/* ========================================= */}
        <div style={styles.centerPreview}>
          <div style={styles.previewArea}>Área de Preview</div>
        </div>

        {/* ========================================= */}
        {/* 3. SIDEBAR DIREITA (CONFIGS E BACKGROUND) */}
        {/* ========================================= */}
        <div style={styles.sidebarRight}>
          {/* SEÇÃO 1: BACKGROUND */}
          <span style={styles.sectionTitle}>PERSONALIZAÇÃO DO BACKGROUND</span>
          <div style={styles.dropZone}>
            <span style={styles.dropZoneText}>
              Arraste e solte o Background
            </span>
            <span style={{ fontSize: '14px', color: '#8a9bb0' }}>ou</span>

            <label style={styles.searchFileBtn}>
              <input
                type="file"
                accept="image/*"
                onChange={handleBgUpload}
                style={{ display: 'none' }}
              />
              Pesquisar Arquivo
            </label>

            <p style={styles.recommendationText}>
              Nós recomendamos usar uma imagem com a resolução de 1860x950 para
              um melhor preenchimento.
            </p>
          </div>

          {/* SEÇÃO 2: COMPORTAMENTO DA INTERFACE */}
          <div style={{ marginTop: '40px' }}>
            <span style={styles.sectionTitle}>
              COMPORTAMENTO DA GRADE DE JOGOS
            </span>

            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              {/* Opção Gamepad */}
              <label
                style={styles.toggleRow}
                onMouseOver={(e) =>
                  (e.currentTarget.style.background =
                    'rgba(255, 255, 255, 0.05)')
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.background = 'rgba(0, 0, 0, 0.2)')
                }
              >
                <div style={styles.toggleTextGroup}>
                  <span style={styles.toggleTitle}>
                    Ocultar ícones no Gamepad
                  </span>
                  <span style={styles.toggleSub}>
                    Deixa a interface limpa usando controle
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={hideIconsGamepad}
                  onChange={handleToggleGamepadIcons}
                  style={styles.checkbox}
                />
              </label>

              {/* Opção Mouse */}
              <label
                style={styles.toggleRow}
                onMouseOver={(e) =>
                  (e.currentTarget.style.background =
                    'rgba(255, 255, 255, 0.05)')
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.background = 'rgba(0, 0, 0, 0.2)')
                }
              >
                <div style={styles.toggleTextGroup}>
                  <span style={styles.toggleTitle}>
                    Ocultar ícones no Mouse
                  </span>
                  <span style={styles.toggleSub}>
                    Deixa a interface limpa usando o mouse
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={hideIconsMouse}
                  onChange={handleToggleMouseIcons}
                  style={styles.checkbox}
                />
              </label>

              {/* Opção Sugestões de Busca */}
              <label
                style={styles.toggleRow}
                onMouseOver={(e) =>
                  (e.currentTarget.style.background =
                    'rgba(255, 255, 255, 0.05)')
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.background = 'rgba(0, 0, 0, 0.2)')
                }
              >
                <div style={styles.toggleTextGroup}>
                  <span style={styles.toggleTitle}>
                    Ocultar sugestões na busca
                  </span>
                  <span style={styles.toggleSub}>
                    Deixa a barra de busca limpa ao pesquisar por jogos
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={hideSearchSuggestions}
                  onChange={handleToggleSearchSuggestions}
                  style={styles.checkbox}
                />
              </label>

              {/* Opção Alinhamento do Alfabeto */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  background: 'rgba(0, 0, 0, 0.2)',
                  padding: '12px 15px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}
              >
                <div style={styles.toggleTextGroup}>
                  <span style={styles.toggleTitle}>
                    Alinhamento do Filtro de Alfabeto
                  </span>
                  <span style={styles.toggleSub}>
                    Escolha como o filtro de A-Z é posicionado na tela
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    background: 'rgba(0, 0, 0, 0.3)',
                    borderRadius: '6px',
                    padding: '3px',
                    gap: '4px',
                    marginTop: '4px'
                  }}
                >
                  {(
                    [
                      { id: 'left', label: 'Esquerda' },
                      { id: 'center', label: 'Centro' },
                      { id: 'right', label: 'Direita' },
                      { id: 'fill', label: 'Preencher' }
                    ] as const
                  ).map((opt) => {
                    const isSelected = alphabetAlignment === opt.id
                    return (
                      <button
                        key={opt.id}
                        onClick={() => handleToggleAlphabetAlignment(opt.id)}
                        style={{
                          flex: 1,
                          height: '28px',
                          background: isSelected ? '#4CAF50' : 'transparent',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          transition: 'background 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

import TextInputWithIconField from '../TextInputWithIconField'
import TextInputField from '../TextInputField'
import Backspace from '@mui/icons-material/Backspace'
import Folder from '@mui/icons-material/Folder'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFolder, faFolderOpen, faTrashAlt } from '@fortawesome/free-solid-svg-icons'
import { ReactNode, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { FileFilter } from 'electron'
import { openGameFolder } from 'frontend/utils/pathUtils'

interface Props {
  htmlId: string
  // Whether the selected item should be a directory or a file
  type: 'file' | 'directory'
  // Called when a new path is selected. Note that this function also has to
  // store the new path (for example with a `useState`)
  onPathChange: (path: string) => void
  // The path to display
  path: string
  // The "placeholder" attribute of the <input> element
  placeholder?: string
  // The window title of the file/directory chooser
  pathDialogTitle: string
  pathDialogDefaultPath?: string
  pathDialogFilters?: FileFilter[]
  // Dictates if the user can manually edit the path
  canEditPath?: boolean
  // Disables the Backspace/Delete button, always opening the file picker
  // when the user clicks the icon
  noDeleteButton?: boolean
  label?: string
  afterInput?: ReactNode
  disabled?: boolean
  // Abre o diretório do jogo no Explorador de Arquivos ao clicar no ícone de pasta
  openFolderOnClick?: boolean
  onFolderClick?: (path: string) => void
}

const PathSelectionBox = ({
  onPathChange,
  path,
  placeholder,
  pathDialogTitle,
  pathDialogDefaultPath,
  pathDialogFilters,
  type,
  canEditPath = true,
  noDeleteButton = false,
  htmlId,
  label,
  afterInput,
  disabled = false,
  openFolderOnClick = false,
  onFolderClick
}: Props) => {
  const { t } = useTranslation()
  // We only send `onPathChange` updates when the user is done editing, so we
  // have to store the partially-edited path *somewhere*
  const [tmpPath, setTmpPath] = useState(path)

  useEffect(() => setTmpPath(path), [path])

  const handleOpenFolder = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const targetPath = tmpPath || path
    if (onFolderClick) {
      onFolderClick(targetPath)
    } else {
      openGameFolder(targetPath, type === 'file')
    }
  }

  const handleBrowse = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    const effectiveDefaultPath =
      tmpPath || path || pathDialogDefaultPath || undefined

    window.api
      .openDialog({
        buttonLabel: t('box.choose'),
        properties: type === 'directory' ? ['openDirectory'] : ['openFile'],
        title: pathDialogTitle,
        filters: pathDialogFilters,
        defaultPath: effectiveDefaultPath
      })
      .then((selectedPath) => {
        if (selectedPath) {
          onPathChange(selectedPath)
          setTmpPath(selectedPath)
        }
      })
  }

  function handleIconClick() {
    if (!noDeleteButton && path) {
      // "Backspace" icon was pressed
      onPathChange('')
      setTmpPath(path)
      return
    }

    // Determine the most accurate defaultPath (current input path > prop path > prop defaultPath)
    const effectiveDefaultPath =
      tmpPath || path || pathDialogDefaultPath || undefined

    // "Folder" icon was pressed
    window.api
      .openDialog({
        buttonLabel: t('box.choose'),
        properties: type === 'directory' ? ['openDirectory'] : ['openFile'],
        title: pathDialogTitle,
        filters: pathDialogFilters,
        defaultPath: effectiveDefaultPath
      })
      .then((selectedPath) => {
        if (selectedPath) {
          onPathChange(selectedPath)
          setTmpPath(selectedPath)
        }
      })
  }

  // Modo aprimorado Cyber Neon com suporte a abrir diretório diretamente
  if (openFolderOnClick || onFolderClick) {
    const hasPath = Boolean(tmpPath || path)

    return (
      <TextInputField
        value={tmpPath}
        onChange={(newVal) => setTmpPath(newVal)}
        onBlur={(e) => onPathChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onPathChange(tmpPath)
          }
        }}
        placeholder={placeholder}
        disabled={!canEditPath || disabled}
        htmlId={htmlId}
        label={label}
        afterInput={afterInput}
        style={{
          paddingRight: hasPath ? (!noDeleteButton ? '112px' : '82px') : '48px'
        }}
        inputIcon={
          <div
            className="pathSelectionIcons"
            style={{
              gridArea: 'input',
              alignSelf: 'center',
              justifySelf: 'flex-end',
              marginInlineEnd: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              zIndex: 2
            }}
          >
            {/* Botão Abrir Diretório no Explorador de Arquivos */}
            {hasPath && (
              <button
                type="button"
                className="pathBoxBtn openFolderBtn"
                title={t(
                  'box.open_folder',
                  'Abrir diretório da pasta do jogo no Explorador de Arquivos'
                )}
                aria-label={t(
                  'box.open_folder',
                  'Abrir diretório da pasta do jogo no Explorador de Arquivos'
                )}
                onClick={handleOpenFolder}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  boxShadow: 'none',
                  color: '#00ffff',
                  cursor: 'pointer',
                  padding: '2px 4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  filter: 'drop-shadow(0 0 4px rgba(0, 255, 255, 0.45))'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.18)'
                  e.currentTarget.style.filter =
                    'drop-shadow(0 0 8px rgba(0, 255, 255, 0.85))'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)'
                  e.currentTarget.style.filter =
                    'drop-shadow(0 0 4px rgba(0, 255, 255, 0.45))'
                }}
              >
                <FontAwesomeIcon icon={faFolder} style={{ fontSize: '16px' }} />
              </button>
            )}

            {/* Botão Selecionar/Procurar Executável */}
            <button
              type="button"
              className="pathBoxBtn browseBtn"
              title={
                pathDialogTitle || t('box.choose', 'Selecionar outro executável...')
              }
              aria-label={
                pathDialogTitle || t('box.choose', 'Selecionar outro executável...')
              }
              onClick={handleBrowse}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                boxShadow: 'none',
                color: 'rgba(255, 255, 255, 0.6)',
                cursor: 'pointer',
                padding: '2px 4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#00ffff'
                e.currentTarget.style.transform = 'scale(1.18)'
                e.currentTarget.style.filter =
                  'drop-shadow(0 0 8px rgba(0, 255, 255, 0.85))'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)'
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.filter = 'none'
              }}
            >
              <FontAwesomeIcon
                icon={faFolderOpen}
                style={{ fontSize: '16px' }}
              />
            </button>

            {/* Botão Limpar (caso noDeleteButton seja falso e exista caminho) */}
            {!noDeleteButton && hasPath && (
              <button
                type="button"
                className="pathBoxBtn clearBtn"
                title={t('box.clear', 'Limpar')}
                aria-label={t('box.clear', 'Limpar')}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onPathChange('')
                  setTmpPath('')
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  boxShadow: 'none',
                  color: 'rgba(255, 23, 68, 0.8)',
                  cursor: 'pointer',
                  padding: '2px 4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#ff1744'
                  e.currentTarget.style.transform = 'scale(1.18)'
                  e.currentTarget.style.filter =
                    'drop-shadow(0 0 8px rgba(255, 23, 68, 0.85))'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'rgba(255, 23, 68, 0.8)'
                  e.currentTarget.style.transform = 'scale(1)'
                  e.currentTarget.style.filter = 'none'
                }}
              >
                <FontAwesomeIcon
                  icon={faTrashAlt}
                  style={{ fontSize: '15px' }}
                />
              </button>
            )}
          </div>
        }
      />
    )
  }

  return (
    <TextInputWithIconField
      value={tmpPath}
      onChange={(newVal) => setTmpPath(newVal)}
      onBlur={(e) => onPathChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          onPathChange(tmpPath)
        }
      }}
      onIconClick={handleIconClick}
      placeholder={placeholder}
      icon={!noDeleteButton && path ? <Backspace /> : <Folder />}
      disabled={!canEditPath || disabled}
      htmlId={htmlId}
      label={label}
      afterInput={afterInput}
    />
  )
}

export default PathSelectionBox

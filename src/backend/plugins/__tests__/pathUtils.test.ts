import { getFolderFromPath, openGameFolder } from '../../../frontend/utils/pathUtils'

describe('pathUtils', () => {
  describe('getFolderFromPath', () => {
    it('extrai o diretório de um executável no padrão do Windows com espaços', () => {
      const exe =
        'N:\\Alazter Games\\Warhammer 40,000- Space Marine 2\\Warhammer 40,000 Space Marine 2\\Warhammer 40000 Space Marine 2.exe'
      const folder = getFolderFromPath(exe)
      expect(folder).toBe(
        'N:\\Alazter Games\\Warhammer 40,000- Space Marine 2\\Warhammer 40,000 Space Marine 2'
      )
    })

    it('remove aspas envolventes de caminhos', () => {
      const quoted = '"C:\\Games\\Cyberpunk 2077\\bin\\x64\\Cyberpunk2077.exe"'
      expect(getFolderFromPath(quoted)).toBe(
        'C:\\Games\\Cyberpunk 2077\\bin\\x64'
      )
    })

    it('preserva diretório quando já for uma pasta', () => {
      const dir = 'D:\\Jogos\\Stardew Valley'
      expect(getFolderFromPath(dir)).toBe('D:\\Jogos\\Stardew Valley')
    })

    it('remove barras finais preservando o diretório', () => {
      const dirWithSlash = 'D:\\Jogos\\Graveyard Keeper\\'
      expect(getFolderFromPath(dirWithSlash)).toBe('D:\\Jogos\\Graveyard Keeper')
    })

    it('preserva raiz de drive', () => {
      expect(getFolderFromPath('C:\\')).toBe('C:\\')
      expect(getFolderFromPath('D:/')).toBe('D:/')
    })

    it('lida com extensões linux (.sh, .bin, .appimage, .x86_64)', () => {
      expect(
        getFolderFromPath('/home/deck/Games/Indie/start.sh')
      ).toBe('/home/deck/Games/Indie')
      expect(
        getFolderFromPath('/home/deck/Games/Heroic.AppImage')
      ).toBe('/home/deck/Games')
      expect(
        getFolderFromPath('/opt/game/runner.x86_64')
      ).toBe('/opt/game')
    })

    it('suporta isKnownFile para forçar extração de diretório pai', () => {
      const custom = 'E:\\Games\\Custom\\game_launcher'
      expect(getFolderFromPath(custom, true)).toBe('E:\\Games\\Custom')
    })

    it('retorna string vazia para valores nulos ou vazios', () => {
      expect(getFolderFromPath('')).toBe('')
      expect(getFolderFromPath(undefined)).toBe('')
    })
  })

  describe('openGameFolder', () => {
    const originalWindow = global.window

    beforeEach(() => {
      global.window = {
        api: {
          openFolder: jest.fn(),
          showItemInFolder: jest.fn()
        } as any
      } as any
    })

    afterEach(() => {
      global.window = originalWindow
    })

    it('chama window.api.openFolder com o diretório pai do executável', () => {
      const exe =
        'N:\\Alazter Games\\Warhammer 40,000- Space Marine 2\\Warhammer 40,000 Space Marine 2\\Warhammer 40000 Space Marine 2.exe'
      openGameFolder(exe)

      // @ts-ignore
      expect(global.window.api.openFolder).toHaveBeenCalledWith(
        'N:\\Alazter Games\\Warhammer 40,000- Space Marine 2\\Warhammer 40,000 Space Marine 2'
      )
    })

    it('não dispara nenhuma chamada se targetPath for vazio', () => {
      openGameFolder('')
      // @ts-ignore
      expect(global.window.api.openFolder).not.toHaveBeenCalled()
    })
  })
})

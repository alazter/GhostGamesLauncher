import {
  buildMediaDestinationPath,
  getCinemaDownloadDirectories,
  setCinemaDownloadDirectories,
  SaveMediaPayload
} from '../cinemaDownloader'

describe('Cinema Downloader & Local Library Manager', () => {
  it('deve construir caminhos canônicos organizados para filmes', () => {
    const payload: SaveMediaPayload = {
      streamUrl: 'http://127.0.0.1:11470/abc/0',
      type: 'movie',
      title: 'Kimetsu no Yaiba: Mugen Train',
      year: '2020'
    }

    const { folderPath, filePath } = buildMediaDestinationPath('D:\\Filmes', payload)
    expect(folderPath).toBe('D:\\Filmes\\Kimetsu no Yaiba Mugen Train (2020)')
    expect(filePath).toBe('D:\\Filmes\\Kimetsu no Yaiba Mugen Train (2020)\\Kimetsu no Yaiba Mugen Train (2020).mkv')
  })

  it('deve construir caminhos canônicos organizados para episódios de séries e animes', () => {
    const payload: SaveMediaPayload = {
      streamUrl: 'http://127.0.0.1:11470/xyz/0',
      type: 'anime',
      title: 'Demon Slayer: Kimetsu no Yaiba',
      season: 3,
      episode: 11,
      episodeTitle: 'No Matter How Many Lives'
    }

    const { folderPath, filePath } = buildMediaDestinationPath('T:\\Alazter Multimídia\\Animes', payload)
    expect(folderPath).toBe('T:\\Alazter Multimídia\\Animes\\Demon Slayer Kimetsu no Yaiba\\Temporada 3')
    expect(filePath).toBe(
      'T:\\Alazter Multimídia\\Animes\\Demon Slayer Kimetsu no Yaiba\\Temporada 3\\Demon Slayer Kimetsu no Yaiba - S03E11 - No Matter How Many Lives.mkv'
    )
  })

  it('deve gerenciar diretórios de salvamento do Cinema com persistência', () => {
    const updated = setCinemaDownloadDirectories({
      moviesDir: 'D:\\Filmes',
      seriesDir: 'D:\\Séries',
      animesDir: 'T:\\Animes'
    })

    expect(updated.moviesDir).toBe('D:\\Filmes')
    expect(updated.seriesDir).toBe('D:\\Séries')
    expect(updated.animesDir).toBe('T:\\Animes')

    const reloaded = getCinemaDownloadDirectories()
    expect(reloaded.moviesDir).toBe('D:\\Filmes')
  })
})

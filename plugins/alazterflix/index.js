ghost.log('Iniciando Alazterflix Plugin (Jellyfin + Stremio)...')

const DEFAULT_ADDONS = [
  {
    id: 'org.stremio.cinemeta',
    name: 'Cinemeta (Catálogo Oficial)',
    version: '3.0.13',
    description:
      'Catálogo oficial do Stremio com sinopses, capas HD, gêneros e avaliações IMDb.',
    icon: 'https://v3-cinemeta.strem.io/favicon.ico',
    manifestUrl: 'https://v3-cinemeta.strem.io/manifest.json',
    types: ['movie', 'series'],
    resources: ['catalog', 'meta'],
    catalogs: [
      {
        type: 'movie',
        id: 'top',
        name: 'Populares',
        extra: [
          { name: 'genre', options: ['Action', 'Comedy', 'Sci-Fi'] },
          { name: 'search' },
          { name: 'skip' }
        ]
      },
      {
        type: 'movie',
        id: 'year',
        name: 'Ano',
        extra: [
          { name: 'genre', isRequired: true, options: ['2026', '2025', '2024'] },
          { name: 'skip' }
        ]
      },
      {
        type: 'series',
        id: 'top',
        name: 'Séries Populares',
        extra: [
          { name: 'genre', options: ['Action', 'Drama', 'Sci-Fi'] },
          { name: 'search' },
          { name: 'skip' }
        ]
      }
    ],
    isEnabled: true
  },
  {
    id: 'org.stremio.opensubtitlesv3',
    name: 'OpenSubtitles v3 (Oficial)',
    version: '1.0.0',
    description:
      'Legendas oficiais automáticas em Português (PT-BR / PT) e dezenas de idiomas para filmes e episódios de séries.',
    icon: 'https://opensubtitles-v3.strem.io/logo.png',
    manifestUrl: 'https://opensubtitles-v3.strem.io/manifest.json',
    types: ['movie', 'series'],
    resources: ['subtitles'],
    isEnabled: true
  }
]

// Release cleanup patterns for media filenames
const RELEASE_TAGS_REGEX =
  /\b(2160p|1080p|720p|480p|576p|4k|uhd|bluray|blu-ray|bdrip|brrip|web-dl|webrip|web|hdtv|hdrip|dvdrip|dvd|remux|x264|x265|h264|h265|hevc|avc|aac|ac3|dts|ddp5\.1|ddp|truehd|atmos|dual|dublado|legendado|multi|yts|rarbg|psa|eztv|evo|fg|repack|proper|unrated|extended|directors\.cut|remux|memoriadatv|clubehd|bludv|lapumiafilmes|filmesbd|fimesbd|wolverdon|comandotorrents|thepiratefilmes|menor|mini|medio|maior|ups\d{3,4}p|upsai\d{3,4}p|fullhd|hd|\d{3,4}p|bd\d{3,4}p|wd\d{3,4}p|trialbd\d{3,4}p|tetrabd\d{3,4}p|hexabd\d{3,4}p|shoutbd\d{3,4}p|trial|tetra|hexa|shout|sf|rk|por|forced|open\s*matte|imax|totti9|cmrg|fsnguild|erai-raws|punch|rich_jc|bluray1080p|dl|ch|andre\s*tpf|tpf|luan\s*harper|luanharper)\b/gi

function cleanMovieTitleAndYear(fileName) {
  let raw = fileName.replace(/\.[^/.]+$/, '')
  let year = undefined
  const fourDigitMatch = raw.match(/\b(19\d{2}|20\d{2})\b/)
  if (fourDigitMatch) {
    year = parseInt(fourDigitMatch[1], 10)
  } else {
    const twoDigitMatch = raw.match(/[._\s]([89]\d)[._\s]/)
    if (twoDigitMatch) {
      year = 1900 + parseInt(twoDigitMatch[1], 10)
    }
  }

  let clean = raw.replace(
    /\b(?:com|net|org|lapumiafilmes|filmesbd|fimesbd|memoriadatv|clubehd|bludv|wolverdon|comandotorrents|thepiratefilmes)\b/gi,
    ' '
  )
  clean = clean.replace(/[._\-]/g, ' ')
  // Separa números colados em palavras (ex: Blade2 -> Blade 2, Shrek3 -> Shrek 3, Policia7 -> Policia 7)
  clean = clean.replace(/([a-zA-Z]{3,})(\d{1,2})\b/g, '$1 $2')

  clean = clean.replace(RELEASE_TAGS_REGEX, ' ')
  if (year) {
    clean = clean.replace(new RegExp(`\\b${year}\\b`, 'g'), ' ')
    const twoDigitYear = String(year).slice(-2)
    clean = clean.replace(new RegExp(`\\b${twoDigitYear}\\b`, 'g'), ' ')
  }
  clean = clean.replace(/\[.*?\]|\(.*?\)/g, ' ')
  clean = clean.replace(/\s+/g, ' ').trim()

  const altQueries = []
  const lower = clean.toLowerCase()

  // Mapeamento canônico Jellyfin de Sagas de Filmes
  if (/\bbad boys 2\b/i.test(lower)) altQueries.push('Bad Boys II')
  else if (/\bbad boys para sempre\b/i.test(lower))
    altQueries.push('Bad Boys for Life')
  else if (/\bbad boys 4\b/i.test(lower))
    altQueries.push('Bad Boys: Ride or Die')
  else if (/\bos bad boys\b/i.test(lower) || /\bbad boys\b/i.test(lower))
    altQueries.push('Bad Boys')

  if (/\bblade 2\b/i.test(lower)) altQueries.push('Blade II')
  else if (/\bblade 3\b/i.test(lower)) altQueries.push('Blade: Trinity')
  else if (/\bblade\b/i.test(lower)) altQueries.push('Blade')

  if (/\bde volta para o futuro 2\b/i.test(lower))
    altQueries.push('Back to the Future Part II')
  else if (/\bde volta para o futuro 3\b/i.test(lower))
    altQueries.push('Back to the Future Part III')
  else if (/\bde volta para o futuro\b/i.test(lower))
    altQueries.push('Back to the Future')

  if (/\bshrek 2\b/i.test(lower)) altQueries.push('Shrek 2')
  else if (/\bshrek 3\b/i.test(lower)) altQueries.push('Shrek the Third')
  else if (/\bshrek 4\b/i.test(lower)) altQueries.push('Shrek Forever After')
  else if (/\bshrek\b/i.test(lower)) altQueries.push('Shrek')

  if (/\bhomens de preto 2\b/i.test(lower)) altQueries.push('Men in Black II')
  else if (/\bhomens de preto 3\b/i.test(lower))
    altQueries.push('Men in Black 3')
  else if (/\bhomens de preto\b/i.test(lower)) altQueries.push('Men in Black')

  if (/\bjohn wick 2\b/i.test(lower) || /\bjwchapter\s*2\b/i.test(lower))
    altQueries.push('John Wick: Chapter 2')
  else if (/\bjohn wick 3\b/i.test(lower))
    altQueries.push('John Wick: Chapter 3 - Parabellum')
  else if (/\bjohn wick 4\b/i.test(lower))
    altQueries.push('John Wick: Chapter 4')
  else if (/\bjhonw\b/i.test(lower) || /\bjohn wick\b/i.test(lower))
    altQueries.push('John Wick')

  if (
    /\bm4trix\b/i.test(lower) ||
    (lower.includes('matrix') &&
      !lower.includes('reloaded') &&
      !lower.includes('revolutions'))
  )
    altQueries.push('The Matrix')
  if (lower.includes('matrix reloaded')) altQueries.push('The Matrix Reloaded')
  if (lower.includes('matrix revolutions'))
    altQueries.push('The Matrix Revolutions')

  if (/\btirapesada 2\b/i.test(lower) || /\bum tira da pesada 2\b/i.test(lower))
    altQueries.push('Beverly Hills Cop II')
  else if (
    /\btirapesada 3\b/i.test(lower) ||
    /\bum tira da pesada 3\b/i.test(lower)
  )
    altQueries.push('Beverly Hills Cop III')
  else if (
    /\btirapesada 4\b/i.test(lower) ||
    /\bum tira da pesada 4\b/i.test(lower)
  )
    altQueries.push('Beverly Hills Cop: Axel F')
  else if (
    /\btirapesada\b/i.test(lower) ||
    /\bum tira da pesada\b/i.test(lower)
  )
    altQueries.push('Beverly Hills Cop')

  if (
    /\btodomundoempanico 2\b/i.test(lower) ||
    /\btodo mundo em p\w+ 2\b/i.test(lower)
  )
    altQueries.push('Scary Movie 2')
  else if (
    /\btodomundoempanico 3\b/i.test(lower) ||
    /\btodo mundo em p\w+ 3\b/i.test(lower)
  )
    altQueries.push('Scary Movie 3')
  else if (
    /\btodomundoempanico 4\b/i.test(lower) ||
    /\btodo mundo em p\w+ 4\b/i.test(lower)
  )
    altQueries.push('Scary Movie 4')
  else if (
    /\btodomundoempanico 5\b/i.test(lower) ||
    /\btodo mundo em p\w+ 5\b/i.test(lower)
  )
    altQueries.push('Scary Movie 5')
  else if (
    /\btodomundoempanico\b/i.test(lower) ||
    /\btodo mundo em p\w+\b/i.test(lower) ||
    /\bscary movie\b/i.test(lower)
  )
    altQueries.push('Scary Movie')

  if (/\bduro de matar 2\b/i.test(lower) || /\bduromatar 2\b/i.test(lower))
    altQueries.push('Die Hard 2')
  else if (
    /\bduro de matar 3\b/i.test(lower) ||
    /\bduromatar 3\b/i.test(lower) ||
    /\bduromatar3\b/i.test(lower)
  )
    altQueries.push('Die Hard with a Vengeance')
  else if (/\bduro de matar\b/i.test(lower) || /\bduromatar\b/i.test(lower))
    altQueries.push('Die Hard')

  if (/\bcorradapoliciaserie\b/i.test(lower) || /\bpolice squad\b/i.test(lower))
    altQueries.push('Police Squad!')
  else if (
    /\bcorradapolicia 2\b/i.test(lower) ||
    /\bcorra que a policia 2\b/i.test(lower)
  )
    altQueries.push('The Naked Gun 2½: The Smell of Fear')
  else if (
    /\bcorradapolicia 3\b/i.test(lower) ||
    /\bcorra que a policia 3\b/i.test(lower)
  )
    altQueries.push('Naked Gun 33⅓: The Final Insult')
  else if (
    /\bcorradapolicia\b/i.test(lower) ||
    /\bcorra que a policia\b/i.test(lower)
  )
    altQueries.push('The Naked Gun: From the Files of Police Squad!')

  if (/\bpolicia 2\b/i.test(lower) || /\bpolice academy 2\b/i.test(lower))
    altQueries.push('Police Academy 2: Their First Assignment')
  else if (/\bpolicia 3\b/i.test(lower) || /\bpolice academy 3\b/i.test(lower))
    altQueries.push('Police Academy 3: Back in Training')
  else if (/\bpolicia 4\b/i.test(lower) || /\bpolice academy 4\b/i.test(lower))
    altQueries.push('Police Academy 4: Citizens on Patrol')
  else if (/\bpolicia 5\b/i.test(lower) || /\bpolice academy 5\b/i.test(lower))
    altQueries.push('Police Academy 5: Assignment: Miami Beach')
  else if (/\bpolicia 6\b/i.test(lower) || /\bpolice academy 6\b/i.test(lower))
    altQueries.push('Police Academy 6: City Under Siege')
  else if (/\bpolicia 7\b/i.test(lower) || /\bpolice academy 7\b/i.test(lower))
    altQueries.push('Police Academy: Mission to Moscow')
  else if (
    /\bloucadepolicia\b/i.test(lower) ||
    /\bloucademia de policia\b/i.test(lower) ||
    /\bpolice academy\b/i.test(lower)
  )
    altQueries.push('Police Academy')

  if (
    /\brh 1\b/i.test(lower) ||
    /\brh1\b/i.test(lower) ||
    /\ba hora do rush\b/i.test(lower)
  )
    altQueries.push('Rush Hour')
  if (
    /\brh 2\b/i.test(lower) ||
    /\brh2\b/i.test(lower) ||
    /\ba hora do rush 2\b/i.test(lower)
  )
    altQueries.push('Rush Hour 2')
  if (
    /\brh 3\b/i.test(lower) ||
    /\brh3\b/i.test(lower) ||
    /\ba hora do rush 3\b/i.test(lower)
  )
    altQueries.push('Rush Hour 3')

  if (/\bmummy\b/i.test(lower) || /\ba mumia\b/i.test(lower))
    altQueries.push('The Mummy')
  if (/\bretorno da mumia\b/i.test(lower)) altQueries.push('The Mummy Returns')
  if (/\btumba do imperador\b/i.test(lower))
    altQueries.push('The Mummy: Tomb of the Dragon Emperor')

  if (/\bamerican pie 2\b/i.test(lower)) altQueries.push('American Pie 2')
  else if (/\bamerican pie 3\b/i.test(lower))
    altQueries.push('American Wedding')
  else if (/\bamerican pie 4\b/i.test(lower))
    altQueries.push('American Pie Presents: Band Camp')
  else if (/\bamerican pie 5\b/i.test(lower))
    altQueries.push('Naked Mile', 'American Pie Presents: The Naked Mile')
  else if (/\bamerican pie 6\b/i.test(lower))
    altQueries.push('American Pie Presents: Beta House')
  else if (/\bamerican pie 7\b/i.test(lower))
    altQueries.push('American Pie Presents: The Book of Love')
  else if (/\bamerican pie 8\b/i.test(lower))
    altQueries.push('American Reunion')
  else if (/\bamerican pie 9\b/i.test(lower))
    altQueries.push("American Pie Presents: Girls' Rules")
  else if (/\bamerican pie\b/i.test(lower) || /\bamerican pi\b/i.test(lower))
    altQueries.push('American Pie')

  if (lower.includes('tartarugas ninja') && lower.includes('fora das sombras'))
    altQueries.push('Teenage Mutant Ninja Turtles: Out of the Shadows')
  else if (
    /\bteenage mutant ninja turtles ii\b/i.test(lower) ||
    /\bturtles ii\b/i.test(lower)
  )
    altQueries.push('Teenage Mutant Ninja Turtles II: The Secret of the Ooze')
  else if (
    /\bteenage mutant ninja turtles iii\b/i.test(lower) ||
    /\bturtles iii\b/i.test(lower)
  )
    altQueries.push('Teenage Mutant Ninja Turtles III')
  else if (
    /\bteenage mutant ninja turtles\b/i.test(lower) ||
    /\bas tartarugas ninja\b/i.test(lower)
  )
    altQueries.push('Teenage Mutant Ninja Turtles')

  if (/\buma festa de arromba 2\b/i.test(lower))
    altQueries.push('House Party 2')
  else if (/\buma festa de arromba 3\b/i.test(lower))
    altQueries.push('House Party 3')
  else if (
    /\buma festa de arromba\b/i.test(lower) ||
    /\bhouse party\b/i.test(lower)
  )
    altQueries.push('House Party')

  return { cleanTitle: clean || raw, year, altQueries }
}

function cleanShowTitle(raw, mediaCategory) {
  if (!raw) return ''
  let cleaned = raw
    .replace(/\[?(?:saga|coleção|colecao|collection)\]?/gi, '')
    .replace(
      /\(.*?(?:falta\s*baixar|em\s*andamento|série\s*completa|serie\s*completa|legendado|dublado|completo).*?\)/gi,
      ''
    )
    .replace(/[–—]\s*\d{4}/g, '')
    .replace(/\(\d{4}.*?\)/g, '')
    .replace(/\[\d{4}.*?\]/g, '')
    .replace(/\b(?:19\d{2}|20\d{2})\b/g, '')
    .replace(/\[.*?\]|\(.*?\)/g, '')
    .replace(/[._]/g, ' ')
    .replace(RELEASE_TAGS_REGEX, '')
    .replace(/^[\s._\-–()\[\]]+|[\s._\-–()\[\]]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  return cleaned || raw
}

function getShowSearchQueries(showTitle, mediaCategory) {
  const clean = cleanShowTitle(showTitle, mediaCategory)
  const lower = clean.toLowerCase()
  const queries = [clean]

  if (lower.includes('boku no hero')) queries.unshift('My Hero Academia')
  if (lower.includes('renma') || lower.includes('ranma'))
    queries.unshift('Ranma 1/2')
  if (lower.includes('jujutso') || lower.includes('jujutsu'))
    queries.unshift('Jujutsu Kaisen')
  if (lower.includes('samuraix') || lower.includes('samurai x'))
    queries.unshift('Rurouni Kenshin')
  if (lower.includes('cavaleiros do zodiaco') || lower.includes('saint seiya'))
    queries.unshift('Saint Seiya')
  if (
    lower.includes('house of dragons') ||
    lower.includes('house of the dragon')
  )
    queries.unshift('House of the Dragon')
  if (lower.includes('star wars visions')) queries.unshift('Star Wars: Visions')
  if (lower.includes('fire force') || lower.includes('enen no shouboutai'))
    queries.unshift('Fire Force')
  if (lower.includes('pica pau') || lower.includes('woody woodpecker'))
    queries.unshift('The Woody Woodpecker Show', 'Woody Woodpecker')
  if (lower.includes('pernalonga') || lower.includes('bugs bunny'))
    queries.unshift('Looney Tunes', 'The Bugs Bunny Show')
  if (lower.includes('papa leguas') || lower.includes('road runner'))
    queries.unshift('Road Runner', 'Wile E. Coyote and the Road Runner')
  if (lower.includes('corrida maluca') || lower.includes('wacky races'))
    queries.unshift('Wacky Races')
  if (lower.includes('jackie chan')) queries.unshift('Jackie Chan Adventures')
  if (
    lower.includes('tumulo dos vagalumes') ||
    lower.includes('hotaru no haka')
  )
    queries.unshift('Grave of the Fireflies')
  if (lower.includes('donald na nazilandia'))
    queries.unshift("Der Fuehrer's Face")
  if (lower.includes('death note')) queries.unshift('Death Note')
  if (lower.includes('mr robot')) queries.unshift('Mr. Robot')
  if (lower.includes('shingeki no kyojin') || lower.includes('attack on titan'))
    queries.unshift('Attack on Titan')
  if (lower.includes('demon slayer') || lower.includes('kimetsu no yaiba'))
    queries.unshift('Demon Slayer: Kimetsu no Yaiba')
  if (lower.includes('dna2') || lower.includes('dna²')) queries.unshift('DNA²')
  if (lower.includes('alita')) queries.unshift('Battle Angel Alita')
  if (lower.includes('lenda do demonio'))
    queries.unshift('Legend of the Overfiend')
  if (lower.includes('battle skipper')) queries.unshift('Battle Skipper')
  if (lower.includes('iria') || lower.includes('zeiram'))
    queries.unshift('Iria: Zeiram the Animation')
  if (lower.includes('lemon angel')) queries.unshift('Lemon Angel')
  if (lower.includes('wicked city')) queries.unshift('Wicked City')
  if (lower.includes('yokohama kaidashi'))
    queries.unshift('Yokohama Kaidashi Kikou')
  if (lower.includes('animatrix')) queries.unshift('The Animatrix')
  if (lower.includes('golden boy')) queries.unshift('Golden Boy')
  if (lower.includes('genocyber')) queries.unshift('Genocyber')
  if (lower.includes('cowboy bebop')) queries.unshift('Cowboy Bebop')
  if (lower.includes('berserk')) queries.unshift('Berserk')
  if (lower.includes('solo leveling')) queries.unshift('Solo Leveling')
  if (lower.includes('chainsaw man')) queries.unshift('Chainsaw Man')
  if (lower.includes('mob psycho')) queries.unshift('Mob Psycho 100')
  if (lower.includes('one punch man')) queries.unshift('One Punch Man')
  if (lower.includes('vinland saga')) queries.unshift('Vinland Saga')
  if (lower.includes('tom & jerry') || lower.includes('tom e jerry'))
    queries.unshift('Tom and Jerry')

  return Array.from(new Set(queries.filter(Boolean)))
}

function parseMediaFileName(fileName) {
  const withoutExt = fileName.replace(/\.[^/.]+$/, '')
  let raw = withoutExt
  // Strip leading fan-sub / release groups in brackets like [Erai-raws], [Kyoshiro]
  raw = raw.replace(/^\[[^\]]+\]\s*/g, '')

  let season
  let episode
  let isSeries = false
  let rawTitle = raw
  let year

  // Detect Resolution
  let resolution = 'HD'
  if (/2160p|4k|uhd/i.test(withoutExt)) resolution = '4K'
  else if (/1080p|fullhd|ups1080p/i.test(withoutExt)) resolution = '1080p'
  else if (/720p|ups720p/i.test(withoutExt)) resolution = '720p'
  else if (/480p|576p|dvdrip/i.test(withoutExt)) resolution = '480p'

  // Detect Year
  const yearMatch = raw.match(/\b(19\d{2}|20\d{2})\b/)
  if (yearMatch) {
    year = parseInt(yearMatch[1], 10)
  } else {
    const twoDigitMatch = raw.match(/[._\s]([89]\d)[._\s]/)
    if (twoDigitMatch) {
      year = 1900 + parseInt(twoDigitMatch[1], 10)
    }
  }

  // Pattern A: S01E05, S1E5, s01e05
  const sxxExxMatch =
    raw.match(/[\s._\-\(\[]s(\d{1,2})[\s._\-]*e(\d{1,3})/i) ||
    raw.match(/\bs(\d{1,2})e(\d{1,3})\b/i)
  if (sxxExxMatch) {
    season = parseInt(sxxExxMatch[1], 10)
    episode = parseInt(sxxExxMatch[2], 10)
    isSeries = true
    rawTitle = raw.slice(0, sxxExxMatch.index)
  }

  // Pattern B: 1x05, 01x05
  if (!isSeries) {
    const numXnumMatch = raw.match(/[\s._\-\(\[](\d{1,2})x(\d{1,3})/i)
    if (numXnumMatch) {
      season = parseInt(numXnumMatch[1], 10)
      episode = parseInt(numXnumMatch[2], 10)
      isSeries = true
      rawTitle = raw.slice(0, numXnumMatch.index)
    }
  }

  // Pattern C: Nth season e.g. "Boku no Hero Academia 6th Season - 03"
  if (!isSeries) {
    const nthSeasonMatch = raw.match(/(\d+)(?:st|nd|rd|th)\s*season/i)
    if (nthSeasonMatch) {
      season = parseInt(nthSeasonMatch[1], 10)
      isSeries = true
      const epAfterDash = raw.match(/-\s*(\d{1,4})/)
      if (epAfterDash) {
        episode = parseInt(epAfterDash[1], 10)
      }
      rawTitle = raw
        .replace(/(\d+)(?:st|nd|rd|th)\s*season/i, '')
        .replace(/-\s*\d{1,4}.*/, '')
    }
  }

  // Pattern D: Season / Temporada X, Episode / Episodio Y
  if (!isSeries) {
    const tempEpMatch = raw.match(
      /(?:temporada|season|temp|t)[\s._\-]*(\d{1,2})[\s._\-]*(?:episodio|episode|ep|capitulo|e)[\s._\-]*(\d{1,3})/i
    )
    if (tempEpMatch) {
      season = parseInt(tempEpMatch[1], 10)
      episode = parseInt(tempEpMatch[2], 10)
      isSeries = true
      rawTitle = raw.slice(0, tempEpMatch.index)
    }
  }

  // Pattern E: Episodio / Episode / Ep. / Cap. / OVA
  if (!isSeries) {
    const epOnlyMatch = raw.match(
      /[\s._\-\(\[]*(?:epis[oó]dio|episode|cap[ií]tulo|\bep\.?|\be|ova)[\s._\-]*(\d{1,4})/i
    )
    if (epOnlyMatch) {
      episode = parseInt(epOnlyMatch[1], 10)
      isSeries = true
      if (epOnlyMatch.index > 0) {
        rawTitle = raw.slice(0, epOnlyMatch.index)
      } else {
        const rest = raw.slice(epOnlyMatch[0].length)
        rawTitle = rest.replace(/^[\s._\-]+/, '')
      }
    }
  }

  // Pattern F: Anime Episode attached or dash style e.g. "Boruto-170-FULLHD", "Kimetsu no Yaiba - 17"
  if (!isSeries) {
    const animeEpMatch =
      raw.match(
        /^(.+?)[\s._\-]+(\d{1,4})(?:[\s._\-]+(?:fullhd|hd|\d{3,4}p|bluray|bd|web|hevc|x264|x265|dual|dublado|ups\d{3,4}p|clubehd|memoriadatv|menor|mini).*)?$/i
      ) || raw.match(/[\s._\-]+-[\s._\-]*(\d{1,4})(?:[\s._\-\[]|$)/)
    if (animeEpMatch) {
      const epNum = parseInt(animeEpMatch[2] || animeEpMatch[1], 10)
      if (epNum < 1900 || epNum > 2099 || (year && epNum !== year)) {
        episode = epNum
        isSeries = true
        if (animeEpMatch[2]) {
          rawTitle = animeEpMatch[1]
        } else {
          rawTitle = raw.slice(0, animeEpMatch.index)
        }
      }
    }
  }

  // Pattern G: Leading 2-3 digits e.g. "020 Pica Pau - Amigos Penosos"
  if (!isSeries) {
    const leadNumMatch = raw.match(/^(\d{2,3})[\s._\-]+([a-zA-Z].+)/)
    if (leadNumMatch) {
      episode = parseInt(leadNumMatch[1], 10)
      isSeries = true
      rawTitle = leadNumMatch[2]
    }
  }

  // Pattern H: Episode number before quality tag e.g. "DBZ.134.BD1080p", "Boku no Hero Academia 15 1080p"
  if (!isSeries) {
    const numBeforeQuality = raw.match(
      /[\s._\-]+(\d{1,4})[\s._\-]+(?:bd|dvd|web|hdtv|bluray|\d{3,4}p|remux|memoriadatv|ups\d{3,4}p|clubehd)/i
    )
    if (numBeforeQuality) {
      const val = parseInt(numBeforeQuality[1], 10)
      if (val < 1900 || val > 2099) {
        episode = val
        isSeries = true
        rawTitle = raw.slice(0, numBeforeQuality.index)
      }
    }
  }

  // Pattern I: Trailing episode number e.g. "Bleach 366"
  if (!isSeries) {
    const trailingNum = raw.match(/[\s._\-]+(\d{1,3})$/)
    if (trailingNum) {
      const val = parseInt(trailingNum[1], 10)
      if (val < 1900 || val > 2099) {
        episode = val
        isSeries = true
        rawTitle = raw.slice(0, trailingNum.index)
      }
    }
  }

  // If not series, cut title at year if present
  if (!isSeries && yearMatch) {
    rawTitle = raw.slice(0, yearMatch.index)
  }

  // Final cleanup of title
  let cleanTitle = rawTitle
  cleanTitle = cleanTitle.replace(/\b(19\d{2}|20\d{2})\b/g, '')
  cleanTitle = cleanTitle.replace(/\[.*?\]|\(.*?\)/g, '')
  cleanTitle = cleanTitle.replace(/[._]/g, ' ')
  cleanTitle = cleanTitle.replace(RELEASE_TAGS_REGEX, '')
  cleanTitle = cleanTitle
    .replace(/^[\s._\-–()\[\]]+|[\s._\-–()\[\]]+$/g, '')
    .trim()

  return {
    cleanTitle: cleanTitle || withoutExt,
    year,
    resolution,
    season,
    episode,
    isSeries
  }
}

// Generic folder names (categories or system directories) that cannot be used as media titles
const GENERIC_FOLDER_NAMES = new Set([
  'filmes',
  'filme',
  'movies',
  'movie',
  'series',
  'serie',
  'shows',
  'show',
  'tv',
  'tv shows',
  'tv_shows',
  'animes',
  'anime',
  'desenhos',
  'desenho',
  'cartoons',
  'cartoon',
  'documentarios',
  'documentario',
  'documentaries',
  'documentary',
  'downloads',
  'download',
  'videos',
  'video',
  'meus videos',
  'my videos',
  'media',
  'midia',
  'midias',
  'torrents',
  'torrent',
  'utorrent',
  'qbittorrent',
  'temp',
  'tmp',
  'desktop',
  'area de trabalho',
  'documents',
  'documentos',
  'incomplete',
  'completed',
  '$recycle.bin',
  'system volume information'
])

// Intermediate subfolders (Seasons, Discs, Specials, Extras, Samples) to ignore when looking for the media folder
const INTERMEDIATE_SUBFOLDER_REGEX =
  /^(?:season|temporada|temp|s|st)\s*0*\d+$|^(?:cd|disc|disco)\s*0*\d+$|^(?:filmes?|movies?|ovas?|especial|especiais|specials?|extras?|featurettes?|sample|samples|bonus|sub|subs|legendas?)$/i

const DRIVE_OR_ROOT_REGEX = /^[a-zA-Z]:$|^[\/\\]+$/

// Common placeholder/generic titles that should be treated as invalid media titles
const GENERIC_TITLES = new Set([
  'video',
  'videos',
  'movie',
  'movies',
  'filme',
  'filmes',
  'track',
  'audio',
  'sample',
  'trailer',
  'cd1',
  'cd2',
  'cd3',
  'disc1',
  'disc2',
  'disc3',
  'disco1',
  'disco2',
  'ep',
  'episode',
  'episodio',
  'capitulo',
  'untitled',
  'sem titulo',
  'novo',
  'new',
  'clip',
  'clipe',
  'stream',
  'play',
  'download',
  'downloads',
  'torrent',
  'media',
  'midia',
  'bluray',
  'webrip',
  'web-dl',
  '1080p',
  '720p',
  '4k',
  '2160p',
  '480p'
])

function extractCandidateFolder(filePath) {
  if (!filePath || typeof filePath !== 'string') return null
  const norm = filePath.replace(/\\/g, '/').replace(/\/+$/, '')
  const parts = norm.split('/').filter(Boolean)
  if (parts.length <= 1) return null

  // The last part is the file itself
  const dirParts = parts.slice(0, parts.length - 1)

  // Traverse backwards from deepest directory towards root
  for (let i = dirParts.length - 1; i >= 0; i--) {
    const part = dirParts[i].trim()
    if (!part) continue

    // Skip drive roots (e.g. "C:", "D:")
    if (DRIVE_OR_ROOT_REGEX.test(part)) continue

    if (/^(?:filmes?|movies?)$/i.test(part)) return null

    // Skip intermediate subfolders (e.g. "Season 01", "Temporada 2", "CD1", "Specials")
    if (INTERMEDIATE_SUBFOLDER_REGEX.test(part)) continue

    // Normalize for generic check
    const normalizedPart = part
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()

    // If it's a generic category or system folder, it cannot be a movie/show title!
    if (GENERIC_FOLDER_NAMES.has(normalizedPart)) {
      // A file directly inside a category must not inherit the library/root name.
      if (/^(?:filmes?|movies?|series?|shows?|animes?|desenhos?|cartoons?|documentarios?|documentaries)$/.test(normalizedPart)) return null
      continue
    }

    // Found a valid candidate folder!
    return part
  }

  return null
}

function isValidMediaTitle(title) {
  if (!title || typeof title !== 'string') return false
  const trimmed = title.trim()
  if (!trimmed || trimmed.length < 2) return false

  // Purely numeric (e.g. "01", "1", "12345", "1080")
  if (/^\d+$/.test(trimmed)) return false

  // Purely episode codes (e.g. "S01E01", "E01", "EP01", "Cap 1")
  if (/^(?:s\d+)?(?:e|ep|cap|episodio)?\s*\d+$/i.test(trimmed)) return false

  // Purely symbols or punctuation
  if (/^[^a-zA-Z0-9\u00C0-\u017F]+$/.test(trimmed)) return false

  const lower = trimmed
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  if (GENERIC_TITLES.has(lower)) return false

  return true
}

function folderDisplayTitle(folder) {
  const original = (folder || '').trim()
  const technical = original.search(/[ ._-]+(?:s\d{1,2}(?:[ ._-]|$)|(?:480|576|720|1080|2160)p\b|(?:4k|uhd|bluray|webrip|web-dl|hdtv|x264|x265|hevc)\b)/i)
  const title = technical === -1 ? original : original.slice(0, technical).replace(/[._]/g, ' ')
  return title.replace(/\s*\((?:falta\s*baixar|em\s*andamento|s[eé]rie\s*completa|completo)\)\s*$/i, '').trim() || original
}

function resolveMediaTitle({ filePath, fileName, preferredSource = 'file' }) {
  const fileCleaned = cleanMovieTitleAndYear(fileName)
  const isFileValid = isValidMediaTitle(fileCleaned.cleanTitle)

  const candidateFolder = extractCandidateFolder(filePath)
  let folderCleaned = null
  let isFolderValid = false
  if (candidateFolder) {
    folderCleaned = {
      ...cleanMovieTitleAndYear(candidateFolder),
      cleanTitle: folderDisplayTitle(candidateFolder)
    }
    const collection = /^(?:\[\s*)?(?:saga|cole[cç][aã]o|collection|trilogia|duologia)\b/i.test(candidateFolder)
    isFolderValid = !collection && (isValidMediaTitle(folderCleaned.cleanTitle) || /^\d{3,4}$/.test(folderCleaned.cleanTitle))
  }

  // 1. Preferred: 'folder'
  if (preferredSource === 'folder') {
    if (isFolderValid) {
      return {
        cleanTitle: folderCleaned.cleanTitle,
        year: folderCleaned.year || fileCleaned.year,
        sourceUsed: 'folder'
      }
    }
    // Fallback: Se a pasta for genérica ou raiz, usa o arquivo automaticamente sem permitir erro!
    if (isFileValid) {
      return {
        cleanTitle: fileCleaned.cleanTitle,
        year: fileCleaned.year || (folderCleaned && folderCleaned.year),
        sourceUsed: 'file'
      }
    }
  } else {
    // 2. Preferred: 'file'
    if (isFileValid) {
      return {
        cleanTitle: fileCleaned.cleanTitle,
        year: fileCleaned.year || (folderCleaned && folderCleaned.year),
        sourceUsed: 'file'
      }
    }
    // Fallback: Se o arquivo for genérico (video.mp4, 01.mkv), usa a pasta automaticamente sem permitir erro!
    if (isFolderValid) {
      return {
        cleanTitle: folderCleaned.cleanTitle,
        year: folderCleaned.year || fileCleaned.year,
        sourceUsed: 'folder'
      }
    }
  }

  // 3. Fallback de última instância: qualquer um que tenha conteúdo
  const fallback =
    folderCleaned && isFolderValid
      ? folderCleaned
      : fileCleaned && isFileValid
        ? fileCleaned
        : folderCleaned && folderCleaned.cleanTitle
          ? folderCleaned
          : fileCleaned
  return {
    cleanTitle:
      (fallback && fallback.cleanTitle) || fileName.replace(/\.[^/.]+$/, ''),
    year: fallback && fallback.year,
    sourceUsed: preferredSource
  }
}

function parseMediaHierarchy(filePath, fileName, options = {}) {
  const titleSource = options.titleSource || 'file'
  const norm = (filePath || '').replace(/\\/g, '/')
  const parts = norm.split('/')

  const normalizedParts = parts.map((p) =>
    p
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
  )
  const categoryNames = {
    filmes: 'movie',
    movies: 'movie',
    series: 'series',
    shows: 'series',
    animes: 'anime',
    anime: 'anime',
    desenhos: 'cartoon',
    cartoons: 'cartoon',
    documentarios: 'documentary',
    documentaries: 'documentary',
    ova: 'ova',
    ovas: 'ova'
  }
  const rootIdx = normalizedParts.findIndex((p) => categoryNames[p])
  const inFilmesFolder =
    rootIdx !== -1 && categoryNames[normalizedParts[rootIdx]] === 'movie'
  const parsed = parseMediaFileName(fileName)

  let mediaCategory =
    rootIdx !== -1
      ? categoryNames[normalizedParts[rootIdx]]
      : parsed.isSeries
        ? 'series'
        : 'movie'

  // REGRA SOBERANA PARA FILMES: Cada filme em Filmes (ou fora de séries/animes sem episódio) é estritamente standalone (nunca série, nunca agrupado com saga)
  const isMovie =
    inFilmesFolder || (mediaCategory === 'movie' && !parsed.isSeries)
  if (isMovie) {
    const movieInfo = resolveMediaTitle({
      filePath,
      fileName,
      preferredSource: options.collectionDirectories?.has(
        norm.substring(0, norm.lastIndexOf('/')).toLowerCase()
      ) ? 'file' : titleSource
    })
    let res = parsed.resolution || 'HD'
    if (/2160p|4k|uhd/i.test(fileName)) res = '4K'
    else if (/1080p|fullhd|ups1080p/i.test(fileName)) res = '1080p'
    else if (/720p|ups720p/i.test(fileName)) res = '720p'
    else if (/480p|576p|dvdrip/i.test(fileName)) res = '480p'

    return {
      mediaCategory: 'movie',
      showTitle: movieInfo.cleanTitle,
      showDir: '',
      season: undefined,
      episode: undefined,
      isSpecial: false,
      isSeries: false,
      cleanTitle: movieInfo.cleanTitle,
      year: movieInfo.year || parsed.year,
      resolution: res
    }
  }

  let showTitle = ''
  let showDir = ''
  let season = undefined
  let isSpecial = false

  if (rootIdx !== -1 && parts[rootIdx + 1]) {
    if (rootIdx + 1 < parts.length - 1) {
      showTitle = parts[rootIdx + 1]
      showDir = parts.slice(0, rootIdx + 2).join('/')
      for (let i = rootIdx + 2; i < parts.length - 1; i++) {
        const folder = parts[i]
        const sMatch = folder.match(/^(?:Season|Temporada|S|Temp)\s*0*(\d+)/i)
        if (sMatch) {
          season = parseInt(sMatch[1], 10)
        }
        if (
          /^(?:filmes?|movies?|ovas?|especial|especiais|specials?|extras?)$/i.test(
            folder
          )
        ) {
          isSpecial = true
        }
      }
    }
  }

  const candidateFolder = extractCandidateFolder(filePath)
  if (!showTitle && candidateFolder) {
    showTitle = candidateFolder
  }

  if (season === undefined && parsed.season !== undefined) {
    season = parsed.season
  }
  const episode = parsed.episode
  const isSeries =
    ['series', 'anime', 'cartoon'].includes(mediaCategory) ||
    (mediaCategory === 'documentary' && /^s[eé]ries?\s+/i.test(showTitle)) ||
    season !== undefined ||
    episode !== undefined ||
    isSpecial ||
    parsed.isSeries
  if (isSeries && season === undefined && !isSpecial) {
    season = 1
  }

  if (isSpecial) season = 0
  const cleanShow = titleSource === 'folder' && showTitle
    ? folderDisplayTitle(showTitle)
    : cleanShowTitle(showTitle || parsed.cleanTitle, mediaCategory)

  let epCleanTitle = parsed.cleanTitle
  if (!isValidMediaTitle(epCleanTitle)) {
    epCleanTitle =
      episode !== undefined
        ? `Episódio ${episode}`
        : cleanShow || parsed.cleanTitle
  }

  return {
    mediaCategory,
    showTitle: cleanShow,
    showDir,
    season,
    episode,
    isSpecial,
    isSeries,
    cleanTitle: epCleanTitle,
    year: parsed.year,
    resolution: parsed.resolution
  }
}

function autoCatalogMovies(movies, options = {}) {
  // A shared movie directory can contain sequels, extras, or alternate films.
  // Only single-work folders are authoritative; do not rename an entire saga
  // to its collection name just because folder titles were selected.
  const folderFiles = new Map()
  if (options.titleSource === 'folder') {
    for (const movie of movies) {
      if (parseMediaHierarchy(movie.filePath, movie.fileName).mediaCategory !== 'movie') continue
      const normalized = (movie.filePath || '').replace(/\\/g, '/').toLowerCase()
      const directory = normalized.substring(0, normalized.lastIndexOf('/'))
      const title = cleanMovieTitleAndYear(movie.fileName)
      const key = normalizeMediaTitle(title.cleanTitle) + ':' + (title.year || '')
      if (!folderFiles.has(directory)) folderFiles.set(directory, new Set())
      folderFiles.get(directory).add(key)
    }
  }
  const collectionDirectories = new Set(
    Array.from(folderFiles).filter(([, titles]) => titles.size > 1).map(([directory]) => directory)
  )
  const hierarchyOptions = { ...options, collectionDirectories }
  const forceTitleUpdate = options.forceTitleUpdate || options.titleSource === 'folder'
  let updatedCount = 0
  const cataloged = movies.map((m) => {
    const h = parseMediaHierarchy(m.filePath, m.fileName, hierarchyOptions)
    if (m.metadataLocked) return m
    const category = m.customCategory || h.mediaCategory
    const isSeries =
      m.customIsSeries !== undefined
        ? m.customIsSeries
        : category !== 'movie' && h.isSeries
    const targetTitle =
      m.customTitle ||
      (forceTitleUpdate ? h.cleanTitle : m.title) ||
      h.cleanTitle ||
      m.title
    const targetCleanTitle =
      m.customTitle ||
      (forceTitleUpdate ? h.cleanTitle : m.cleanTitle) ||
      h.cleanTitle ||
      m.cleanTitle
    const updated = {
      ...m,
      title: targetTitle,
      cleanTitle: targetCleanTitle,
      mediaCategory: category,
      categories:
        m.customCategories && m.customCategories.length > 0
          ? m.customCategories
          : m.categories && m.categories.length > 0
          ? m.categories
          : [category],
      customCategories:
        m.customCategories && m.customCategories.length > 0
          ? m.customCategories
          : m.categories && m.categories.length > 0
          ? m.categories
          : [category],
      showTitle:
        m.customShowTitle || (category === 'movie' ? targetTitle : h.showTitle),
      showDirectory: h.showDir || undefined,
      isSeries,
      season: isSeries
        ? m.customSeason !== undefined
          ? (m.customSeason ?? undefined)
          : h.season
        : undefined,
      episode: isSeries
        ? m.customEpisode !== undefined
          ? (m.customEpisode ?? undefined)
          : h.episode
        : undefined,
      isSpecial:
        isSeries && (m.customSeason === 0 || h.isSpecial || h.season === 0),
      year: m.year || h.year,
      resolution: m.resolution || h.resolution
    }
    if (JSON.stringify(updated) !== JSON.stringify(m)) updatedCount++
    return updated
  })
  return { cataloged, updatedCount }
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Library writes are serialized. Online lookups never write an old library snapshot.
let libraryWrite = Promise.resolve()
let libraryRevision = 0
function withLibraryWrite(action) {
  const result = libraryWrite.then(action)
  libraryWrite = result.catch((error) =>
    ghost.warn('Falha ao atualizar o catálogo:', error.message)
  )
  return result
}
async function saveMovies(movies) {
  await ghost.storage.set('movies', movies)
  libraryRevision++
}
function normalizeMediaTitle(title) {
  return String(title || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
function mediaGroupKey(movie) {
  const normPath = (movie.filePath || '').replace(/\\/g, '/')
  const parts = normPath.split('/')
  const categoryNames = {
    filmes: 'movie',
    movies: 'movie',
    series: 'series',
    shows: 'series',
    animes: 'anime',
    anime: 'anime',
    desenhos: 'cartoon',
    cartoons: 'cartoon',
    documentarios: 'documentary',
    documentaries: 'documentary',
    ova: 'ova',
    ovas: 'ova'
  }
  const root = parts.findIndex((part) =>
    categoryNames[
      part
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
    ]
  )
  const directory =
    movie.showDirectory ||
    parseMediaHierarchy(movie.filePath, movie.fileName).showDir ||
    (root !== -1 && root + 2 < parts.length
      ? parts.slice(0, root + 2).join('/')
      : '')

  const dirParts = directory
    ? directory.replace(/\\/g, '/').split('/').filter(Boolean)
    : []
  const folderName = dirParts.length > 0 ? dirParts[dirParts.length - 1] : ''
  const isDedicatedFolder =
    Boolean(folderName) &&
    !categoryNames[
      folderName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
    ]

  if (isDedicatedFolder) {
    const workTitle = movie.showTitle || folderName
    return [
      directory.replace(/\\/g, '/').toLowerCase(),
      normalizeMediaTitle(workTitle)
    ].join(':')
  }

  if (movie.isSeries) {
    return [
      movie.mediaCategory || 'series',
      directory.replace(/\\/g, '/').toLowerCase(),
      normalizeMediaTitle(movie.showTitle || movie.cleanTitle || movie.title)
    ].join(':')
  }

  return 'file:' + movie.filePath
}
function localArtworkUrl(path, revision) {
  return (
    'imagecache://localhost/' +
    encodeURIComponent(path) +
    (revision ? '?v=' + revision : '')
  )
}
let artworkCounter = Date.now()
function nextArtworkRevision() {
  artworkCounter = Math.max(Date.now(), artworkCounter + 1)
  return artworkCounter
}
function stableMovieId(filePath) {
  const normalized = /^[a-z]:/i.test(filePath)
    ? filePath.replace(/\\/g, '/').toLowerCase()
    : filePath
  return (
    'media_' +
    Buffer.from(normalized)
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
  )
}

let migrated = false
async function migrateLibrary() {
  if (migrated) return
  await withLibraryWrite(async () => {
    if (migrated) return
    const movies = (await ghost.storage.get('movies')) || []
    // Keep a recoverable copy of the old catalog before fixing duplicate IDs.
    if (movies.length && !(await ghost.storage.get('catalog_v2_backup'))) {
      await ghost.storage.set('catalog_v2_backup', {
        movies,
        history: (await ghost.storage.get('playback_history')) || {},
        createdAt: new Date().toISOString()
      })
    }
    const idCounts = new Map()
    for (const movie of movies)
      idCounts.set(movie.id, (idCounts.get(movie.id) || 0) + 1)
    const oldHistory = (await ghost.storage.get('playback_history')) || {}
    const history = { ...oldHistory }
    const catalog = autoCatalogMovies(movies, {
      titleSource: (await metadataSettings()).titleSource
    }).cataloged
    const unique = new Map()
    for (const movie of catalog) {
      if (!movie.id || idCounts.get(movie.id) > 1) {
        const oldId = movie.id
        movie.id = stableMovieId(movie.filePath)
        // Ambiguous shared history cannot be assigned to one particular video.
        // Preserve it in the migration backup, and retain per-file progress if present.
        if (idCounts.get(oldId) === 1 && oldHistory[oldId])
          history[movie.id] = oldHistory[oldId]
      }
      if (movie.customCoverUrl) movie.artworkLocked = true
      if (movie.customTitle) movie.metadataLocked = true
      if (movie.localCoverPath) {
        movie.coverUrl = localArtworkUrl(
          movie.localCoverPath,
          movie.artworkRevision
        )
        if (movie.customCoverUrl) movie.customCoverUrl = movie.coverUrl
      }
      if (movie.localBackdropPath)
        movie.backdropUrl = localArtworkUrl(
          movie.localBackdropPath,
          movie.artworkRevision
        )
      unique.set(movie.filePath, movie)
    }
    const updated = Array.from(unique.values())
    if (JSON.stringify(updated) !== JSON.stringify(movies)) {
      await saveMovies(updated)
      await ghost.storage.set('playback_history', history)
    }
    migrated = true
  })
}

async function metadataSettings() {
  const stored = (await ghost.storage.get('metadata_settings')) || {}
  return {
    autoFetch: stored.autoFetch !== false,
    language: stored.language || 'pt-BR',
    tmdbConfigured: Boolean(stored.tmdbToken),
    titleSource: stored.titleSource || 'file',
    useStremioArtwork: stored.useStremioArtwork === true
  }
}
async function tmdbRequest(route, params = {}) {
  const settings = (await ghost.storage.get('metadata_settings')) || {}
  if (!settings.tmdbToken) return null
  const query = new URLSearchParams({
    language: settings.language || 'pt-BR',
    ...params
  })
  const response = await ghost.http.fetch(
    'https://api.themoviedb.org/3/' + route + '?' + query,
    {
      headers: { Authorization: 'Bearer ' + settings.tmdbToken },
      timeoutMs: 15000
    }
  )
  if (!response.ok)
    throw new Error(
      'TMDB respondeu HTTP ' +
        response.status +
        '. Confira o token de leitura nas configurações.'
    )
  return response.json()
}
function tmdbImage(path, backdrop = false) {
  return path
    ? 'https://image.tmdb.org/t/p/' + (backdrop ? 'original' : 'w500') + path
    : undefined
}
function tmdbCandidate(item, type) {
  return {
    provider: 'tmdb',
    id: String(item.id),
    type,
    title: item.title || item.name,
    originalTitle: item.original_title || item.original_name,
    year: parseInt(item.release_date || item.first_air_date, 10) || undefined,
    poster: tmdbImage(item.poster_path),
    background: tmdbImage(item.backdrop_path, true),
    description: item.overview,
    rating:
      Number.isFinite(item.vote_average) &&
      item.vote_average >= 0 &&
      item.vote_average <= 10 &&
      item.vote_count !== 0
        ? item.vote_average.toFixed(1)
        : undefined
  }
}
function cinemetaCandidate(item, type) {
  return {
    provider: 'cinemeta',
    id: item.id,
    type,
    title: item.name,
    year: parseInt(item.releaseInfo, 10) || undefined,
    poster: item.poster,
    background: item.background,
    description: item.description,
    rating: item.imdbRating,
    genres: item.genres,
    runtime: item.runtime,
    imdbId: item.id
  }
}
async function searchMetadata(query, type) {
  if (!['movie', 'series', 'anime', 'cartoon', 'documentary', 'ova'].includes(type))
    throw new Error('Formato de mídia inválido.')
  const effectiveType = type === 'movie' ? 'movie' : 'series'
  const term = String(query || '')
    .trim()
    .slice(0, 200)
  if (!term) return []
  const results = []
  let providerError
  const settings = await metadataSettings()
  if (settings.tmdbConfigured) {
    try {
      const data = await tmdbRequest(
        'search/' + (effectiveType === 'series' ? 'tv' : 'movie'),
        { query: term, include_adult: 'false' }
      )
      for (const item of (data.results || []).slice(0, 12))
        results.push(tmdbCandidate(item, effectiveType))
    } catch (error) {
      providerError = error
      ghost.warn(error.message)
    }
  }
  try {
    const response = await ghost.http.fetch(
      'https://v3-cinemeta.strem.io/catalog/' +
        effectiveType +
        '/top/search=' +
        encodeURIComponent(term) +
        '.json',
      { timeoutMs: 15000 }
    )
    if (!response.ok)
      throw new Error('Cinemeta respondeu HTTP ' + response.status)
    const data = await response.json()
    for (const item of (data.metas || []).slice(0, 12))
      results.push(cinemetaCandidate(item, effectiveType))
  } catch (error) {
    providerError = error
    ghost.warn(error.message)
  }
  if (!results.length && providerError) throw providerError
  return results
}
async function metadataDetails(candidate) {
  if (
    !candidate ||
    !['movie', 'series', 'anime', 'cartoon', 'documentary', 'ova'].includes(candidate.type)
  )
    throw new Error('Identificação inválida.')
  const effectiveType = candidate.type === 'movie' ? 'movie' : 'series'
  if (candidate.provider === 'tmdb') {
    if (!/^\d+$/.test(candidate.id))
      throw new Error('Identificador TMDB inválido.')
    const data = await tmdbRequest(
      (effectiveType === 'series' ? 'tv/' : 'movie/') + candidate.id,
      {
        append_to_response: 'images,external_ids',
        include_image_language: 'pt,null'
      }
    )
    if (!data)
      throw new Error(
        'Configure o token de leitura TMDB para usar esta identificação.'
      )
    const portuguesePosters = (data.images?.posters || [])
      .filter((image) => image.iso_639_1 === 'pt')
      .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0))
      .slice(0, 30)
      .map((image) => tmdbImage(image.file_path))
    const localizedBackdrops = (data.images?.backdrops || [])
      .filter((image) => image.iso_639_1 === 'pt' || image.iso_639_1 === null)
      .filter((image) => !image.width || !image.height || image.width > image.height)
      .sort((a, b) =>
        Number((b.width || 0) >= 1280) - Number((a.width || 0) >= 1280) ||
        Number(b.iso_639_1 === null) - Number(a.iso_639_1 === null) ||
        (b.width || 0) - (a.width || 0) ||
        (b.vote_average || 0) - (a.vote_average || 0)
      )
      .slice(0, 20)
      .map((image) => tmdbImage(image.file_path, true))
    return {
      ...tmdbCandidate(data, effectiveType),
      poster: portuguesePosters[0],
      background: localizedBackdrops[0] || tmdbImage(data.backdrop_path, true),
      posterLanguage: portuguesePosters.length ? 'pt' : undefined,
      imdbId: data.imdb_id || data.external_ids?.imdb_id,
      genres: (data.genres || []).map((genre) => genre.name),
      runtime: data.runtime ? data.runtime + ' min' : undefined,
      posters: portuguesePosters,
      backdrops: localizedBackdrops
    }
  }
  if (
    (candidate.provider !== 'cinemeta' && candidate.provider !== 'stremio') ||
    !candidate.id ||
    typeof candidate.id !== 'string'
  )
    throw new Error('Identificador Cinemeta inválido.')
  const response = await ghost.http.fetch(
    'https://v3-cinemeta.strem.io/meta/' +
      effectiveType +
      '/' +
      candidate.id +
      '.json',
    { timeoutMs: 15000 }
  )
  if (!response.ok)
    throw new Error(
      'Não foi possível carregar os detalhes da obra (HTTP ' +
        response.status +
        ').'
    )
  const data = await response.json()
  if (!data.meta) throw new Error('Esta obra não possui detalhes disponíveis.')
  const result = cinemetaCandidate(data.meta, effectiveType)
  if ((await metadataSettings()).tmdbConfigured && candidate.provider !== 'stremio') {
    const mapped = await tmdbRequest('find/' + candidate.id, {
      external_source: 'imdb_id'
    })
    const match = (
      effectiveType === 'series' ? mapped.tv_results : mapped.movie_results
    )?.[0]
    if (match)
      return metadataDetails({
        provider: 'tmdb',
        id: String(match.id),
        type: candidate.type
      })
  }
  const allowStremioArtwork =
    candidate.provider === 'stremio' ||
    candidate.useStremioArtwork === true ||
    (await metadataSettings()).useStremioArtwork === true

  if (allowStremioArtwork) {
    return {
      ...result,
      poster: data.meta.poster || undefined,
      background: data.meta.background || undefined,
      posters: data.meta.poster ? [data.meta.poster] : [],
      backdrops: data.meta.background ? [data.meta.background] : [],
      posterLanguage: 'stremio'
    }
  }

  // Cinemeta does not declare artwork language. Never auto-apply an unverified poster.
  return {
    ...result,
    poster: undefined,
    background: undefined,
    posters: [],
    backdrops: []
  }
}
function chooseMetadataCandidate(candidates, query, year) {
  const expected = normalizeMediaTitle(query)
  const matches = candidates.filter(
    (c) =>
      [c.title, c.originalTitle].some(
        (t) => normalizeMediaTitle(t) === expected
      ) &&
      (!year || c.year === year)
  )
  // Multiple homonyms/remakes without a year need an explicit user choice.
  const identities = new Set(
    matches.map(
      (c) => normalizeMediaTitle(c.originalTitle || c.title) + ':' + c.year
    )
  )
  return identities.size === 1 ? matches[0] : null
}
async function fetchMetadata(movie) {
  const type =
    movie.isSeries && movie.mediaCategory !== 'movie' ? 'series' : 'movie'
  if (movie.metadataProvider && movie.metadataId)
    return metadataDetails({
      provider: movie.metadataProvider,
      id: movie.metadataId,
      type
    })
  const embedded = movie.filePath.match(/\[imdbid[-=](tt\d+)\]/i)
  if (movie.imdbId || embedded)
    return metadataDetails({
      provider: 'cinemeta',
      id: movie.imdbId || embedded[1],
      type
    })
  const tmdb = movie.filePath.match(/\[tmdbid[-=](\d+)\]/i)
  if (tmdb && (await metadataSettings()).tmdbConfigured)
    return metadataDetails({ provider: 'tmdb', id: tmdb[1], type })
  const query = movie.isSeries
    ? movie.customShowTitle || movie.showTitle || movie.cleanTitle
    : movie.customTitle || movie.cleanTitle || movie.title
  const queries = movie.isSeries
    ? getShowSearchQueries(query, movie.mediaCategory)
    : [query, ...cleanMovieTitleAndYear(movie.fileName).altQueries]
  for (const term of [...new Set(queries.filter(Boolean))]) {
    const candidates = await searchMetadata(term, type)
    const chosen = chooseMetadataCandidate(candidates, term, movie.year)
    if (chosen) return metadataDetails(chosen)
  }
  return null
}

async function applyMetadata(movieId, meta, replaceWithPortuguese = false) {
  return withLibraryWrite(async () => {
    const movies = (await ghost.storage.get('movies')) || []
    const movie = movies.find((m) => m.id === movieId)
    if (!movie) return null
    const group = mediaGroupKey(movie)
    const targets = movies.filter((m) => mediaGroupKey(m) === group)
    const representative =
      targets.find((m) => !m.artworkLocked && !m.customCoverUrl) || movie
    const existingPoster =
      representative.localCoverPath &&
      (await ghost.media.artworkExists(representative.localCoverPath))
    const existingBackdrop =
      representative.localBackdropPath &&
      (await ghost.media.artworkExists(representative.localBackdropPath))
    const isStremio = meta.posterLanguage === 'stremio' || meta.provider === 'stremio'
    const replacePoster =
      (replaceWithPortuguese && meta.posterLanguage === 'pt' && meta.poster &&
      (!existingPoster || representative.artworkLanguage !== 'pt')) ||
      (isStremio && meta.poster && (replaceWithPortuguese || !existingPoster))
    const posterSource = (meta.posterLanguage === 'pt' || isStremio) ? meta.poster : undefined
    const backdropSource = meta.background || (
      representative.backdropUrl?.startsWith('http') &&
      representative.backdropUrl !== representative.coverUrl
        ? representative.backdropUrl
        : undefined
    )
    let poster
    let backdrop
    const directory = movie.isSeries ? movie.showDirectory : undefined
    if (!representative.artworkLocked && !representative.customCoverUrl) {
      if ((!existingPoster || replacePoster) && posterSource) {
        poster = await ghost.media.saveArtwork(
          representative.filePath,
          posterSource,
          'poster',
          directory,
          targets.some(
            (target) =>
              (target.artworkLocked || target.customCoverUrl) &&
              target.localCoverPath === representative.localCoverPath
          )
        )
      }
      if (!existingBackdrop && backdropSource) {
        try {
          backdrop = await ghost.media.saveArtwork(
            movie.filePath,
            backdropSource,
            'backdrop',
            directory
          )
        } catch (backdropErr) {
          ghost.warn(
            'Não foi possível salvar imagem de fundo durante o enriquecimento:',
            backdropErr.message || String(backdropErr)
          )
        }
      }
    }
    const revision = nextArtworkRevision()
    for (const target of targets) {
      if (!target.artworkLocked && !target.customCoverUrl) {
        if (poster) {
          target.localCoverPath = poster.localPath
          target.coverUrl = localArtworkUrl(poster.localPath, revision)
          target.artworkRevision = revision
        } else if (!target.coverUrl) {
          target.coverUrl = representative.coverUrl || posterSource
          target.localCoverPath = representative.localCoverPath
        }
        if (backdrop) {
          target.localBackdropPath = backdrop.localPath
          target.backdropUrl = localArtworkUrl(backdrop.localPath, revision)
          target.artworkRevision = revision
        } else if (!target.backdropUrl) {
          target.backdropUrl = representative.backdropUrl || meta.background
          target.localBackdropPath = representative.localBackdropPath
        }
        target.hasLocalArtwork = Boolean(target.localCoverPath)
      }
      if (!target.metadataLocked) {
        if (meta.description) target.synopsis = meta.description
        if (meta.genres?.length) target.genres = meta.genres
        if (meta.rating) target.rating = meta.rating
        if (meta.runtime) target.durationFormatted = meta.runtime
        if (!target.year && meta.year) target.year = meta.year
        // Online identification supplies artwork and information. Local names stay in pt-BR.
      }
      target.metadataProvider = meta.provider
      // Keep the audience rating separate from editable/IMDb metadata.
      const tmdbRating = Number(meta.rating)
      target.tmdbRating =
        meta.provider === 'tmdb' &&
        meta.rating !== undefined &&
        meta.rating !== '' &&
        Number.isFinite(tmdbRating) &&
        tmdbRating >= 0 &&
        tmdbRating <= 10
          ? tmdbRating
          : null
      target.metadataId = meta.id
      if (meta.imdbId) target.imdbId = meta.imdbId
      target.metadataStatus = 'matched'
      target.portuguesePosterUnavailable = !meta.poster
      if (poster && !target.artworkLocked && !target.customCoverUrl) {
        target.artworkLanguage = isStremio ? 'stremio' : 'pt'
        target.artworkScope = target.isSeries ? 'show' : 'item'
      }
      target.lastMetadataAttempt = new Date().toISOString()
    }
    await saveMovies(movies)
    return movie
  })
}

let metadataJob = {
  running: false,
  total: 0,
  completed: 0,
  matched: 0,
  failed: 0,
  unidentified: 0
}
let cancelMetadata = false
function jobStatus() {
  return { ...metadataJob, libraryRevision }
}
async function refreshMetadata(mode = 'missing') {
  await migrateLibrary()
  if (metadataJob.running) return jobStatus()
  if (mode === 'portuguese' && !(await metadataSettings()).tmdbConfigured)
    throw new Error(
      'Configure o token de leitura TMDB nas preferências de capas para buscar pôsteres em português e fundos horizontais.'
    )
  const movies = (await ghost.storage.get('movies')) || []
  const groups = new Map()
  const available = new Map()
  for (const movie of movies) {
    if (movie.localCoverPath && !available.has(movie.localCoverPath))
      available.set(
        movie.localCoverPath,
        await ghost.media.artworkExists(movie.localCoverPath)
      )
    const coverAvailable =
      movie.localCoverPath && available.get(movie.localCoverPath)
    if (movie.localBackdropPath && !available.has(movie.localBackdropPath))
      available.set(
        movie.localBackdropPath,
        await ghost.media.artworkExists(movie.localBackdropPath)
      )
    const backdropAvailable =
      movie.localBackdropPath && available.get(movie.localBackdropPath)
    if (movie.artworkLocked && movie.metadataLocked) continue
    if (
      mode === 'portuguese' &&
      (movie.artworkLocked ||
        movie.customCoverUrl ||
        (movie.artworkLanguage === 'pt' && coverAvailable && backdropAvailable))
    )
      continue
    if (mode === 'missing' && coverAvailable && backdropAvailable && movie.synopsis) continue
    const key = mediaGroupKey(movie)
    if (!groups.has(key)) groups.set(key, movie)
  }
  cancelMetadata = false
  metadataJob = {
    running: true,
    total: groups.size,
    completed: 0,
    matched: 0,
    failed: 0,
    unidentified: 0
  }
  // Dispatch, then return immediately to allow browsing and progress updates.
  setTimeout(async () => {
    try {
      for (const snapshot of groups.values()) {
        if (cancelMetadata) break
        metadataJob.currentTitle = snapshot.showTitle || snapshot.title
        try {
          const latest = ((await ghost.storage.get('movies')) || []).find(
            (m) => m.id === snapshot.id
          )
          if (!latest || (latest.artworkLocked && latest.metadataLocked)) {
            metadataJob.completed++
            continue
          }
          const meta = await fetchMetadata(latest)
          if (cancelMetadata) break
          if (meta) {
            await applyMetadata(latest.id, meta, mode === 'portuguese')
            metadataJob.matched++
          } else {
            metadataJob.unidentified++
            await markMetadataStatus(latest.id, 'needs-identification')
          }
        } catch (error) {
          metadataJob.failed++
          metadataJob.lastError = error.message || String(error)
          ghost.warn('Falha ao atualizar uma obra:', metadataJob.lastError)
          await markMetadataStatus(snapshot.id, 'error')
        }
        metadataJob.completed++
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    } catch (error) {
      metadataJob.lastError = error.message || String(error)
      ghost.error('Falha na atualização da biblioteca:', metadataJob.lastError)
    } finally {
      metadataJob.running = false
      metadataJob.currentTitle = undefined
    }
  }, 0)
  return jobStatus()
}
async function markMetadataStatus(id, status) {
  await withLibraryWrite(async () => {
    const movies = (await ghost.storage.get('movies')) || []
    const movie = movies.find((m) => m.id === id)
    if (!movie) return
    for (const target of movies)
      if (mediaGroupKey(target) === mediaGroupKey(movie)) {
        target.metadataStatus = status
        target.lastMetadataAttempt = new Date().toISOString()
      }
    await saveMovies(movies)
  })
}

// Media Provider Implementation
function normalizeStremioAddonUrl(rawInput, depth = 0) {
  if (!rawInput || typeof rawInput !== 'string') return ''
  if (depth > 4) return rawInput.trim()

  let url = rawInput.trim()
  if (!url) return ''

  if (/\s/.test(url)) {
    const match = url.match(/(?:stremio|https?):\/\/[^\s"'<>]+/i)
    if (match && match[0]) {
      url = match[0].replace(/[.,;!?)]+$/, '')
    }
  }

  const shareParamMatch = url.match(/[?&#](?:addon|manifest|transportUrl|addonUrl)=([^&#\s]+)/i)
  if (shareParamMatch && shareParamMatch[1]) {
    try {
      const decoded = decodeURIComponent(shareParamMatch[1])
      if (decoded && decoded !== url) {
        return normalizeStremioAddonUrl(decoded, depth + 1)
      }
    } catch {}
  }

  if (/^stremio:\/\//i.test(url)) {
    url = url.replace(/^stremio:\/\//i, 'https://')
  } else if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
    url = 'https://' + url.replace(/^\/+/, '')
  }

  try {
    const parsed = new URL(url)
    for (const key of ['addon', 'manifest', 'transportUrl', 'addonUrl']) {
      const paramVal = parsed.searchParams.get(key)
      if (paramVal && paramVal !== url) {
        return normalizeStremioAddonUrl(paramVal, depth + 1)
      }
    }

    if (parsed.hash && parsed.hash.includes('?')) {
      const hashQuery = parsed.hash.slice(parsed.hash.indexOf('?'))
      const hashParams = new URLSearchParams(hashQuery)
      for (const key of ['addon', 'manifest', 'transportUrl', 'addonUrl']) {
        const paramVal = hashParams.get(key)
        if (paramVal && paramVal !== url) {
          return normalizeStremioAddonUrl(paramVal, depth + 1)
        }
      }
    }

    parsed.hash = ''
    let pathname = parsed.pathname.replace(/\/+$/, '')
    if (/\/configure(\.html)?$/i.test(pathname)) {
      pathname = pathname.replace(/\/configure(\.html)?$/i, '/manifest.json')
    } else if (!/\/manifest\.json$/i.test(pathname)) {
      pathname = (pathname ? pathname : '') + '/manifest.json'
    }
    parsed.pathname = pathname
    return parsed.toString()
  } catch {
    if (!url.endsWith('/manifest.json')) {
      url = url.replace(/\/+$/, '') + '/manifest.json'
    }
    return url
  }
}


async function revalidateWithStremio(movieId) {
  await migrateLibrary()
  return withLibraryWrite(async () => {
    const movies = (await ghost.storage.get('movies')) || []
    if (!movies.length) return { movies: [], updatedCount: 0 }

    let targetGroups = []
    if (movieId) {
      const targetMovie = movies.find(
        (m) => m.id === movieId || m.filePath === movieId
      )
      if (!targetMovie) return { movies, updatedCount: 0 }
      const groupKey = mediaGroupKey(targetMovie)
      targetGroups.push({
        groupKey,
        items: movies.filter((m) => mediaGroupKey(m) === groupKey)
      })
    } else {
      const groupMap = new Map()
      for (const m of movies) {
        const k = mediaGroupKey(m)
        if (!groupMap.has(k)) groupMap.set(k, [])
        groupMap.get(k).push(m)
      }
      for (const [groupKey, items] of groupMap.entries()) {
        targetGroups.push({ groupKey, items })
      }
    }

    let updatedCount = 0
    const revision = nextArtworkRevision()

    for (const { items } of targetGroups) {
      const representative =
        items.find((m) => !m.artworkLocked && !m.customCoverUrl) || items[0]
      if (!representative) continue

      const isSeries =
        representative.isSeries ||
        items.some((m) => m.isSeries) ||
        ['series', 'anime', 'cartoon'].includes(representative.mediaCategory)
      const type = isSeries ? 'series' : 'movie'

      let imdbId = representative.imdbId
      if (!imdbId && representative.filePath) {
        const match = representative.filePath.match(/\[imdbid[-=](tt\d+)\]/i)
        if (match) imdbId = match[1]
      }

      let stremioMeta = null

      if (imdbId) {
        try {
          const res = await ghost.http.fetch(
            'https://v3-cinemeta.strem.io/meta/' + type + '/' + imdbId + '.json',
            { timeoutMs: 15000 }
          )
          if (res.ok) {
            const data = await res.json()
            if (data?.meta?.id) stremioMeta = data.meta
          }
        } catch (err) {
          ghost.warn(
            '[Alazterflix Stremio Revalidate] Falha ao consultar Cinemeta por ID ' +
              imdbId +
              ':',
            err.message || String(err)
          )
        }
      }

      if (!stremioMeta) {
        const rawTitle = isSeries
          ? representative.customShowTitle ||
            representative.showTitle ||
            representative.cleanTitle ||
            representative.title
          : representative.customTitle ||
            representative.cleanTitle ||
            representative.title

        const cleanQuery =
          cleanMovieTitleAndYear(rawTitle || representative.fileName).title ||
          rawTitle
        if (cleanQuery && cleanQuery.trim()) {
          try {
            const searchRes = await ghost.http.fetch(
              'https://v3-cinemeta.strem.io/catalog/' +
                type +
                '/top/search=' +
                encodeURIComponent(cleanQuery.trim()) +
                '.json',
              { timeoutMs: 15000 }
            )
            if (searchRes.ok) {
              const searchData = await searchRes.json()
              const metas = Array.isArray(searchData?.metas)
                ? searchData.metas
                : []
              if (metas.length > 0) {
                const targetYear = representative.year
                let chosen = metas.find((m) => {
                  const normM = normalizeMediaTitle(m.name || '')
                  const normQ = normalizeMediaTitle(cleanQuery)
                  const yearMatch =
                    !targetYear ||
                    !m.releaseInfo ||
                    m.releaseInfo.includes(String(targetYear))
                  return normM === normQ && yearMatch
                })
                if (!chosen) {
                  chosen = metas[0]
                }
                if (chosen?.id) {
                  const metaRes = await ghost.http.fetch(
                    'https://v3-cinemeta.strem.io/meta/' +
                      type +
                      '/' +
                      chosen.id +
                      '.json',
                    { timeoutMs: 15000 }
                  )
                  if (metaRes.ok) {
                    const data = await metaRes.json()
                    if (data?.meta?.id) stremioMeta = data.meta
                  }
                }
              }
            }
          } catch (err) {
            ghost.warn(
              '[Alazterflix Stremio Revalidate] Falha ao buscar no Cinemeta por "' +
                cleanQuery +
                '":',
              err.message || String(err)
            )
          }
        }
      }

      if (!stremioMeta) continue

      let savedPoster = null
      let savedBackdrop = null
      const directory = isSeries ? representative.showDirectory : undefined
      const canUpdateArtwork =
        !representative.artworkLocked && !representative.customCoverUrl

      if (canUpdateArtwork && stremioMeta.poster) {
        try {
          savedPoster = await ghost.media.saveArtwork(
            representative.filePath,
            stremioMeta.poster,
            'poster',
            directory,
            items.some(
              (m) =>
                (m.artworkLocked || m.customCoverUrl) &&
                m.localCoverPath === representative.localCoverPath
            )
          )
        } catch (err) {
          ghost.warn(
            '[Alazterflix Stremio Revalidate] Erro ao salvar pôster para ' +
              representative.title +
              ':',
            err.message || String(err)
          )
        }
      }

      if (!representative.artworkLocked && stremioMeta.background) {
        try {
          savedBackdrop = await ghost.media.saveArtwork(
            representative.filePath,
            stremioMeta.background,
            'backdrop',
            directory
          )
        } catch (err) {
          ghost.warn(
            '[Alazterflix Stremio Revalidate] Erro ao salvar backdrop para ' +
              representative.title +
              ':',
            err.message || String(err)
          )
        }
      }

      let groupModified = false
      const officialName = stremioMeta.name || representative.title
      const officialRating = stremioMeta.imdbRating
        ? String(stremioMeta.imdbRating)
        : representative.rating
      const officialGenres =
        Array.isArray(stremioMeta.genres) && stremioMeta.genres.length
          ? stremioMeta.genres
          : representative.genres
      const officialDesc =
        stremioMeta.description || representative.synopsis
      const officialYear =
        parseInt(stremioMeta.year || stremioMeta.releaseInfo, 10) ||
        representative.year
      const videos = Array.isArray(stremioMeta.videos)
        ? stremioMeta.videos
        : []

      for (const item of items) {
        if (!item.artworkLocked && !item.customCoverUrl) {
          if (savedPoster?.localPath) {
            item.localCoverPath = savedPoster.localPath
            item.coverUrl = localArtworkUrl(savedPoster.localPath, revision)
            item.artworkRevision = revision
            item.artworkLanguage = 'stremio'
            item.hasLocalArtwork = true
            groupModified = true
          } else if (stremioMeta.poster && !item.coverUrl) {
            item.coverUrl = stremioMeta.poster
            item.artworkLanguage = 'stremio'
            groupModified = true
          }

          if (savedBackdrop?.localPath) {
            item.localBackdropPath = savedBackdrop.localPath
            item.backdropUrl = localArtworkUrl(
              savedBackdrop.localPath,
              revision
            )
            item.artworkRevision = revision
            groupModified = true
          } else if (stremioMeta.background && !item.backdropUrl) {
            item.backdropUrl = stremioMeta.background
            groupModified = true
          }
        }

        if (!item.metadataLocked) {
          if (isSeries) {
            item.showTitle = officialName
            item.customShowTitle = officialName

            if (
              videos.length &&
              item.season !== undefined &&
              item.episode !== undefined
            ) {
              const epMatch = videos.find(
                (v) =>
                  Number(v.season) === Number(item.season) &&
                  (Number(v.episode) === Number(item.episode) ||
                    Number(v.number) === Number(item.episode))
              )
              if (epMatch?.name) {
                item.cleanTitle = epMatch.name
                item.title =
                  'S' +
                  String(item.season).padStart(2, '0') +
                  'E' +
                  String(item.episode).padStart(2, '0') +
                  ' - ' +
                  epMatch.name
                item.customTitle = item.title
              }
              if (epMatch?.description) {
                item.episodeOverview = epMatch.description
              }
              if (epMatch?.thumbnail) {
                item.episodeThumbnail = epMatch.thumbnail
              }
            }
          } else {
            item.title = officialName
            item.cleanTitle = officialName
            item.customTitle = officialName
          }

          if (officialDesc) item.synopsis = officialDesc
          if (officialGenres) item.genres = officialGenres
          if (officialRating) item.rating = officialRating
          if (officialYear) item.year = officialYear
          groupModified = true
        }

        item.metadataProvider = 'stremio'
        item.metadataId = stremioMeta.id
        item.imdbId = stremioMeta.id
        item.metadataStatus = 'matched'
        item.lastMetadataAttempt = new Date().toISOString()
      }

      if (groupModified) {
        updatedCount++
      }
    }

    if (updatedCount > 0) {
      await saveMovies(movies)
    }

    return { movies, updatedCount }
  })
}

const mediaProvider = {
  async getState() {
    await migrateLibrary()
    const folders = (await ghost.storage.get('folders')) || []
    const movies = (await ghost.storage.get('movies')) || []
    const available = new Map()
    for (const movie of movies)
      if (movie.localCoverPath) {
        if (!available.has(movie.localCoverPath))
          available.set(
            movie.localCoverPath,
            await ghost.media.artworkExists(movie.localCoverPath)
          )
        movie.artworkMissing = !available.get(movie.localCoverPath)
      }
    const addons = await this.stremioGetAddons()
    return {
      isPluginActive: true,
      folders,
      movies,
      addons,
      playbackHistory: (await ghost.storage.get('playback_history')) || {},
      metadataSettings: await metadataSettings(),
      metadataJob: jobStatus()
    }
  },

  async getMovies() {
    const movies = (await ghost.storage.get('movies')) || []
    return movies
  },

  async scanFolders(foldersToScan, options = {}) {
    await migrateLibrary()
    const isFullScan = Boolean(options.fullScan)
    const settings = await metadataSettings()
    const shouldSkipMetadata =
      options.skipMetadata !== undefined
        ? Boolean(options.skipMetadata)
        : (!isFullScan && !settings.autoFetch)

    const movies = await withLibraryWrite(async () => {
      const currentSettings = await metadataSettings()
      const titleSource = currentSettings.titleSource || 'file'
      const folders =
        foldersToScan || (await ghost.storage.get('folders')) || []
      if (!folders.length) {
        await saveMovies([])
        return []
      }
      const existing = (await ghost.storage.get('movies')) || []
      const history = (await ghost.storage.get('playback_history')) || {}

      const norm = (p) => (p || '').replace(/\\/g, '/').toLowerCase()
      const inside = (path, folder) => {
        const nPath = norm(path)
        const nFolder = norm(folder).replace(/\/+$/, '')
        return nPath.startsWith(nFolder + '/')
      }

      // Mapeamento de existentes por caminho exato normalizado
      const existingByPath = new Map(existing.map((m) => [norm(m.filePath), m]))

      // Conjunto de existentes não associados para detecção de arquivos movidos/renomeados
      const unmatchedExisting = new Map(existing.map((m) => [m.id, m]))

      // Índices auxiliares para reconexão precisa de arquivos movidos
      const byFileNameAndSize = new Map()
      const byFileName = new Map()
      const bySeriesSig = new Map()

      for (const m of existing) {
        const fn = (m.fileName || (m.filePath ? m.filePath.split(/[\\/]/).pop() : '') || '').toLowerCase()
        if (fn) {
          const fnSizeKey = `${fn}:${m.fileSizeBytes || ''}`
          if (!byFileNameAndSize.has(fnSizeKey)) byFileNameAndSize.set(fnSizeKey, [])
          byFileNameAndSize.get(fnSizeKey).push(m)

          if (!byFileName.has(fn)) byFileName.set(fn, [])
          byFileName.get(fn).push(m)
        }

        const showKey = normalizeMediaTitle(m.showTitle || m.cleanTitle || m.title || '')
        if (m.isSeries && m.season !== undefined && m.episode !== undefined && showKey) {
          const sig = `${showKey}:S${m.season}:E${m.episode}`
          if (!bySeriesSig.has(sig)) bySeriesSig.set(sig, [])
          bySeriesSig.get(sig).push(m)
        }
      }

      const successfullyScannedFolders = new Set()
      const scannedFiles = []

      for (const folder of folders) {
        try {
          const files = await ghost.media.scanFolder(folder)
          successfullyScannedFolders.add(norm(folder))
          for (const file of files) {
            scannedFiles.push(file)
          }
        } catch (error) {
          ghost.warn(
            'Pasta indisponível; preservando o catálogo de ' +
              folder +
              ': ' +
              error.message
          )
        }
      }

      // Deduplica arquivos escaneados pelo caminho normalizado
      const uniqueFilesMap = new Map()
      for (const f of scannedFiles) {
        const nf = norm(f.path)
        if (!uniqueFilesMap.has(nf)) {
          uniqueFilesMap.set(nf, f)
        }
      }

      const collected = new Map()

      for (const file of uniqueFilesMap.values()) {
        const nf = norm(file.path)
        const h = parseMediaHierarchy(file.path, file.name, { titleSource })

        let movie = existingByPath.get(nf)

        if (movie) {
          // Correspondência exata: arquivo permanece no mesmo caminho
          unmatchedExisting.delete(movie.id)
          movie = {
            ...movie,
            filePath: file.path,
            fileName: file.name,
            fileSize: formatBytes(file.size),
            fileSizeBytes: file.size
          }
          if (!movie.artworkLocked && !movie.customCoverUrl) {
            if (file.localPoster && (!movie.localCoverPath || !movie.coverUrl)) {
              movie.localCoverPath = file.localPoster
              movie.coverUrl = localArtworkUrl(
                file.localPoster,
                movie.artworkRevision
              )
            }
            if (file.localBackdrop && (!movie.localBackdropPath || !movie.backdropUrl)) {
              movie.localBackdropPath = file.localBackdrop
              movie.backdropUrl = localArtworkUrl(
                file.localBackdrop,
                movie.artworkRevision
              )
            }
          }
          movie.hasLocalArtwork = Boolean(movie.localCoverPath)
          collected.set(nf, movie)
        } else {
          // Arquivo não está no caminho original: verificar se foi MOVIDO ou RENOMEADO
          let matched = null
          const fn = file.name.toLowerCase()
          const fnSizeKey = `${fn}:${file.size}`

          // 1. Prioridade 1: Mesmo nome de arquivo e mesmo tamanho em bytes
          const c1 = byFileNameAndSize.get(fnSizeKey)
          if (c1) {
            matched = c1.find((c) => unmatchedExisting.has(c.id))
          }

          // 2. Prioridade 2: Mesmo nome de arquivo
          if (!matched) {
            const c2 = byFileName.get(fn)
            if (c2) {
              matched = c2.find((c) => unmatchedExisting.has(c.id))
            }
          }

          // 3. Prioridade 3: Assinatura de série (obra + temporada + episódio)
          if (!matched && h.isSeries && h.season !== undefined && h.episode !== undefined) {
            const showKey = normalizeMediaTitle(h.showTitle || h.cleanTitle || '')
            if (showKey) {
              const sig = `${showKey}:S${h.season}:E${h.episode}`
              const c3 = bySeriesSig.get(sig)
              if (c3) {
                matched = c3.find((c) => unmatchedExisting.has(c.id))
              }
            }
          }

          if (matched) {
            // Reconexão de arquivo movido: preserva metadados, capas, notas e histórico de reprodução
            unmatchedExisting.delete(matched.id)
            movie = {
              ...matched,
              filePath: file.path,
              fileName: file.name,
              fileSize: formatBytes(file.size),
              fileSizeBytes: file.size,
              container: file.name
                .slice(file.name.lastIndexOf('.') + 1)
                .toLowerCase(),
              showDirectory: h.showDir || matched.showDirectory || undefined
            }
            if (!movie.metadataLocked) {
              if (h.season !== undefined && movie.customSeason === undefined) movie.season = h.season
              if (h.episode !== undefined && movie.customEpisode === undefined) movie.episode = h.episode
              if (h.isSeries !== undefined && movie.customIsSeries === undefined) movie.isSeries = h.isSeries
              if (h.mediaCategory && !movie.customCategory) movie.mediaCategory = h.mediaCategory
            }
            if (!movie.artworkLocked && !movie.customCoverUrl) {
              if (file.localPoster) {
                movie.localCoverPath = file.localPoster
                movie.coverUrl = localArtworkUrl(
                  file.localPoster,
                  movie.artworkRevision
                )
              }
              if (file.localBackdrop) {
                movie.localBackdropPath = file.localBackdrop
                movie.backdropUrl = localArtworkUrl(
                  file.localBackdrop,
                  movie.artworkRevision
                )
              }
            }
            movie.hasLocalArtwork = Boolean(movie.localCoverPath)
            collected.set(nf, movie)
          } else {
            // Novo arquivo real adicionado
            movie = {
              id: stableMovieId(file.path),
              title: h.cleanTitle,
              cleanTitle: h.cleanTitle,
              year: h.year,
              filePath: file.path,
              fileName: file.name,
              fileSize: formatBytes(file.size),
              fileSizeBytes: file.size,
              resolution: h.resolution,
              container: file.name
                .slice(file.name.lastIndexOf('.') + 1)
                .toLowerCase(),
              season: h.season,
              episode: h.episode,
              isSeries: h.isSeries,
              mediaCategory: h.mediaCategory,
              showTitle: h.showTitle,
              showDirectory: h.showDir || undefined,
              isSpecial: h.isSpecial,
              addedAt: file.birthtime || new Date().toISOString(),
              source: 'local',
              genres: []
            }
            if (file.localPoster) {
              movie.localCoverPath = file.localPoster
              movie.coverUrl = localArtworkUrl(
                file.localPoster,
                movie.artworkRevision
              )
            }
            if (file.localBackdrop) {
              movie.localBackdropPath = file.localBackdrop
              movie.backdropUrl = localArtworkUrl(
                file.localBackdrop,
                movie.artworkRevision
              )
            }
            movie.hasLocalArtwork = Boolean(movie.localCoverPath)
            if (history[movie.id]) {
              const saved = history[movie.id]
              movie.progressSeconds = saved.progressSeconds
              movie.duration = saved.durationSeconds
              movie.lastWatchedAt = saved.lastWatched
              movie.isWatched =
                saved.isWatched ??
                (movie.manualWatched === true ||
                  (movie.duration > 0 &&
                    movie.progressSeconds >= movie.duration * 0.95))
            }
            collected.set(nf, movie)
          }
        }
      }

      // Preserva existentes de pastas que NÃO foram escaneadas (ex: pastas offline ou não informadas)
      for (const remaining of unmatchedExisting.values()) {
        const wasInScannedFolder = folders.some((f) =>
          successfullyScannedFolders.has(norm(f)) && inside(remaining.filePath, f)
        )
        if (!wasInScannedFolder) {
          collected.set(norm(remaining.filePath), remaining)
        }
      }

      const catalog = autoCatalogMovies(Array.from(collected.values()), {
        titleSource
      }).cataloged
      await saveMovies(catalog)
      return catalog
    })

    if (!shouldSkipMetadata) {
      await refreshMetadata('missing')
    }
    return movies
  },

  async revalidatePaths(foldersToScan) {
    return this.scanFolders(foldersToScan, { skipMetadata: true })
  },

  async fullScan(foldersToScan) {
    const folders = foldersToScan || (await ghost.storage.get('folders')) || []
    if (folders.length > 0) {
      return this.scanFolders(folders, { fullScan: true })
    }
    await migrateLibrary()
    return withLibraryWrite(async () => {
      const currentSettings = await metadataSettings()
      const titleSource = currentSettings.titleSource || 'file'
      const movies = (await ghost.storage.get('movies')) || []
      const catalog = autoCatalogMovies(movies, { titleSource }).cataloged
      await saveMovies(catalog)
      await refreshMetadata('missing')
      return catalog
    })
  },

  async updateMovie(updatedMovie, options = {}) {
    await migrateLibrary()
    return withLibraryWrite(async () => {
      const movies = (await ghost.storage.get('movies')) || []
      const current = movies.find((m) => m.id === updatedMovie.id)
      if (!current)
        throw new Error(
          'Este vídeo não está mais na biblioteca. Atualize a página.'
        )
      const oldGroup = mediaGroupKey(current)
      const merged = { ...current }
      const fields = [
        'title',
        'customTitle',
        'showTitle',
        'mediaCategory',
        'customCategory',
        'categories',
        'customCategories',
        'isSeries',
        'customIsSeries',
        'customSeason',
        'customEpisode',
        'season',
        'episode',
        'year',
        'resolution',
        'synopsis',
        'genres',
        'metadataLocked',
        'artworkLocked',
        'metadataProvider',
        'metadataId',
        'imdbId',
        'rating',
        'tmdbRating'
      ]
      for (const key of fields)
        if (Object.prototype.hasOwnProperty.call(updatedMovie, key))
          merged[key] = updatedMovie[key]
      if (Object.prototype.hasOwnProperty.call(updatedMovie, 'tmdbRating')) {
        merged.tmdbRating =
          updatedMovie.tmdbRating !== null &&
          updatedMovie.tmdbRating !== undefined &&
          !isNaN(Number(updatedMovie.tmdbRating))
            ? Number(updatedMovie.tmdbRating)
            : null
        merged.rating =
          merged.tmdbRating !== null ? merged.tmdbRating.toFixed(1) : undefined
      } else if (Object.prototype.hasOwnProperty.call(updatedMovie, 'rating')) {
        const cleanRating = String(updatedMovie.rating || '')
          .trim()
          .replace(',', '.')
        const numRating = cleanRating !== '' ? Number(cleanRating) : null
        merged.tmdbRating =
          numRating !== null &&
          !isNaN(numRating) &&
          numRating >= 0 &&
          numRating <= 10
            ? numRating
            : null
        merged.rating =
          merged.tmdbRating !== null ? merged.tmdbRating.toFixed(1) : undefined
      } else if (
        merged.metadataProvider === 'tmdb' &&
        merged.metadataId &&
        (merged.metadataId !== current.metadataId ||
          current.metadataProvider !== 'tmdb' ||
          current.tmdbRating === undefined)
      ) {
        const metadata = await metadataDetails({
          provider: 'tmdb',
          id: merged.metadataId,
          type: merged.isSeries ? 'series' : 'movie'
        })
        merged.tmdbRating =
          metadata.rating === undefined ? null : Number(metadata.rating)
        merged.rating = metadata.rating
      } else if (
        merged.metadataProvider !== 'tmdb' &&
        current.tmdbRating === undefined
      ) {
        merged.tmdbRating = null
      }
      if (
        !['movie', 'series', 'anime', 'cartoon', 'documentary', 'ova', 'tv'].includes(
          merged.mediaCategory
        )
      )
        throw new Error('Categoria inválida.')
      for (const key of ['season', 'episode', 'year'])
        if (
          merged[key] !== undefined &&
          merged[key] !== null &&
          (!Number.isInteger(merged[key]) || merged[key] < 0)
        )
          throw new Error(
            'Preencha números válidos para ano, temporada e episódio.'
          )
      if (!merged.title?.trim()) throw new Error('Informe o título da mídia.')
      merged.customTitle = merged.title.trim()
      merged.customShowTitle = merged.showTitle
      merged.customCategory = merged.mediaCategory

      if (Array.isArray(updatedMovie.categories)) {
        merged.categories = updatedMovie.categories.filter((c) =>
          ['movie', 'series', 'anime', 'cartoon', 'documentary', 'ova', 'tv'].includes(c)
        )
        if (merged.categories.length === 0) {
          merged.categories = [merged.mediaCategory]
        }
        merged.customCategories = [...merged.categories]
      } else if (!merged.categories || merged.categories.length === 0) {
        merged.categories = [merged.mediaCategory]
        merged.customCategories = [merged.mediaCategory]
      }

      // Se o usuário explicitamente marcou que não é série (isSeries === false), respeitar fielmente!
      if (updatedMovie.isSeries === false || updatedMovie.customIsSeries === false) {
        merged.isSeries = false
        merged.customIsSeries = false
        merged.season = undefined
        merged.episode = undefined
        merged.customSeason = null
        merged.customEpisode = null
        merged.isSpecial = false
      } else if (
        updatedMovie.isSeries === true ||
        merged.episode !== undefined ||
        merged.season !== undefined ||
        ['series'].includes(merged.mediaCategory)
      ) {
        merged.isSeries = true
        merged.customIsSeries = true
      }
      merged.customIsSeries = merged.isSeries
      merged.customSeason = merged.season === undefined ? null : merged.season
      merged.customEpisode =
        merged.episode === undefined ? null : merged.episode
      if (!merged.isSeries) {
        merged.season = undefined
        merged.episode = undefined
        merged.isSpecial = false
      } else merged.isSpecial = merged.season === 0
      const isWorkGroup = !oldGroup.startsWith('file:')
      const propagate =
        options.applyToShow !== false &&
        (isWorkGroup ||
          (current.isSeries &&
            merged.isSeries &&
            merged.mediaCategory !== 'movie'))
      const revision = nextArtworkRevision()
      merged.artworkScope = propagate ? 'show' : 'item'
      merged.artworkLanguage = updatedMovie.artworkLanguage || 'local'
      merged.portuguesePosterUnavailable = false
      for (const [field, localField, type] of [
        ['coverUrl', 'localCoverPath', 'poster'],
        ['backdropUrl', 'localBackdropPath', 'backdrop']
      ]) {
        if (
          !Object.prototype.hasOwnProperty.call(updatedMovie, field) ||
          updatedMovie[field] === current[field]
        )
          continue
        if (!updatedMovie[field]) {
          if (type === 'poster') {
            throw new Error('Escolha uma imagem para substituir a capa.')
          }
          continue
        }
        // Se a imagem de fundo for idêntica à capa ou for link de poster vertical do IMDb, evitar gravação como backdrop
        if (
          type === 'backdrop' &&
          (updatedMovie[field] === updatedMovie.coverUrl ||
            (typeof updatedMovie[field] === 'string' &&
              /imdb\.com\/.*\/mediaviewer\/rm/i.test(updatedMovie[field])))
        ) {
          ghost.warn(
            'A imagem informada é um pôster vertical; ignorando gravação como imagem de fundo horizontal.'
          )
          continue
        }
        try {
          const saved = await ghost.media.saveArtwork(
            current.filePath,
            updatedMovie[field],
            type,
            propagate ? current.showDirectory : undefined,
            current.isSeries && !propagate,
            options?.deleteOldArtwork !== false && updatedMovie?.deleteOldArtwork !== false,
            type === 'poster' ? current.localCoverPath : current.localBackdropPath
          )
          if (saved?.localPath) {
            merged[localField] = saved.localPath
            merged[field] = localArtworkUrl(saved.localPath, revision)
            merged.artworkRevision = revision
            merged.artworkLocked = updatedMovie.artworkLocked !== false
            if (type === 'poster') merged.customCoverUrl = merged[field]
          }
        } catch (artworkError) {
          if (type === 'backdrop') {
            ghost.warn(
              'Aviso: não foi possível salvar imagem de fundo (' +
                artworkError.message +
                '). A capa e as informações foram preservadas com sucesso.'
            )
          } else {
            throw new Error(
              'Não foi possível salvar a nova capa: ' +
                (artworkError.message || 'formato de imagem inválido ou link inacessível.')
            )
          }
        }
      }
      merged.hasLocalArtwork = Boolean(merged.localCoverPath)
      if (merged.artworkLocked && merged.coverUrl)
        merged.customCoverUrl = merged.coverUrl
      if (!merged.artworkLocked) merged.customCoverUrl = undefined
      movies[movies.indexOf(current)] = merged
      if (propagate)
        for (const sibling of movies)
          if (sibling !== merged && mediaGroupKey(sibling) === oldGroup) {
            for (const key of [
              'coverUrl',
              'customCoverUrl',
              'backdropUrl',
              'localCoverPath',
              'localBackdropPath',
              'artworkRevision',
              'artworkLocked',
              'artworkScope',
              'artworkLanguage',
              'portuguesePosterUnavailable',
              'hasLocalArtwork',
              'showTitle',
              'customShowTitle',
              'mediaCategory',
              'customCategory',
              'categories',
              'customCategories',
              'isSeries',
              'customIsSeries',
              'metadataProvider',
              'metadataId',
              'imdbId',
              'rating',
              'tmdbRating'
            ])
              sibling[key] = merged[key]
            if (!merged.isSeries) {
              sibling.isSeries = false
              sibling.customIsSeries = false
              sibling.season = undefined
              sibling.episode = undefined
              sibling.customSeason = null
              sibling.customEpisode = null
              sibling.isSpecial = false
            }
            sibling.tmdbRating = merged.tmdbRating
            sibling.rating = merged.rating
          }
      await saveMovies(movies)
      return merged
    })
  },

  async enrichMovie(movieId) {
    await migrateLibrary()
    const movie = ((await ghost.storage.get('movies')) || []).find(
      (m) => m.id === movieId
    )
    if (!movie) return null
    const meta = await fetchMetadata(movie)
    if (!meta) {
      await markMetadataStatus(movieId, 'needs-identification')
      return null
    }
    return applyMetadata(movieId, meta, true)
  },

  async autoCatalog() {
    return this.fullScan()
  },
  revalidateWithStremio,
  searchMetadata,
  metadataDetails,
  refreshMetadata,
  async getMetadataStatus() {
    return jobStatus()
  },
  async cancelMetadataRefresh() {
    cancelMetadata = true
    return jobStatus()
  },
  async updateMetadataSettings(settings) {
    if (!['pt-BR', 'en-US', 'ja-JP'].includes(settings.language))
      throw new Error('Idioma inválido.')
    if (
      settings.titleSource &&
      !['file', 'folder'].includes(settings.titleSource)
    )
      throw new Error('Origem de título inválida.')
    const current = (await ghost.storage.get('metadata_settings')) || {}
    if (settings.tmdbToken !== undefined && settings.tmdbToken.trim()) {
      const check = await ghost.http.fetch(
        'https://api.themoviedb.org/3/configuration',
        {
          headers: { Authorization: 'Bearer ' + settings.tmdbToken.trim() },
          timeoutMs: 15000
        }
      )
      if (!check.ok)
        throw new Error(
          'O token de leitura TMDB não foi aceito (HTTP ' + check.status + ').'
        )
    }
    const prevTitleSource = current.titleSource || 'file'
    const newTitleSource = settings.titleSource || prevTitleSource
    await ghost.storage.set('metadata_settings', {
      ...current,
      autoFetch: settings.autoFetch !== false,
      language: settings.language,
      titleSource: newTitleSource,
      useStremioArtwork:
        settings.useStremioArtwork !== undefined
          ? Boolean(settings.useStremioArtwork)
          : current.useStremioArtwork === true,
      tmdbToken:
        settings.tmdbToken !== undefined
          ? settings.tmdbToken.trim()
          : current.tmdbToken
    })

    if (newTitleSource !== prevTitleSource) {
      await withLibraryWrite(async () => {
        const existing = (await ghost.storage.get('movies')) || []
        if (existing.length) {
          const { cataloged } = autoCatalogMovies(existing, {
            titleSource: newTitleSource,
            forceTitleUpdate: true
          })
          await saveMovies(cataloged)
        }
      })
    }
    return metadataSettings()
  },

  async addFolder(folderPath) {
    if (!folderPath) return this.getState()
    const folders = (await ghost.storage.get('folders')) || []
    if (!folders.includes(folderPath)) {
      folders.push(folderPath)
      await ghost.storage.set('folders', folders)
      await this.scanFolders(folders)
    }
    return this.getState()
  },

  async removeFolder(folderPath) {
    const folders = (await ghost.storage.get('folders')) || []
    const updated = folders.filter((f) => f !== folderPath)
    await ghost.storage.set('folders', updated)
    await withLibraryWrite(async () => {
      const movies = (await ghost.storage.get('movies')) || []
      const prefix =
        folderPath.replace(/\\/g, '/').toLowerCase().replace(/\/+$/, '') + '/'
      await saveMovies(
        movies.filter(
          (m) =>
            !m.filePath.replace(/\\/g, '/').toLowerCase().startsWith(prefix) ||
            updated.some((f) =>
              m.filePath
                .replace(/\\/g, '/')
                .toLowerCase()
                .startsWith(
                  f.replace(/\\/g, '/').toLowerCase().replace(/\/+$/, '') + '/'
                )
            )
        )
      )
    })
    return this.getState()
  },

  async updateMediaPreferences(movieIds, preferences) {
    if (
      !Array.isArray(movieIds) ||
      !movieIds.length ||
      movieIds.some((id) => typeof id !== 'string' || !id.trim())
    )
      throw new Error('Escolha vídeos válidos da biblioteca.')
    if (
      !preferences ||
      typeof preferences !== 'object' ||
      Array.isArray(preferences)
    )
      throw new Error('Preferências de mídia inválidas.')
    const hasRating = Object.prototype.hasOwnProperty.call(
      preferences,
      'userRating'
    )
    const hasWatched = Object.prototype.hasOwnProperty.call(
      preferences,
      'isWatched'
    )
    if (!hasRating && !hasWatched)
      throw new Error('Informe a nota ou o status assistido.')
    if (
      hasRating &&
      preferences.userRating !== null &&
      (typeof preferences.userRating !== 'number' ||
        !Number.isFinite(preferences.userRating) ||
        preferences.userRating < 0 ||
        preferences.userRating > 10)
    )
      throw new Error('Digite uma nota de 0 a 10.')
    if (hasWatched && typeof preferences.isWatched !== 'boolean')
      throw new Error('Status assistido inválido.')
    await migrateLibrary()
    await withLibraryWrite(async () => {
      const movies = (await ghost.storage.get('movies')) || []
      const ids = new Set(movieIds)
      const targets = movies.filter((movie) => ids.has(movie.id))
      if (targets.length !== ids.size)
        throw new Error(
          'Um vídeo não está mais na biblioteca. Atualize a página.'
        )
      const history = (await ghost.storage.get('playback_history')) || {}
      const now = new Date().toISOString()
      for (const movie of targets) {
        if (hasRating)
          movie.userRating =
            preferences.userRating === null ? undefined : preferences.userRating
        if (hasWatched) {
          movie.isWatched = preferences.isWatched
          movie.manualWatched = preferences.isWatched ? true : undefined
          const previous = history[movie.id] || history[movie.filePath] || {}
          const record = {
            ...previous,
            progressSeconds:
              previous.progressSeconds ?? movie.progressSeconds ?? 0,
            durationSeconds: previous.durationSeconds ?? movie.duration ?? 0,
            lastWatched: previous.lastWatched || movie.lastWatchedAt || now,
            isWatched: preferences.isWatched
          }
          history[movie.id] = record
          if (movie.filePath) history[movie.filePath] = record
        }
      }
      if (hasWatched) await ghost.storage.set('playback_history', history)
      await saveMovies(movies)
    })
    return this.getState()
  },

  async clearContinueWatching() {
    await migrateLibrary()
    await withLibraryWrite(async () => {
      const history = (await ghost.storage.get('playback_history')) || {}
      const movies = (await ghost.storage.get('movies')) || []
      for (const movie of movies) {
        const previous = history[movie.id] || history[movie.filePath] || {}
        const progressSeconds = previous.progressSeconds ?? movie.progressSeconds ?? 0
        const isWatched = previous.isWatched ?? movie.isWatched ?? false
        if (progressSeconds <= 0 || isWatched || previous.continueHidden) continue
        const record = {
          ...previous,
          progressSeconds,
          durationSeconds: previous.durationSeconds ?? movie.duration ?? 0,
          lastWatched: previous.lastWatched || movie.lastWatchedAt || '',
          isWatched,
          continueHidden: true
        }
        history[movie.id] = record
        if (movie.filePath) history[movie.filePath] = record
      }
      await ghost.storage.set('playback_history', history)
    })
    return this.getState()
  },

  async saveProgress(movieId, progressSeconds, durationSeconds) {
    await migrateLibrary()
    await withLibraryWrite(async () => {
      const history = (await ghost.storage.get('playback_history')) || {}
      const movies = (await ghost.storage.get('movies')) || []
      const movie = movies.find(
        (m) =>
          m.id === movieId ||
          m.filePath === movieId ||
          (m.filePath && stableMovieId(m.filePath) === movieId)
      )
      if (!movie) return
      const targetId = movie.id || movieId
      const nowIso = new Date().toISOString()
      const isWatched =
        movie.manualWatched === true ||
        (durationSeconds > 0 && progressSeconds >= durationSeconds * 0.95)
      const record = {
        progressSeconds,
        durationSeconds,
        lastWatched: nowIso,
        lastWatchedAt: nowIso,
        isWatched
      }
      history[targetId] = record
      if (movie.filePath && movie.filePath !== targetId) {
        history[movie.filePath] = record
      }
      await ghost.storage.set('playback_history', history)
      movie.progressSeconds = progressSeconds
      movie.duration = durationSeconds
      movie.lastWatchedAt = nowIso
      movie.isWatched = isWatched
      await saveMovies(movies)
    })
  },

  // Stremio Protocol v3 Implementations
  async stremioGetAddons() {
    let addons = await ghost.storage.get('addons')
    if (!addons || !Array.isArray(addons) || addons.length === 0) {
      addons = DEFAULT_ADDONS
      await ghost.storage.set('addons', addons)
    }
    return addons
  },


  async stremioAddAddon(manifestUrl) {
    try {
      let url = normalizeStremioAddonUrl(manifestUrl)

      ghost.log(`Consultando manifesto Stremio v3 em: ${url}`)
      const res = await ghost.http.fetch(url)
      if (!res.ok) {
        throw new Error(`O servidor do Addon respondeu HTTP ${res.status}`)
      }

      const manifest = await res.json()
      if (!manifest.id || !manifest.name || !manifest.version) {
        throw new Error(
          'Manifesto Stremio v3 inválido: campos id, name ou version ausentes.'
        )
      }

      const addon = {
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description || '',
        icon: manifest.icon || manifest.logo,
        background: manifest.background,
        manifestUrl: url,
        types: manifest.types || ['movie'],
        resources: manifest.resources || ['catalog', 'meta'],
        catalogs: manifest.catalogs || [],
        isEnabled: true
      }

      const addons = await this.stremioGetAddons()
      const existingIdx = addons.findIndex(
        (a) =>
          a.id === addon.id ||
          a.manifestUrl === addon.manifestUrl ||
          ((a.id === 'org.stremio.cinemeta' || a.id === 'com.linvo.cinemeta') &&
            (addon.id === 'org.stremio.cinemeta' || addon.id === 'com.linvo.cinemeta'))
      )
      if (existingIdx !== -1) {
        addons[existingIdx] = addon
      } else {
        addons.push(addon)
      }

      await ghost.storage.set('addons', addons)
      ghost.log(
        `Addon Stremio "${addon.name}" v${addon.version} instalado com sucesso!`
      )
      return { success: true, addon }
    } catch (err) {
      ghost.error('Falha ao instalar Addon Stremio:', err)
      return { success: false, error: err.message || String(err) }
    }
  },


  async stremioToggleAddon(addonId, isEnabled) {
    const addons = await this.stremioGetAddons()
    const target = addons.find((a) => a.id === addonId)
    if (target) {
      target.isEnabled = isEnabled !== undefined ? Boolean(isEnabled) : !target.isEnabled
      await ghost.storage.set('addons', addons)
      return { success: true, addon: target }
    }
    return { success: false, error: 'Addon não encontrado.' }
  },

  async stremioRemoveAddon(addonId) {
    const addons = await this.stremioGetAddons()
    const updated = addons.filter((a) => a.id !== addonId)
    await ghost.storage.set('addons', updated)
    return { success: true }
  },

  async stremioGetCatalog(
    addonId,
    type = 'movie',
    catalogId = 'top',
    skip = 0,
    search,
    extra = {}
  ) {
    try {
      const addons = await this.stremioGetAddons()
      const addon = addons.find(
        (a) =>
          a.id === addonId ||
          ((a.id === 'org.stremio.cinemeta' || a.id === 'com.linvo.cinemeta') &&
            (addonId === 'org.stremio.cinemeta' || addonId === 'com.linvo.cinemeta'))
      )
      if (!addon) throw new Error('Addon não encontrado.')

      const baseUrl = addon.manifestUrl.replace(/\/manifest\.json$/, '')

      const catDef = Array.isArray(addon.catalogs)
        ? addon.catalogs.find((c) => c.type === type && c.id === catalogId)
        : null

      const extraPairs = []

      if (search && search.trim()) {
        extraPairs.push(`search=${encodeURIComponent(search.trim())}`)
      }

      if (extra && typeof extra === 'object') {
        for (const [k, v] of Object.entries(extra)) {
          if (v !== undefined && v !== null && v !== '' && v !== 'all' && v !== 'Todos') {
            extraPairs.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
          }
        }
      }

      if (catDef && Array.isArray(catDef.extra)) {
        for (const ex of catDef.extra) {
          if (ex.isRequired && !extraPairs.some((p) => p.startsWith(`${ex.name}=`))) {
            const firstOpt = Array.isArray(ex.options) && ex.options.length > 0 ? ex.options[0] : ''
            if (firstOpt) {
              extraPairs.push(`${encodeURIComponent(ex.name)}=${encodeURIComponent(firstOpt)}`)
            }
          }
        }
      }

      if (skip && Number(skip) > 0) {
        extraPairs.push(`skip=${skip}`)
      }

      let url = `${baseUrl}/catalog/${type}/${catalogId}.json`
      if (extraPairs.length > 0) {
        url = `${baseUrl}/catalog/${type}/${catalogId}/${extraPairs.join('&')}.json`
      }

      ghost.log(`Buscando catálogo Stremio: ${url}`)
      const res = await ghost.http.fetch(url)
      if (!res.ok) return { metas: [] }

      const data = await res.json()
      return {
        metas: Array.isArray(data.metas) ? data.metas : [],
        hasMore: Array.isArray(data.metas) && data.metas.length >= 20
      }
    } catch (err) {
      ghost.error(`Erro ao consultar catálogo do addon ${addonId}:`, err)
      return { metas: [] }
    }
  },

  async stremioGetMeta(addonId, type = 'movie', id) {
    try {
      const addons = await this.stremioGetAddons()
      const addon = addons.find((a) => a.id === addonId) || addons[0]
      if (!addon) return null

      const baseUrl = addon.manifestUrl.replace(/\/manifest\.json$/, '')
      const url = `${baseUrl}/meta/${type}/${encodeURIComponent(id)}.json`

      const res = await ghost.http.fetch(url)
      if (!res.ok) return null
      const data = await res.json()
      return data.meta || null
    } catch (err) {
      ghost.error(`Erro ao consultar meta ${id}:`, err)
      return null
    }
  },

  async stremioGetStreams(type = 'movie', id) {
    try {
      const addons = await this.stremioGetAddons()
      // Filtra addons habilitados que fornecem o recurso 'stream'
      const streamAddons = addons.filter((a) => {
        if (!a.isEnabled) return false
        if (!a.resources) return false
        return a.resources.some((r) => {
          if (typeof r === 'string') return r === 'stream'
          return r && r.name === 'stream'
        })
      })

      ghost.log(
        `Buscando streams para ${type}/${id} em ${streamAddons.length} addon(s)...`
      )
      const allStreams = []

      for (const addon of streamAddons) {
        try {
          const baseUrl = addon.manifestUrl.replace(/\/manifest\.json$/, '')
          const streamId = encodeURIComponent(id).replace(/%3A/gi, ':')
          const url = `${baseUrl}/stream/${type}/${streamId}.json`
          const res = await ghost.http.fetch(url)
          if (res.ok) {
            const data = await res.json()
            if (Array.isArray(data?.streams)) {
              for (const s of data.streams) {
                // Formata qualidade a partir do título/name
                let quality = 'HD'
                const fullText = `${s.name || ''} ${s.title || ''}`
                if (/4k|2160p/i.test(fullText)) quality = '4K'
                else if (/1080p/i.test(fullText)) quality = '1080p'
                else if (/720p/i.test(fullText)) quality = '720p'

                let magnetUrl = s.magnetUrl
                if (!magnetUrl && s.infoHash) {
                  magnetUrl = `magnet:?xt=urn:btih:${s.infoHash}`
                }

                allStreams.push({
                  ...s,
                  magnetUrl,
                  addonName: addon.name,
                  quality,
                  details: s.title || s.name || 'Stream direto'
                })
              }
            }
          }
        } catch (err) {
          ghost.warn(`Falha ao obter streams de ${addon.name}: ${err?.message || String(err)}`)
        }
      }

      return allStreams
    } catch (err) {
      ghost.error(`Erro ao buscar streams para ${id}:`, err)
      return []
    }
  },

  async stremioGetSubtitles(type = 'movie', id) {
    try {
      const addons = await this.stremioGetAddons()
      const subAddons = addons.filter((a) => {
        if (!a.isEnabled) return false
        if (!a.resources) return false
        return a.resources.some((r) => {
          if (typeof r === 'string') return r === 'subtitles'
          return r && r.name === 'subtitles'
        })
      })

      ghost.log(
        `Buscando legendas para ${type}/${id} em ${subAddons.length} addon(s)...`
      )
      const allSubs = []

      for (const addon of subAddons) {
        try {
          const baseUrl = addon.manifestUrl.replace(/\/manifest\.json$/, '')
          const subId = encodeURIComponent(id).replace(/%3A/gi, ':')
          const url = `${baseUrl}/subtitles/${type}/${subId}.json`
          const res = await ghost.http.fetch(url)
          if (res.ok) {
            const data = await res.json()
            if (Array.isArray(data?.subtitles)) {
              for (const s of data.subtitles) {
                allSubs.push({
                  id: s.id || `${addon.id}_${s.lang || 'unk'}_${s.url}`,
                  name: `${s.lang ? s.lang.toUpperCase() + ' - ' : ''}${addon.name || 'Stremio'}`,
                  lang: s.lang || 'pt',
                  streamUrl: s.url,
                  addonName: addon.name,
                  source: 'stremio'
                })
              }
            }
          }
        } catch (err) {
          ghost.warn(`Falha ao obter legendas de ${addon.name}:`, err)
        }
      }

      return allSubs
    } catch (err) {
      ghost.error(`Erro ao buscar legendas para ${id}:`, err)
      return []
    }
  },

  async getSubtitleSettings() {
    return (
      (await ghost.storage.get('subtitle_settings')) || {
        position: 78,
        delay: 0,
        fontSize: '24px',
        color: '#ffffff',
        bgStyle: 'shadow'
      }
    )
  },

  async saveSubtitleSettings(settings) {
    const current = (await ghost.storage.get('subtitle_settings')) || {}
    const updated = { ...current, ...settings }
    await ghost.storage.set('subtitle_settings', updated)
    return updated
  }
}

// Injeção de tema Cyber Neon para Alazterflix
ghost.ui.injectCSS(`
  :root {
    --alazterflix-red: #e50914;
    --alazterflix-red-glow: 0 0 16px rgba(229, 9, 20, 0.5);
    --alazterflix-cyan: #00ffff;
    --alazterflix-cyan-glow: 0 0 16px rgba(0, 255, 255, 0.4);
    --alazterflix-card-bg: rgba(14, 20, 32, 0.85);
  }
`)

// Registra o provedor de mídia no host do Ghost
ghost.media.registerMediaProvider(mediaProvider)

ghost.log('Alazterflix Plugin carregado com 100% de sucesso!')

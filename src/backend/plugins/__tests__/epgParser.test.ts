import {
  parseXmltvDate,
  formatTime,
  calculateProgress,
  normalizeChannelName,
  parseXmltv,
  matchChannelWithEpg,
  resolveChannelPrograms
} from '../../../common/epgParser'
import type { GhostEpgChannel, GhostTvChannel } from '../../../common/types/plugins'

describe('XMLTV (EPG) Guide Parser & Matcher Engine', () => {
  const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<tv generator-info-name="GhostXMLTV">
  <channel id="globo.sp">
    <display-name>TV Globo SP</display-name>
    <icon src="https://example.com/globo.png"/>
  </channel>
  <channel id="sbt.hd">
    <display-name>SBT São Paulo</display-name>
    <icon src="https://example.com/sbt.png"/>
  </channel>
  <channel id="espn.br">
    <display-name>ESPN Brasil</display-name>
  </channel>

  <!-- Passado -->
  <programme start="20261027060000 -0300" stop="20261027083000 -0300" channel="globo.sp">
    <title lang="pt">Bom Dia SP</title>
    <desc lang="pt">Noticiário matinal de São Paulo.</desc>
    <category lang="pt">Jornalismo</category>
  </programme>

  <!-- No ar (08:30 às 12:00) -->
  <programme start="20261027083000 -0300" stop="20261027120000 -0300" channel="globo.sp">
    <title lang="pt">Bom Dia Brasil</title>
    <desc lang="pt">Notícias nacionais.</desc>
    <category lang="pt">Jornalismo</category>
  </programme>

  <!-- A seguir (12:00 às 13:00) -->
  <programme start="20261027120000 -0300" stop="20261027130000 -0300" channel="globo.sp">
    <title lang="pt">Globo Esporte</title>
    <desc lang="pt">Os gols da rodada.</desc>
    <category lang="pt">Esporte</category>
  </programme>
</tv>`

  describe('parseXmltvDate & formatTime', () => {
    it('converte data XMLTV com fuso horário em timestamp UTC correto', () => {
      const ts = parseXmltvDate('20261027120000 +0000')
      expect(new Date(ts).toISOString()).toBe('2026-10-27T12:00:00.000Z')
    })

    it('converte data XMLTV com offset negativo (-0300)', () => {
      const ts = parseXmltvDate('20261027083000 -0300')
      expect(new Date(ts).toISOString()).toBe('2026-10-27T11:30:00.000Z')
    })

    it('formata timestamp em horário legível HH:MM', () => {
      const ts = new Date('2026-10-27T14:45:00').getTime()
      expect(formatTime(ts)).toBe('14:45')
    })
  })

  describe('calculateProgress', () => {
    it('retorna 0% se o programa ainda não começou', () => {
      expect(calculateProgress(1000, 2000, 500)).toBe(0)
    })

    it('retorna 100% se o programa já terminou', () => {
      expect(calculateProgress(1000, 2000, 2500)).toBe(100)
    })

    it('calcula porcentagem proporcional exata quando em andamento', () => {
      expect(calculateProgress(1000, 2000, 1500)).toBe(50)
      expect(calculateProgress(1000, 2000, 1750)).toBe(75)
    })
  })

  describe('normalizeChannelName', () => {
    it('remove tags de qualidade (FHD, 4K), acentos e símbolos para comparação limpa', () => {
      expect(normalizeChannelName('TV Globo SP [FHD]')).toBe('globosp')
      expect(normalizeChannelName('SBT São Paulo (HD)')).toBe('sbtsaopaulo')
    })
  })

  describe('parseXmltv', () => {
    it('extrai canais e programas com metadados e ícones', () => {
      const parsed = parseXmltv(sampleXml)
      expect(parsed.channels).toHaveLength(3)
      expect(parsed.channels[0]).toEqual({
        id: 'globo.sp',
        displayName: 'TV Globo SP',
        icon: 'https://example.com/globo.png'
      })
      expect(parsed.programs).toHaveLength(3)
      expect(parsed.programs[1].title).toBe('Bom Dia Brasil')
      expect(parsed.programs[1].category).toBe('Jornalismo')
    })
  })

  describe('matchChannelWithEpg (Algoritmo padrão TiviMate)', () => {
    const epgChannels: GhostEpgChannel[] = [
      { id: 'globo.sp', displayName: 'TV Globo SP' },
      { id: 'sbt.hd', displayName: 'SBT São Paulo' },
      { id: 'espn.br', displayName: 'ESPN Brasil' },
      { id: 'hbo.family', displayName: 'HBO Family' }
    ]

    it('Passo 1: casa tvg-id do M3U com channel id do XML', () => {
      const channel: GhostTvChannel = {
        id: 'tv-1',
        name: 'Canal Sem Nome',
        url: 'http://stream.m3u8',
        group: 'Geral',
        tvgId: 'globo.sp',
        sourceType: 'm3u'
      }
      const matched = matchChannelWithEpg(channel, epgChannels)
      expect(matched?.id).toBe('globo.sp')
      expect(matched?.displayName).toBe('TV Globo SP')
    })

    it('Passo 2: se tvg-id falhar ou não existir, casa nome do M3U com display-name do XML', () => {
      const channel: GhostTvChannel = {
        id: 'tv-2',
        name: 'SBT São Paulo [FHD]',
        url: 'http://stream.m3u8',
        group: 'Abertos',
        sourceType: 'm3u'
      }
      const matched = matchChannelWithEpg(channel, epgChannels)
      expect(matched?.id).toBe('sbt.hd')
    })

    it('Passo 2b: se tvg-id falhar, casa nome do M3U com channel id do XML', () => {
      const channel: GhostTvChannel = {
        id: 'tv-3',
        name: 'espn.br',
        url: 'http://stream.m3u8',
        group: 'Esportes',
        sourceType: 'm3u'
      }
      const matched = matchChannelWithEpg(channel, epgChannels)
      expect(matched?.id).toBe('espn.br')
    })

    it('Passo 3: se falhar, retorna null para permitir ao usuário usar Atribuir EPG', () => {
      const channel: GhostTvChannel = {
        id: 'tv-4',
        name: 'Canal Misterioso X',
        url: 'http://stream.m3u8',
        group: 'Geral',
        sourceType: 'm3u'
      }
      const matched = matchChannelWithEpg(channel, epgChannels)
      expect(matched).toBeNull()
    })

    it('Passo 0: atribuição manual (Atribuir EPG) tem prioridade soberana', () => {
      const channel: GhostTvChannel = {
        id: 'tv-4',
        name: 'Canal Misterioso X',
        url: 'http://stream.m3u8',
        group: 'Geral',
        sourceType: 'm3u'
      }
      const manualAssignments = { 'tv-4': 'hbo.family' }
      const matched = matchChannelWithEpg(channel, epgChannels, manualAssignments)
      expect(matched?.id).toBe('hbo.family')
      expect(matched?.displayName).toBe('HBO Family')
    })
  })

  describe('resolveChannelPrograms', () => {
    it('identifica corretamente o programa atual no ar e o próximo', () => {
      const parsed = parseXmltv(sampleXml)
      // Testamos no horário das 09:00 (-0300) do dia 27/10/2026:
      const testNow = parseXmltvDate('20261027090000 -0300')
      const result = resolveChannelPrograms('globo.sp', parsed.programs, testNow)

      expect(result.currentProgram?.title).toBe('Bom Dia Brasil')
      expect(result.currentProgram?.startFormatted).toBe('08:30')
      expect(result.currentProgram?.stopFormatted).toBe('12:00')
      expect(result.currentProgram?.progressPercent).toBeGreaterThan(0)
      expect(result.nextProgram?.title).toBe('Globo Esporte')
      expect(result.schedule).toHaveLength(3)
    })
  })
})

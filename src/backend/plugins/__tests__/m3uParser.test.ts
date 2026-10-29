import { parseM3u, isSafeStreamUrl } from '../../../common/m3uParser'

describe('Safe M3U & M3U8 Playlist Parser & Security Engine', () => {
  describe('isSafeStreamUrl', () => {
    it('aceita URLs legítimas http e https de streaming e hls', () => {
      expect(isSafeStreamUrl('http://live.example.com/stream.m3u8')).toBe(true)
      expect(isSafeStreamUrl('https://edge.iptv.com/live/globo/index.m3u8')).toBe(true)
      expect(isSafeStreamUrl('http://127.0.0.1:8080/live/channel.ts')).toBe(true)
    })

    it('rejeita esquemas perigosos e de execução local', () => {
      expect(isSafeStreamUrl('file:///C:/Windows/System32/cmd.exe')).toBe(false)
      expect(isSafeStreamUrl('javascript:alert(document.cookie)')).toBe(false)
      expect(isSafeStreamUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
      expect(isSafeStreamUrl('vbscript:msgbox(1)')).toBe(false)
      expect(isSafeStreamUrl('\\\\malicious-server\\share\\exploit.exe')).toBe(false)
      expect(isSafeStreamUrl('cmd.exe /c calc.exe')).toBe(false)
    })

    it('bloqueia executáveis disfarçados em URLs HTTP/HTTPS', () => {
      expect(isSafeStreamUrl('http://malicious-site.com/payload.exe')).toBe(false)
      expect(isSafeStreamUrl('https://evil.org/malware.bat')).toBe(false)
      expect(isSafeStreamUrl('http://shady.net/virus.ps1')).toBe(false)
      expect(isSafeStreamUrl('https://hack.xyz/trojan.scr')).toBe(false)
      expect(isSafeStreamUrl('http://bad.com/setup.msi')).toBe(false)
    })
  })

  describe('parseM3u', () => {
    it('realiza parsing de canais com metadados completos (tvg-logo, tvg-name, group-title)', () => {
      const sampleM3u = `
#EXTM3U
#EXTINF:-1 tvg-id="Globo.br" tvg-name="TV Globo HD" tvg-logo="https://logos.com/globo.png" group-title="Canais Abertos",TV Globo São Paulo
http://live.stream.globo.com/live/sp.m3u8
#EXTINF:-1 tvg-id="ESPN.br" tvg-name="ESPN Brasil" tvg-logo="https://logos.com/espn.png" group-title="Esportes",ESPN Brasil
https://live.espn.com/hls/brasil/index.m3u8
#EXTINF:0 group-title="Notícias",CNN Brasil
https://stream.cnnbrasil.com.br/live.m3u8
      `

      const result = parseM3u(sampleM3u, { playlistId: 'teste-1' })
      expect(result.totalCount).toBe(3)
      expect(result.channels).toHaveLength(3)

      const globo = result.channels[0]
      expect(globo.name).toBe('TV Globo São Paulo')
      expect(globo.logo).toBe('https://logos.com/globo.png')
      expect(globo.group).toBe('Canais Abertos')
      expect(globo.url).toBe('http://live.stream.globo.com/live/sp.m3u8')
      expect(globo.sourceType).toBe('m3u8')
      expect(globo.playlistId).toBe('teste-1')

      const espn = result.channels[1]
      expect(espn.name).toBe('ESPN Brasil')
      expect(espn.group).toBe('Esportes')

      const cnn = result.channels[2]
      expect(cnn.name).toBe('CNN Brasil')
      expect(cnn.group).toBe('Notícias')

      expect(result.groups).toEqual(['Canais Abertos', 'Esportes', 'Notícias'])
    })

    it('descarta automaticamente links maliciosos sem travar ou infectar o sistema', () => {
      const hostileM3u = `
#EXTM3U
#EXTINF:-1 tvg-name="Canal Seguro",Canal Seguro
https://legit.stream/live.m3u8
#EXTINF:-1 tvg-name="Exploit File",Exploit File
file:///C:/Windows/explorer.exe
#EXTINF:-1 tvg-name="Malware Executavel",Vírus Download
http://attacker.com/malware.exe
#EXTINF:-1 tvg-name="Script Injection",XSS
javascript:window.open('http://hack.com')
      `

      const result = parseM3u(hostileM3u)
      expect(result.totalCount).toBe(1)
      expect(result.channels).toHaveLength(1)
      expect(result.channels[0].name).toBe('Canal Seguro')
      expect(result.channels[0].url).toBe('https://legit.stream/live.m3u8')
    })

    it('suporta atributos sem aspas e diretiva #EXTGRP', () => {
      const m3uWithExtgrp = `
#EXTM3U
#EXTGRP:Variedades
#EXTINF:-1 tvg-name=Discovery,Discovery Channel
http://stream.discovery.com/live.m3u8
      `

      const result = parseM3u(m3uWithExtgrp)
      expect(result.totalCount).toBe(1)
      expect(result.channels[0].name).toBe('Discovery Channel')
      expect(result.channels[0].group).toBe('Variedades')
    })

    it('suporta pipe syntax e #EXTVLCOPT para cabeçalhos IPTV (User-Agent e Referer)', () => {
      const m3uWithHeaders = `
#EXTM3U
#EXTINF:-1 tvg-name="Canal Pipe",Canal Pipe
https://stream.server.com/live.m3u8|User-Agent=CustomUA%2F1.0&Referer=https%3A%2F%2Fiptv.com
#EXTINF:-1 tvg-name="Canal VLC",Canal VLC
#EXTVLCOPT:http-user-agent=VlcPlayer/3.0
#EXTVLCOPT:http-referrer=https://referrer.org
http://vlc.stream.com/live.ts
      `

      const result = parseM3u(m3uWithHeaders)
      expect(result.totalCount).toBe(2)
      expect(result.channels[0].url).toBe('https://stream.server.com/live.m3u8')
      expect(result.channels[0].customHeaders).toEqual({
        'User-Agent': 'CustomUA/1.0',
        Referer: 'https://iptv.com'
      })

      expect(result.channels[1].url).toBe('http://vlc.stream.com/live.ts')
      expect(result.channels[1].customHeaders).toEqual({
        'User-Agent': 'VlcPlayer/3.0',
        Referer: 'https://referrer.org'
      })
    })
  })
})

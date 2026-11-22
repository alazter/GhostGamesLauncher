# 🛡️ Relatório de Auditoria Sênior (4ª Rodada) — Guia de Aplicação Cirúrgica para o Ajudante

> **⚠️ REGRAS OBRIGATÓRIAS PARA O AJUDANTE ANTES DE EDITAR QUALQUER ARQUIVO:**
> 1. **ZERO REGRESSÃO (PROIBIDO APAGAR FUNCIONALIDADES)**: NUNCA remova funções, botões, eventos, variáveis, rotas ou lógicas existentes. O comportamento visual, o layout e as funções atuais do Ghost Games Launcher devem continuar funcionando **100% iguais** após qualquer edição.
> 2. **EDIÇÕES CIRÚRGICAS (NÃO REESCREVA ARQUIVOS INTEIROS)**: Altere **APENAS** as linhas estritamente necessárias indicadas em cada item abaixo. É terminantemente proibido usar comentários preguiçosos como `// ... resto do código aqui`.
> 3. **REGRA CANÔNICA 62 (INTOCABILIDADE DAS CAPAS DA BIBLIOTECA)**: NUNCA altere o tamanho, largura, altura ou proporção (`aspect-ratio: 173/275`) das capas da Biblioteca.
> 4. **VALIDAÇÃO FINAL OBRIGATÓRIA**: Após aplicar as 12 correções, execute `pnpm run codecheck` e os testes unitários (`pnpm test`) para comprovar `0 erros` TypeScript e `100%` dos testes passando, e registre na `alterações.md` seguindo a Regra Canônica 197.

---

## 🔴 PRIORIDADE 1 — Crítico (Segurança, Credenciais e Isolamento)

### Correção 1: Validação de Domínio e Sanitização de Nome no Atualizador do Launcher
- **Arquivo**: `src/backend/main.ts` (linhas ~1285 a 1375)
- **Pilar**: 4 (Segurança e Vulnerabilidades)
- **O que está errado e risco na prática**: A função `downloadLauncherUpdate` usa `path.join(installDir, selectedAsset.name)` sem sanitizar barras (`../`) e baixa qualquer URL passada em `selectedAsset.browser_download_url`, executando o arquivo `.exe` logo em seguida (`shell.openPath(destPath)`).
- **Onde substituir (`src/backend/main.ts`, por volta da linha 1320)**:

**Localizar:**
```ts
  const destPath = path.join(installDir, selectedAsset.name)

  try {
    await downloadFile({
      url: selectedAsset.browser_download_url,
      dest: destPath,
```

**Substituir por:**
```ts
  const safeAssetName = path.basename(String(selectedAsset.name || ''))
  if (!safeAssetName.toLowerCase().endsWith('.exe')) {
    return { success: false, error: 'Nome de arquivo de atualização inválido.' }
  }
  let parsedDownloadUrl: URL
  try {
    parsedDownloadUrl = new URL(String(selectedAsset.browser_download_url || ''))
  } catch {
    return { success: false, error: 'URL de atualização inválida.' }
  }
  const allowedUpdateHosts = [
    'github.com',
    'objects.githubusercontent.com',
    'release-assets.githubusercontent.com'
  ]
  if (
    parsedDownloadUrl.protocol !== 'https:' ||
    !allowedUpdateHosts.some(
      (h) =>
        parsedDownloadUrl.hostname === h ||
        parsedDownloadUrl.hostname.endsWith(`.${h}`)
    )
  ) {
    return { success: false, error: 'Domínio de atualização não autorizado.' }
  }

  const destPath = path.join(installDir, safeAssetName)

  try {
    await downloadFile({
      url: parsedDownloadUrl.href,
      dest: destPath,
```

---

### Correção 2: Criptografia `safeStorage` para Cookie de Sessão (`steamLoginSecure`) e API Key da Steam + Sandbox no Modal
- **Arquivos**:
  - `src/backend/storeManagers/steam/electronStores.ts` (linhas ~1 a 26)
  - `src/backend/storeManagers/steam/authModal.ts` (linhas ~18 a 75)
  - `src/backend/main.ts` (linhas ~1004 a 1025)
  - `src/backend/storeManagers/steam/library.ts` (linhas ~95 a 96)
- **Pilar**: 4 (Segurança e Vulnerabilidades) + 1 (Proteção de SSD)
- **O que está errado e risco na prática**: O cookie de sessão `sessionCookie` e a `apiKey` da Steam são gravados em texto puro em `steam_store/config.json`. Além disso, `SteamAuthModal` não define `sandbox: true` nem bloqueia popups, e faz múltiplas gravações separadas no `configStore`.
- **Onde substituir**:

**2A. Em `src/backend/storeManagers/steam/electronStores.ts`, adicionar ao final do arquivo:**
```ts
import { safeStorage } from 'electron'

export function encryptSteamSecret(plainText: string): string {
  const trimmed = plainText.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('enc:')) return trimmed
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return `enc:${safeStorage.encryptString(trimmed).toString('base64')}`
    }
  } catch {}
  return trimmed
}

export function decryptSteamSecret(stored: string): string {
  if (!stored || typeof stored !== 'string') return ''
  if (!stored.startsWith('enc:')) return stored
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const buf = Buffer.from(stored.slice(4), 'base64')
      return safeStorage.decryptString(buf)
    }
  } catch {}
  return ''
}
```

**2B. Em `src/backend/storeManagers/steam/authModal.ts` (linhas ~3 e ~18 a 75):**
```ts
// Atualizar import na linha 3:
import { configStore, encryptSteamSecret } from './electronStores'

// Na criação da BrowserWindow (linhas ~18-28), incluir sandbox e bloqueio de popup:
      let resolved = false
      const finish = (val: boolean) => {
        if (resolved) return
        resolved = true
        resolve(val)
      }

      this.authWindow = new BrowserWindow({
        width: 1024,
        height: 720,
        title: 'Conectar com a Steam',
        autoHideMenuBar: true,
        webPreferences: {
          sandbox: true,
          nodeIntegration: false,
          contextIsolation: true
        }
      })
      this.authWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

// Em checkAuthCookies (linhas ~39-55), criptografar sessionCookie e gravar em lote:
          if (loginSecure && loginSecure.value) {
            logInfo('Steam login session cookie captured successfully', LogPrefix.Steam)
            const account = await SteamUser.getDetectedAccount()
            ;(configStore as any).set({
              sessionCookie: encryptSteamSecret(loginSecure.value),
              syncMode: 'webView',
              isLoggedIn: true,
              ...(account
                ? {
                    username: account.personaName,
                    steamId: account.steamId64,
                    steamId32: account.steamId32
                  }
                : {})
            })
            if (this.authWindow && !this.authWindow.isDestroyed()) {
              this.authWindow.close()
            }
            finish(true)
            return true
          }

// No evento closed (linhas ~70-74):
      this.authWindow.on('closed', async () => {
        this.authWindow = null
        if (!resolved) {
          const isAuthed = await checkAuthCookies()
          finish(isAuthed)
        }
      })
```

**2C. Em `src/backend/main.ts` (linhas ~102 e ~1004 a 1025):**
```ts
// No import da linha 102:
import {
  configStore as steamConfigStore,
  encryptSteamSecret,
  decryptSteamSecret
} from './storeManagers/steam/electronStores'

// Nas linhas ~1004-1025:
addHandler('steamGetConfig', async () => ({
  syncMode: steamConfigStore.get('syncMode', 'all'),
  apiKey: decryptSteamSecret(steamConfigStore.get('apiKey', '')),
  hasSession: steamConfigStore.has('sessionCookie')
}))
addHandler('steamSaveConfig', async (_e, config) => {
  const updates: Record<string, any> = { isLoggedIn: true }
  if (config.syncMode) updates.syncMode = config.syncMode
  if (config.apiKey !== undefined) {
    if (config.apiKey && config.apiKey.trim()) {
      updates.apiKey = encryptSteamSecret(config.apiKey.trim())
    } else {
      steamConfigStore.delete('apiKey')
    }
  }
  const account = await SteamUser.getDetectedAccount()
  if (account) {
    updates.username = account.personaName
    updates.steamId = account.steamId64
    updates.steamId32 = account.steamId32
  }
  ;(steamConfigStore as any).set(updates)
})
```

**2D. Em `src/backend/storeManagers/steam/library.ts` (linhas ~8 e ~95-96):**
```ts
// No import da linha 8:
import { configStore, libraryStore, decryptSteamSecret } from './electronStores'

// Nas linhas ~95-96:
    const apiKey = decryptSteamSecret(configStore.get('apiKey', ''))
    const sessionCookie = decryptSteamSecret(configStore.get('sessionCookie', ''))
```

---

### Correção 3: Isolamento em `createNewWindow`, `execFile` no Registro `.GhostBackup` e `basename` em `showConfigFileInFolder` / `uninstaller.ts`
- **Arquivos**:
  - `src/backend/main.ts` (linhas ~731 a 740, ~1111 a 1116 e ~1677 a 1679)
  - `src/backend/utils/uninstaller.ts` (linhas ~80 a 99)
- **Pilar**: 4 (Segurança e Vulnerabilidades)
- **Onde substituir**:

**3A. Em `src/backend/main.ts` (linhas ~731 a 740 — registro de `.GhostBackup` sem `cmd.exe`):**
```ts
        // Registrar associação de arquivos .GhostBackup com o ícone oficial do Ghost
        try {
          const { execFile } = require('child_process')
          const appExe = process.execPath
          const regEntries: string[][] = [
            ['add', 'HKCU\\Software\\Classes\\.GhostBackup', '/ve', '/d', 'GhostGamesLauncher.Backup', '/f'],
            ['add', 'HKCU\\Software\\Classes\\GhostGamesLauncher.Backup', '/ve', '/d', 'Ghost Games Launcher Backup', '/f'],
            ['add', 'HKCU\\Software\\Classes\\GhostGamesLauncher.Backup\\DefaultIcon', '/ve', '/d', `${iconToUse},0`, '/f'],
            ['add', 'HKCU\\Software\\Classes\\GhostGamesLauncher.Backup\\shell\\open\\command', '/ve', '/d', `"${appExe}" "%1"`, '/f']
          ]
          for (const args of regEntries) {
            execFile('reg.exe', args, { windowsHide: true }, () => {})
          }
        } catch {}
```

**3B. Em `src/backend/main.ts` (linhas ~1111 a 1116 — sanitização de `appName`):**
```ts
addListener('showConfigFileInFolder', async (event, appName) => {
  if (appName === 'default') {
    return openUrlOrFile(configPath)
  }
  const safeAppName = path.basename(String(appName || ''))
  return openUrlOrFile(path.join(gamesConfigPath, `${safeAppName}.json`))
})
```

**3C. Em `src/backend/main.ts` (linhas ~1677 a 1679 — sandbox e validação de protocolo em `createNewWindow`):**
```ts
addListener('createNewWindow', (e, url) => {
  try {
    const parsed = new URL(String(url || ''))
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return
    new BrowserWindow({
      height: 700,
      width: 1200,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false
      }
    }).loadURL(parsed.href)
  } catch {}
})
```

**3D. Em `src/backend/utils/uninstaller.ts` (linhas ~16 e ~80 a 99 — sanitização com `basename`):**
```ts
// Na linha 16, importar basename junto com join:
import { basename, join } from 'path'

// Nas linhas ~80-99:
const removeFixFile = (appName: string, runner: Runner) => {
  const safeAppName = basename(String(appName || ''))
  const fixFilePath = join(fixesPath, `${safeAppName}-${storeMap[runner]}.json`)
  if (existsSync(fixFilePath)) {
    rmSync(fixFilePath)
  }
}

const removeSettingsAndLogs = (appName: string) => {
  const safeAppName = basename(String(appName || ''))
  const removeIfExists = (filename: string) => {
    logInfo(`Removing ${filename}`, LogPrefix.Backend)
    const gameSettingsFile = join(gamesConfigPath, filename)
    if (existsSync(gameSettingsFile)) {
      rmSync(gameSettingsFile)
    }
  }

  removeIfExists(safeAppName.concat('.json'))
  removeIfExists(safeAppName.concat('.log'))
  removeIfExists(safeAppName.concat('-lastPlay.log'))
}
```

---

### Correção 4: Proteção contra SSRF Completo (IPv6 / Loopback), Limite de Resposta em `NetworkGuard.safeFetch` e Reuso de `BlockList` em `secureDns.ts`
- **Arquivos**:
  - `src/backend/plugins/secureDns.ts` (linhas ~13 a 29)
  - `src/backend/plugins/networkGuard.ts` (linhas ~42 a 56, ~90 a 102 e ~261 a 285)
- **Pilar**: 4 (Segurança) e 2 (Uso de CPU/RAM)
- **Onde substituir**:

**4A. Em `src/backend/plugins/secureDns.ts` (linhas ~13 a 29):**
```ts
const BLOCKED_IPV4_LIST = (() => {
  const blocked = new BlockList()
  for (const [network, prefix] of [
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['100.64.0.0', 10],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16],
    ['172.16.0.0', 12],
    ['192.168.0.0', 16],
    ['224.0.0.0', 4],
    ['240.0.0.0', 4]
  ] as const) {
    blocked.addSubnet(network, prefix, 'ipv4')
  }
  return blocked
})()

export function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) return !BLOCKED_IPV4_LIST.check(address, 'ipv4')
  return isIP(address) === 6 && /^[23][0-9a-f]{3}:/i.test(address)
}
```

**4B. Em `src/backend/plugins/networkGuard.ts` (linhas ~42 a 56, ~90 a 102 e ~261 a 285):**
```ts
// 1. Em isPrivateIP (linhas ~42-56):
function isPrivateIP(ip: string): boolean {
  const cleanIp = ip.replace(/^\[|\]$/g, '')
  if (isIP(cleanIp)) {
    return !isPublicAddress(cleanIp)
  }
  // Check 10.x.x.x
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(cleanIp)) return true
  // Check 172.16-31.x.x
  const match172 = cleanIp.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/)
  if (match172) {
    const secondOctet = parseInt(match172[1], 10)
    if (secondOctet >= 16 && secondOctet <= 31) return true
  }
  // Check 192.168.x.x
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(cleanIp)) return true
  // Check Link-local 169.254.x.x
  if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(cleanIp)) return true
  return false
}

// 2. Em fetchWithCurl (linhas ~90-102), sanitizar CRLF em headers e adicionar windowsHide/timeout:
    for (const [k, v] of Object.entries(headers)) {
      const safeK = String(k).replace(/[\r\n]/g, '').trim()
      const safeV = String(v).replace(/[\r\n]/g, '').trim()
      if (safeK) args.push('-H', `${safeK}: ${safeV}`)
    }
    const addresses = await (await import('./secureDns')).resolvePublicHost(new URL(url).hostname)
    args.push('--resolve', `${new URL(url).hostname}:443:${addresses.map(item => item.family === 6 ? `[${item.address}]` : item.address).join(',')}`)
    args.push(url)

    return new Promise((resolve, reject) => {
      execFile(
        'curl.exe',
        args,
        { maxBuffer: 15 * 1024 * 1024, encoding: 'buffer', windowsHide: true, timeout: 25000 },
        (error, stdout) => {

// 3. Em safeFetch (linhas ~261-285), cancelar body no redirect e limitar resposta a 15 MB:
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const location = response.headers?.get?.('location')
          await response.body?.cancel().catch(() => {})
          if (!location) break
          if (hop === maxRedirects) {
            throw new Error('[GhostShield Network Violation]: Too many redirects')
          }
          const resolvedUrl = new URL(location, currentUrl).toString()
          const redirectCheck = this.validateUrl(resolvedUrl, manifest)
          if (!redirectCheck.allowed || !redirectCheck.parsedUrl) {
            throw new Error(`[GhostShield Network Violation]: Redirect blocked (${redirectCheck.reason})`)
          }
          currentUrl = redirectCheck.parsedUrl.toString()
          continue
        }
        break
      }

      if (!response) {
        throw new Error('Failed to fetch response')
      }

      const contentLength = Number(response.headers?.get?.('content-length') || 0)
      if (contentLength > 15 * 1024 * 1024) {
        await response.body?.cancel().catch(() => {})
        throw new Error('[GhostShield Network Violation]: Response exceeds 15 MB limit')
      }

      const text = await response.text()
      if (text.length > 15 * 1024 * 1024) {
        throw new Error('[GhostShield Network Violation]: Response exceeds 15 MB limit')
      }
```

---

## 🟠 PRIORIDADE 2 — Alto (Proteção de SSD / TBW e Prevenção de Gzip Bomb)

### Correção 5: Agrupamento de Escritas de `tsStore` Fora dos Loops (`steam/library.ts` e `main.ts`) e Cache de Arquivos `grid`
- **Arquivos**:
  - `src/backend/storeManagers/steam/library.ts` (linhas ~320 a 454)
  - `src/backend/main.ts` (linhas ~1474 a 1532)
- **Pilar**: 1 (Proteção de Disco SSD NVMe/SATA e I/O)
- **O que está errado e risco na prática**:
  - Em `steam/library.ts`, o loop de jogos chama `tsStore.set(...)` até 2 vezes por jogo (até 600 gravações no SSD em uma única sincronização!) e faz 3 chamadas `existsSync` por jogo na pasta `grid`.
  - Em `main.ts` (`importGhostBackup`), `Object.entries(backupData.playtimes).forEach` chama `tsStore.set` dentro do loop para cada jogo.
- **Onde substituir**:

**5A. Em `src/backend/storeManagers/steam/library.ts` (linhas ~319 a 455):**
```ts
    const finalGames: GameInfo[] = []
    const gridDir = join(userDir, 'config', 'grid')
    let gridFiles = new Set<string>()
    if (existsSync(gridDir)) {
      try {
        gridFiles = new Set(readdirSync(gridDir))
      } catch {}
    }
    const tsUpdates: Record<string, any> = {}

    for (const [appid, item] of ownedMap.entries()) {
      // ... (manter código existente das linhas 323 a 368 intacto) ...

      // Check local user grid covers (em memória via Set O(1))
      const localGridVertical = join(gridDir, `${appid}p.jpg`)
      const localGridPng = join(gridDir, `${appid}p.png`)
      const hasLocalGridJpg = gridFiles.has(`${appid}p.jpg`)
      const hasLocalGridPng = gridFiles.has(`${appid}p.png`)
      const hasLocalGrid = hasLocalGridJpg || hasLocalGridPng
      const localGridPath = hasLocalGridJpg ? localGridVertical : localGridPng

      // ... (manter código existente das linhas 375 a 415 intacto) ...

      if (playtimeData && playtimeData.playTime > 0) {
        const currentTs = tsStore.get_nodefault(appid) as { totalPlayed?: number } | undefined
        if (!currentTs || (currentTs.totalPlayed || 0) < playtimeData.playTime) {
          tsUpdates[`${appid}.totalPlayed`] = playtimeData.playTime
          if (lastPlayedDate) {
            tsUpdates[`${appid}.lastPlayed`] = lastPlayedDate
          }
        }
      }

      // ... (manter criação de game e finalGames.push(game)) ...
    }

    if (Object.keys(tsUpdates).length > 0) {
      ;(tsStore as any).set(tsUpdates)
    }
```

**5B. Em `src/backend/main.ts` (linhas ~1528 a 1532):**
```ts
    if (backupData.playtimes && typeof backupData.playtimes === 'object') {
      ;(tsStore as any).set(backupData.playtimes)
    }
```

---

### Correção 6: Supressão de Escritas Redundantes no SSD em `electron-store` (Backend e Preload), `CacheStore` do Frontend, `LegendaryUser` e `SteamUser`
- **Arquivos**:
  - `src/backend/electron_store.ts` (linhas ~80 a 90)
  - `src/preload/api/misc.ts` (linhas ~151 a 159)
  - `src/frontend/helpers/electronStores.ts` (linhas ~97 a 110)
  - `src/backend/storeManagers/legendary/user.ts` (linhas ~258 a 273)
  - `src/backend/storeManagers/steam/user.ts` (linhas ~245 a 256)
- **Pilar**: 1 (Proteção de Disco SSD NVMe/SATA e I/O)
- **Onde substituir**:

**6A. Em `src/backend/electron_store.ts` (linhas ~80 a 90):**
```ts
  public set<KeyType extends string>(
    key: KeyType,
    value: UnknownGuard<Get<StoreStructure[Name], KeyType>>
  ) {
    if (
      typeof key === 'string' &&
      (typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean') &&
      this.store.get(key) === value
    ) {
      return
    }
    this.store.set(key, value)
  }

  public delete<KeyType extends string>(key: KeyType) {
    if (!this.store.has(key)) return
    this.store.delete(key)
  }
```

**6B. Em `src/preload/api/misc.ts` (linhas ~151 a 159):**
```ts
export const storeSet = (storeName: string, key: string, value?: unknown) => {
  const s = stores[storeName]
  if (!s) return
  if (
    typeof key === 'string' &&
    (typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean') &&
    s.get(key) === value
  ) {
    return
  }
  s.set(key as any, value)
}

export const storeHas = (storeName: string, key: string) => stores[storeName]?.has(key) ?? false

export const storeGet = (storeName: string, key: string, defaultValue?: unknown) =>
  stores[storeName]?.get(key, defaultValue) ?? defaultValue

export const storeDelete = (storeName: string, key: string) => {
  const s = stores[storeName]
  if (!s || !s.has(key)) return
  s.delete(key as any)
}
```

**6C. Em `src/frontend/helpers/electronStores.ts` (linhas ~106 a 110):**
```ts
  public set(key: KeyType, value: ValueType) {
    window.api.storeSet(
      this.storeName,
      {
        [key]: value,
        [`__timestamp.${key}`]: Date()
      } as any
    )
  }
```

**6D. Em `src/backend/storeManagers/legendary/user.ts` (linhas ~266 a 273 — só gravar `userInfo` se mudou):**
```ts
      const info: UserInfo = {
        account_id: userInfoObject.account_id,
        displayName: userInfoObject.displayName,
        user: user().username
      }
      const existing = configStore.get_nodefault('userInfo')
      if (
        !existing ||
        existing.account_id !== info.account_id ||
        existing.displayName !== info.displayName ||
        existing.user !== info.user
      ) {
        configStore.set('userInfo', info)
      }
      return info
```

**6E. Em `src/backend/storeManagers/steam/user.ts` (linhas ~245 a 256 — consolidar escritas no logout):**
```ts
  public static async logout(): Promise<void> {
    configStore.delete('username')
    configStore.delete('steamId')
    configStore.delete('steamId32')
    configStore.delete('apiKey')
    configStore.delete('sessionCookie')
    ;(configStore as any).set({
      isLoggedIn: false,
      syncMode: 'all'
    })
    libraryStore.set('games', [])
    logInfo('Steam account disconnected and library cleared', LogPrefix.Steam)
  }
```

---

### Correção 7: Descompressão Assíncrona com Limite Anti-Gzip-Bomb (`maxOutputLength: 100 MB`) e Limite de Arquivo em EPG/M3U
- **Arquivo**: `src/backend/plugins/pluginManager.ts` (linhas ~1887 a 2089)
- **Pilar**: 2 (Uso de CPU/RAM) e 3 (Prevenção de Crashes)
- **O que está errado e risco na prática**: `cinemaTvReadEpgFile` e `cinemaTvFetchEpg` usam `zlib.gunzipSync(rawBuffer)` de forma síncrona na thread principal e sem `maxOutputLength`. Um arquivo `.xml.gz` grande ou corrompido congela a interface ou estoura a memória RAM (Gzip Bomb). Além disso, `cinemaTvReadM3uFile` e `cinemaTvReadEpgFile` não checam `fs.stat(filePath).size` antes de carregar o arquivo na RAM.
- **Onde substituir (`src/backend/plugins/pluginManager.ts`, linhas ~1900 a 2070)**:

```ts
// 1. Em cinemaTvReadM3uFile (logo antes de const content = await fs.readFile(filePath, 'utf-8')):
    const stat = await fs.stat(filePath)
    if (stat.size > 25 * 1024 * 1024) {
      throw new Error('Lista excede o tamanho máximo de segurança (25 MB).')
    }
    const content = await fs.readFile(filePath, 'utf-8')

// 2. Em cinemaTvFetchM3u (logo após const content = await response.text()):
      const content = await response.text()
      if (content.length > 25 * 1024 * 1024) {
        throw new Error('Lista excede o tamanho máximo de segurança (25 MB).')
      }

// 3. Em cinemaTvReadEpgFile (linhas ~2006-2016):
    const stat = await fs.stat(filePath)
    if (stat.size > 50 * 1024 * 1024) {
      throw new Error('Arquivo EPG excede o tamanho máximo de segurança (50 MB).')
    }
    const rawBuffer = await fs.readFile(filePath)
    let xmlContent = ''

    // Decompress asynchronously with 100 MB cap to prevent main-thread freeze & Gzip Bomb
    if (rawBuffer.length >= 2 && rawBuffer[0] === 0x1f && rawBuffer[1] === 0x8b) {
      const { promisify } = await import('util')
      const gunzipAsync = promisify(zlib.gunzip)
      const decompressed = await gunzipAsync(rawBuffer, {
        maxOutputLength: 100 * 1024 * 1024
      })
      xmlContent = decompressed.toString('utf-8')
    } else {
      xmlContent = rawBuffer.toString('utf-8')
    }

// 4. Em cinemaTvFetchEpg (linhas ~2063-2069):
      let xmlContent = ''
      if (rawBuffer.length >= 2 && rawBuffer[0] === 0x1f && rawBuffer[1] === 0x8b) {
        const { promisify } = await import('util')
        const gunzipAsync = promisify(zlib.gunzip)
        const decompressed = await gunzipAsync(rawBuffer, {
          maxOutputLength: 100 * 1024 * 1024
        })
        xmlContent = decompressed.toString('utf-8')
      } else {
        xmlContent = rawBuffer.toString('utf-8')
      }
```

---

### Correção 8: Deduplicação de Escrita em `PluginHost.saveStorage` e Supressão de Re-gravação no Boot em `AlazterflixTvHub`
- **Arquivos**:
  - `src/backend/plugins/pluginHost.ts` (linhas ~150 a 208)
  - `src/frontend/screens/Alazterflix/AlazterflixTvHub.tsx` (linhas ~112 a 176)
- **Pilar**: 1 (Proteção de Disco SSD NVMe/SATA e I/O)
- **Onde substituir**:

**8A. Em `src/backend/plugins/pluginHost.ts` (linhas ~150 a 208):**
```ts
  private storageCache: Record<string, any> | null = null
  private lastSavedSerialized: string | null = null
  // ...
  private loadStorage(): Record<string, any> {
    if (this.storageCache !== null) return this.storageCache
    try {
      if (existsSync(this.storageFilePath)) {
        const raw = readFileSync(this.storageFilePath, 'utf8').replace(/^\uFEFF/, '').trim()
        try {
          const parsed = raw ? JSON.parse(raw) : {}
          this.storageCache = parsed
          this.lastSavedSerialized = JSON.stringify(parsed, null, 2)
          return parsed
        } catch (parseErr) {
          logWarning(
            `[PluginHost:${this.manifest.id}] Corrupted storage JSON, resetting to empty object: ${parseErr}`,
            LogPrefix.Backend
          )
          return (this.storageCache = {})
        }
      }
    } catch (err) {
      logWarning(
        `[PluginHost:${this.manifest.id}] Failed to read storage file: ${err}`,
        LogPrefix.Backend
      )
      throw err
    }
    return (this.storageCache = {})
  }

  private saveStorage(data: Record<string, any>): void {
    this.storageCache = data
    const serialized = JSON.stringify(data, null, 2)
    if (serialized === this.lastSavedSerialized) return
    const temporary = `${this.storageFilePath}.tmp`
    try {
      writeFileSync(temporary, serialized, 'utf8')
      renameSync(temporary, this.storageFilePath)
      this.lastSavedSerialized = serialized
    } catch (err) {
      logError(
        [`[PluginHost:${this.manifest.id}] Failed to write storage file:`, err],
        LogPrefix.Backend
      )
      throw err
    } finally {
      if (existsSync(temporary)) unlinkSync(temporary)
    }
  }
```

**8B. Em `src/frontend/screens/Alazterflix/AlazterflixTvHub.tsx` (linhas ~1, ~112 a 180):**
```tsx
// Na linha 1, garantir que useRef está importado:
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'

// Nas linhas ~112 a 133, evitar regravar no disco quando o JSON for idêntico ao já carregado:
  const lastSavedPlaylistsRef = useRef<string>(
    localStorage.getItem(STORAGE_KEY_PLAYLISTS) || '[]'
  )
  const lastSavedChannelsRef = useRef<string>(
    localStorage.getItem(STORAGE_KEY_CHANNELS) || '[]'
  )

  useEffect(() => {
    try {
      const serialized = JSON.stringify(playlists)
      if (serialized === lastSavedPlaylistsRef.current) return
      lastSavedPlaylistsRef.current = serialized
      localStorage.setItem(STORAGE_KEY_PLAYLISTS, serialized)
      if (window.api?.cinemaTvSavePlaylists) {
        window.api.cinemaTvSavePlaylists(playlists).catch(() => {})
      }
    } catch (e) {
      console.error('[Alazterflix TV] Erro ao salvar playlists:', e)
    }
  }, [playlists])

  useEffect(() => {
    try {
      const serialized = JSON.stringify(channels)
      if (serialized === lastSavedChannelsRef.current) return
      lastSavedChannelsRef.current = serialized
      localStorage.setItem(STORAGE_KEY_CHANNELS, serialized)
      if (window.api?.cinemaTvSaveChannels) {
        window.api.cinemaTvSaveChannels(channels).catch(() => {})
      }
    } catch (e) {
      console.error('[Alazterflix TV] Erro ao salvar canais:', e)
    }
  }, [channels])

// E dentro de initFromBackend (linhas ~161 e ~175), atualizar as refs antes de setPlaylists/setChannels:
        if (loadedPlaylists.length > 0) {
          lastSavedPlaylistsRef.current = JSON.stringify(loadedPlaylists)
          setPlaylists(loadedPlaylists)
        }
        // ...
        if (loadedChannels.length > 0) {
          lastSavedChannelsRef.current = JSON.stringify(loadedChannels)
          setChannels(loadedChannels)
        }
```

---

### Correção 9: Caches em Memória RAM para `ensurePermanentAppIcon`, `parseAppInfoVdf`, `getMediaProvider` e `gameOverrides`
- **Arquivos**:
  - `src/backend/constants/paths.ts` (linhas ~87 a 118)
  - `src/backend/storeManagers/steam/library.ts` (linhas ~21 a 75)
  - `src/backend/plugins/pluginManager.ts` (linhas ~1818 a 1833)
  - `src/backend/game_overrides/index.ts` (linhas ~36 a 140)
- **Pilar**: 1 (Proteção de SSD) e 2 (Performance de CPU/RAM)
- **Onde substituir**:

**9A. Em `src/backend/constants/paths.ts` (linhas ~87 a 118):**
```ts
let cachedPermanentIconPath: string | null = null

export function ensurePermanentAppIcon(): string {
  if (!isWindows) {
    return windowIcon
  }

  if (cachedPermanentIconPath && existsSync(cachedPermanentIconPath)) {
    return cachedPermanentIconPath
  }

  const permanentIconPath = join(userDataPath, 'win_icon.ico')
  if (existsSync(permanentIconPath)) {
    try {
      if (require('fs').statSync(permanentIconPath).size > 0) {
        cachedPermanentIconPath = permanentIconPath
        return permanentIconPath
      }
    } catch {}
  }

  const possibleSources = [
    join(process.resourcesPath || '', 'app.asar.unpacked', 'build', 'win_icon.ico'),
    join(process.resourcesPath || '', 'app.asar.unpacked', 'public', 'win_icon.ico'),
    windowIcon,
    join(publicDir, 'win_icon.ico'),
    join(app.getAppPath(), 'public', 'win_icon.ico'),
    join(app.getAppPath(), 'build', 'win_icon.ico'),
    resolve(__dirname, '..', 'public', 'win_icon.ico'),
    resolve(__dirname, '../..', 'public', 'win_icon.ico')
  ]

  for (const src of possibleSources) {
    if (src && existsSync(src)) {
      try {
        require('fs').copyFileSync(src, permanentIconPath)
        cachedPermanentIconPath = permanentIconPath
        return permanentIconPath
      } catch {}
    }
  }

  if (existsSync(permanentIconPath)) {
    cachedPermanentIconPath = permanentIconPath
    return permanentIconPath
  }

  return process.execPath
}
```

**9B. Em `src/backend/storeManagers/steam/library.ts` (linhas ~1 e ~21 a 75 — cache `appinfo.vdf` por `mtimeMs`/`size` e `gameCache`):**
```ts
// Na linha 1, incluir statSync:
import { existsSync, readdirSync, readFileSync, statSync } from 'graceful-fs'

// Nas linhas ~21-75:
const APPID_MARKER = Buffer.from([0x02, 0x01, 0x00, 0x00, 0x00])
let cachedAppInfoVdf: {
  path: string
  mtimeMs: number
  size: number
  map: Map<string, { title: string; type: string }>
} | null = null

function parseAppInfoVdf(appinfoPath: string): Map<string, { title: string; type: string }> {
  const map = new Map<string, { title: string; type: string }>()
  if (!existsSync(appinfoPath)) return map

  try {
    const st = statSync(appinfoPath)
    if (
      cachedAppInfoVdf &&
      cachedAppInfoVdf.path === appinfoPath &&
      cachedAppInfoVdf.mtimeMs === st.mtimeMs &&
      cachedAppInfoVdf.size === st.size
    ) {
      return cachedAppInfoVdf.map
    }

    const buf = readFileSync(appinfoPath)
    // ... (manter loop regex existente das linhas 29 a 55) ...
    cachedAppInfoVdf = {
      path: appinfoPath,
      mtimeMs: st.mtimeMs,
      size: st.size,
      map
    }
  } catch (err) {
    logError(['Failed to parse appinfo.vdf', err], LogPrefix.Steam)
  }

  return map
}

export default class SteamLibraryManager implements LibraryManager {
  private readonly gameCache = new Map<string, SteamGame>()

  async init(): Promise<void> {
    await SteamUser.isLoggedIn()
  }

  getGame(id: string): SteamGame {
    const cached = this.gameCache.get(id)
    if (cached) return cached
    const game = new SteamGame(id)
    this.gameCache.set(id, game)
    return game
  }
```

**9C. Em `src/backend/plugins/pluginManager.ts` (linhas ~1818 a 1833 — fast-path via `this.hosts` sem varrer o disco):**
```ts
  public getMediaProvider(): MediaProvider | undefined {
    for (const id of ['com.ghost.alazterflix', 'com.ghost.cinema']) {
      if (this.pluginStates[id]?.enabled !== false) {
        const activeProvider = this.hosts.get(id)?.getMediaProvider()
        if (activeProvider) return activeProvider
      }
    }
    const plugin = this.getPlugins().find(
      (p) =>
        p.isEnabled &&
        (p.id === 'com.ghost.alazterflix' || p.id === 'com.ghost.cinema')
    )
    if (!plugin) return undefined
    return this.hosts.get(plugin.id)?.getMediaProvider()
  }

  public isCinemaPluginActive(): boolean {
    for (const id of ['com.ghost.alazterflix', 'com.ghost.cinema']) {
      if (this.hosts.has(id) && this.pluginStates[id]?.enabled !== false) {
        return true
      }
    }
    const plugin = this.getPlugins().find(
      (p) => p.id === 'com.ghost.alazterflix' || p.id === 'com.ghost.cinema'
    )
    return Boolean(plugin && plugin.isEnabled)
  }
```

**9D. Em `src/backend/game_overrides/index.ts` (linhas ~36 a 140 — cache em RAM `overridesMemoryCache`):**
```ts
let overridesMemoryCache: Record<string, GameMetadataOverride> | null = null

export function getGameOverrides(appName: string): GameMetadataOverride | null {
  try {
    const overrides = getAllGameOverrides()
    return overrides[appName] || null
  } catch {
    logError(`Failed to get overrides for ${appName}`, logPrefix)
    return null
  }
}

export function getAllGameOverrides(): Record<string, GameMetadataOverride> {
  if (overridesMemoryCache !== null) {
    return overridesMemoryCache
  }
  try {
    overridesMemoryCache = gameOverridesStore.get('overrides', {}) as Record<
      string,
      GameMetadataOverride
    >
    return overridesMemoryCache
  } catch {
    logError('Failed to get all overrides', logPrefix)
    return {}
  }
}
```
*(E atualizar `overridesMemoryCache = { ...currentOverrides }` em `setGameOverrides` e `overridesMemoryCache = { ...overrides }` em `setAllGameOverrides`).*

---

## 🟡 PRIORIDADE 3 — Médio (Performance de Interface, Timers e Rede)

### Correção 10: Eliminação de Re-renderização a Cada 2,5s e Loop `requestAnimationFrame` Ocioso no Alazterflix
- **Arquivo**: `src/frontend/screens/Alazterflix/index.tsx` (linhas ~2402 a 2470, ~3576 a 3612 e ~3964 a 4219)
- **Pilar**: 2 (Uso de CPU, RAM e Processos)
- **Onde substituir**:

**10A. Em `loadCinemaState` e no polling de `cinemaGetMetadataStatus` (linhas ~2402 a 2470):**
```tsx
  const metadataRevision = useRef<number | undefined>(undefined)

  // Fetch initial cinema state from backend plugin
  const loadCinemaState = useCallback(async () => {
    try {
      setLoading(true)
      const data = await window.api.cinemaGetState()
      metadataRevision.current = data?.metadataJob?.libraryRevision
      setState(
        data || {
          isPluginActive: false,
          folders: [],
          movies: [],
          addons: [],
          playbackHistory: {}
        }
      )
    } catch (err) {
      console.error('[Alazterflix] Falha ao carregar estado:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // No useEffect de polling (linhas ~2438-2470):
  const isMetadataJobRunning = state.metadataJob?.status === 'running'
  useEffect(() => {
    if (!state.isPluginActive || !isMetadataJobRunning) return
    let disposed = false
    let polling = false
    const poll = async () => {
      if (polling) return
      polling = true
      try {
        const job = await window.api.cinemaGetMetadataStatus()
        if (disposed) return
        if (metadataRevision.current !== job.libraryRevision) {
          const data = await window.api.cinemaGetState()
          if (disposed) return
          metadataRevision.current = data.metadataJob?.libraryRevision
          setState(data)
        } else {
          setState((previous) => {
            const prevJob = previous.metadataJob
            if (
              prevJob &&
              prevJob.status === job.status &&
              prevJob.processed === job.processed &&
              prevJob.updated === job.updated &&
              prevJob.total === job.total &&
              prevJob.currentTitle === job.currentTitle
            ) {
              return previous
            }
            return { ...previous, metadataJob: job }
          })
        }
      } catch (error) {
        if (!disposed)
          setCatalogFeedback(
            error instanceof Error
              ? error.message
              : 'Não foi possível acompanhar a atualização.'
          )
      } finally {
        polling = false
      }
    }
    const timer = setInterval(poll, 2500)
    return () => {
      disposed = true
      clearInterval(timer)
    }
  }, [state.isPluginActive, isMetadataJobRunning])
```

**10B. No Ticker de Legendas (linhas ~3576 a 3612 — pausar `requestAnimationFrame` quando o vídeo estiver pausado):**
```tsx
  useEffect(() => {
    const video = videoRef.current
    if (!video || !playerMovie) return

    let animId: number | null = null
    let active = true

    const stopLoop = () => {
      if (animId !== null) {
        cancelAnimationFrame(animId)
        animId = null
      }
    }

    const loop = () => {
      if (!active || video.paused || video.ended) {
        animId = null
        return
      }
      if (parsedCuesRef.current.length > 0) {
        updateActiveCue()
      }
      animId = requestAnimationFrame(loop)
    }

    const startLoop = () => {
      updateActiveCue()
      if (animId === null && !video.paused && !video.ended) {
        animId = requestAnimationFrame(loop)
      }
    }

    const syncNow = () => updateActiveCue()
    if (!video.paused && !video.ended) {
      startLoop()
    }

    video.addEventListener('timeupdate', syncNow)
    video.addEventListener('seeked', syncNow)
    video.addEventListener('seeking', syncNow)
    video.addEventListener('play', startLoop)
    video.addEventListener('pause', () => {
      stopLoop()
      syncNow()
    })
    video.addEventListener('ended', stopLoop)
    video.addEventListener('ratechange', syncNow)

    return () => {
      active = false
      stopLoop()
      video.removeEventListener('timeupdate', syncNow)
      video.removeEventListener('seeked', syncNow)
      video.removeEventListener('seeking', syncNow)
      video.removeEventListener('play', startLoop)
      video.removeEventListener('ended', stopLoop)
      video.removeEventListener('ratechange', syncNow)
    }
  }, [playerMovie?.streamUrl, updateActiveCue])
```

---

### Correção 11: Timeouts de 15s e Teto de 15 MB nas Consultas HTTPS da Steam (`SteamWebApi`)
- **Arquivo**: `src/backend/storeManagers/steam/webApi.ts` (linhas ~31 a 137)
- **Pilar**: 3 (Estabilidade e Prevenção de Falhas)
- **Onde substituir**:

```ts
// 1. Em fetchGamesByApiKey (linhas ~31-65):
    return new Promise((resolve) => {
      let settled = false
      const done = (val: SteamApiGame[]) => {
        if (settled) return
        settled = true
        resolve(val)
      }
      const req = https
        .get(
          url,
          { headers: { 'User-Agent': 'GhostLauncher/1.0' }, timeout: 15000 },
          (res) => {
            let rawData = ''
            res.on('data', (chunk) => {
              rawData += chunk
              if (rawData.length > 15 * 1024 * 1024) {
                req.destroy()
                done([])
              }
            })
            res.on('end', () => {
              try {
                const parsed = JSON.parse(rawData)
                const games = parsed?.response?.games
                if (Array.isArray(games)) {
                  const results: SteamApiGame[] = games.map((g: any) => ({
                    appId: g.appid.toString(),
                    title: (g.name || `Steam App ${g.appid}`).trim(),
                    playtimeForever: g.playtime_forever,
                    imgIconUrl: g.img_icon_url
                  }))
                  logInfo(
                    `Successfully fetched ${results.length} games via Steam Web API`,
                    LogPrefix.Steam
                  )
                  done(results)
                  return
                }
                done([])
              } catch (err) {
                logError(['Failed to parse Steam Web API response', err], LogPrefix.Steam)
                done([])
              }
            })
          }
        )
      req.on('timeout', () => {
        req.destroy()
        done([])
      })
      req.on('error', (err) => {
        logError(['Steam Web API network request failed', err], LogPrefix.Steam)
        done([])
      })
    })

// 2. Aplicar o mesmo padrão (timeout: 15000, req.on('timeout') e limite de 15 MB) em fetchGamesByWebSession (linhas ~84-137).
```

---

### Correção 12: Reset do Timer de Presença GOG, Fechamento de ZIP em Erro e Tetos FIFO em Caches de UI
- **Arquivos**:
  - `src/backend/storeManagers/gog/presence.ts` (linhas ~19, ~39 a 41 e ~68 a 70)
  - `src/backend/plugins/archiveSize.ts` (linhas ~21 a 35)
  - `src/frontend/components/UI/CachedImage/index.tsx` (linhas ~19 e ~142 a 145)
  - `src/backend/plugins/pluginHost.ts` (linhas ~349 a 352)
- **Pilar**: 2, 3 e 5 (Uso de RAM, Estabilidade e Manutenção)
- **Onde substituir**:

**12A. Em `src/backend/storeManagers/gog/presence.ts` (linhas ~19, ~39 a 41 e ~68 a 70):**
```ts
let CURRENT_GAME = ''
let interval: NodeJS.Timeout | undefined
// ...
    if (!interval) {
      interval = setInterval(setPresence, 5 * 60 * 1000)
      interval.unref?.()
    }
// ...
async function deletePresence(force = false, signal?: AbortSignal) {
  if (interval) {
    clearInterval(interval)
    interval = undefined
  }
```

**12B. Em `src/backend/plugins/archiveSize.ts` (linha ~22):**
```ts
          zip.on('error', (err) => {
            try {
              zip.close()
            } catch {}
            reject(err)
          })
```

**12C. Em `src/frontend/components/UI/CachedImage/index.tsx` (linhas ~142 a 145):**
```tsx
      onLoad={(e) => {
        if (isInView && displaySrc) {
          if (loadedUrls.size >= 5000) {
            const oldest = loadedUrls.values().next().value
            if (oldest) loadedUrls.delete(oldest)
          }
          loadedUrls.add(displaySrc)
          setLoaded(true)
        }
        props.onLoad?.(e)
      }}
```

**12D. Em `src/backend/plugins/pluginHost.ts` (linhas ~349 a 352 — validação e deduplicação em `setThemeVariable`):**
```ts
        setThemeVariable: (varName: string, value: string) => {
          const cleanVar = String(varName || '').trim()
          const cleanVal = String(value || '').trim()
          if (!/^--[a-zA-Z0-9_-]+$/.test(cleanVar) || /[{};<>]/.test(cleanVal)) {
            return
          }
          const prefix = `:root { ${cleanVar}:`
          this.dynamicCSS = this.dynamicCSS.filter((c) => !c.startsWith(prefix))
          this.dynamicCSS.push(`:root { ${cleanVar}: ${cleanVal} !important; }`)
        },
```

# SteamRIP / MegaDB: servidor final bloqueado

Relato em 13/10/2026, código local 0.3.2-beta. Página informada pelo usuário:
https://steamrip.com/iracing-arcade-free-download/.

## Evidência da tentativa real

Em `%LOCALAPPDATA%/Ghost/logs/ghost.log`, a tentativa do iRacing Arcade registrou:

```text
16:38:42 provider=steamrip event=navigation-status-200 host=steamrip.com
16:38:47 provider=steamrip event=navigation-status-200 host=megadb.net
16:39:01 provider=steamrip event=request-blocked-navigation host=fs4.megadb.xyz
```

Os domínios `megadb.net` e `megadb.co` já estavam permitidos. O servidor final
`fs4.megadb.xyz` não estava no manifesto de download, então o guardião de
navegação cancelava o acesso antes de receber um `DownloadItem`.

A mesma tarefa depois acessou GoFile e recebeu bytes antes de ser cancelada.
Isso não comprova transferência pelo MegaDB; são hospedagens diferentes.

## Correção

`directDownloadManifest(true)` em `src/backend/plugins/ankerAccount.ts` inclui
`fs4.megadb.xyz` somente na sessão de download SteamRIP, seguindo o padrão já
usado para o relay FileDitch. O domínio não foi adicionado à lista global de
espelhos, ao fluxo AnkerGames nem a uma permissão geral para `megadb.xyz`.

## Verificação

- Dois testes de regressão falharam antes da correção: validação do servidor e
  abertura da janela filha que entregaria o arquivo.
- 43 testes de `directBrowser`, `networkGuard` e `directDownloadRecovery`
  passaram depois da correção.
- O teste verifica requisição, navegação, redirecionamento e captura nativa de
  arquivo RAR, preservando POST/referrer. HTTP e domínios parecidos permanecem
  bloqueados no navegador.
- TypeScript e build verificam a compilação; a transferência real completa
  depois da correção ainda depende de repetir a tentativa no launcher.

## Online-Fix

O usuário também relatou falha no torrent do Online-Fix e informou que enviará
o link posteriormente. Não há causa confirmada para essa tentativa. O código
do Online-Fix não foi alterado nesta correção do MegaDB.

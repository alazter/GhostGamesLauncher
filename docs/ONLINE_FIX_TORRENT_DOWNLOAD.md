# Torrents Online-Fix e espera pelo TorBox

Investigação em 13/10/2026 sobre o fluxo de torrents de todos os jogos do
Online-Fix. A página do UNO foi usada como reprodução, sem regras por título.

## Causa confirmada

A página oficial apresenta o link
`https://uploads.online-fix.me:2053/torrents/UNO/`. Esse diretório contém
`UNO.Build.12012023-OFME.torrent`. A validação anterior usava `isSourceUrl`, que
recusa portas alternativas. O clique era bloqueado na porta 2053 antes de
capturar o arquivo. A tarefa real permaneceu em `transferPhase: torrent`, sem
hash nem ID TorBox, e terminou com timeout; ela não havia sido enviada à nuvem.

## Implementação geral

- Exceção HTTPS 2053 limitada a `uploads.online-fix.me`. Outras portas,
  credenciais na URL, HTTP e domínios parecidos continuam rejeitados.
- Resolução da pasta e do `.torrent` a partir dos links observados, incluindo
  caminhos relativos e mudanças de idioma/classe. Não há URL de arquivo
  construída pelo título do jogo. Múltiplas edições exigem escolha na janela.
- A janela Electron segue os links automaticamente, preserva a sessão/referrer
  e captura `DownloadItem`, inclusive de janelas filhas e após redirecionamento.
  O conteúdo bencode e o limite de 16 MB são verificados antes do envio.
- Scrapling recebe HTML local na operação `online-fix-torrent-links-v1`.
  Todo resultado é revalidado pelo Ghost. A integração foi incrementada para 3,
  com novo autoteste e pacote local verificado. Workers antigos/desativados
  conservam o resolvedor nativo.
- Obscura, quando habilitado, é alternativa para ler a página pública do jogo.
  Sessões/cookies não são exportados, e o motor não é ativado automaticamente.
  A pasta autenticada e o torrent continuam na sessão Electron.
- O envio ao TorBox registra a incerteza e o hash para impedir reenvio duplicado.
  Depois de enviado, só inicia a transferência ao PC quando
  `download_finished && download_present` forem verdadeiros.

## Mensagem do card

O card distingue obtenção do torrent, verificação da conta, envio ao TorBox e:

> Aguardando o TorBox concluir o download para iniciar a transferência para o PC.

Enquanto aguarda, mostra o progresso remoto e continua permitindo pausar ou
retomar. A mensagem desaparece quando começa a transferência local. O card de
reinstalação também mantém o aviso sobre os saves e a espera pelo TorBox.

## Evidência e verificações

- O arquivo oficial do UNO foi baixado pelo navegador e validado: 95.261 bytes.
- Teste integrado em Electron, com perfil isolado e o Scrapling empacotado,
  capturou automaticamente o mesmo torrent, sem cliques ou sessão pessoal:
  `automaticCapture: true, bytes: 95261, validTorrent: true`.
- Testes de captura nativa, resolução, card real renderizado e envio/espera/
  retomada TorBox passaram. A API TorBox usa respostas controladas nesses testes;
  não foi criada nova tarefa na conta pessoal nem baixado o jogo inteiro.
- TypeScript e build isolado aprovados. O teste não encerra o Ghost do usuário.
- Scrapling 0.4.15, integração 3, SHA-256:
  `6afe6ec93ab186cec1c9d98e6ae4d04dda2ed04c35875070b07ceebb3b890677`.
  Pacote e catálogo local preparados; nenhuma publicação remota foi realizada.

Para validar a conta real, retomar a tarefa do Online-Fix no launcher atualizado:
confirmar captura, envio único, aviso de espera e início local quando a nuvem
disponibilizar os arquivos. Aprovação visual e download completo seguem pendentes.

## Intermediário de tarefas/instalações — 13/10/2026

O usuário mostrou uma tela `loot-reward.com` exigindo instalação de aplicativos
ou extensões para liberar o link. A presença do logo Online-Fix não comprova
segurança desse intermediário. O Ghost mantém esse domínio bloqueado.

A automação segue o href oficial observado com `loadURL` e referrer da página,
sem disparar handlers JavaScript de clique que poderiam substituir o destino
por um intermediário. A captura permanece na sessão Electron e sujeita às
validações de origem, HTTPS, porta e conteúdo. Nenhum código do bloqueador de
tarefas é interpretado ou resolvido. O próximo diretório é processado após
liberar o bloqueio de resolução, pois `dom-ready` pode ocorrer durante `loadURL`.

Testes conferem bloqueio do intermediário em pop-up, navegação e requisição,
e abertura direta da pasta oficial sem executar clique. Não foi verificado
por análise externa se esse domínio é classificado como malware ou fraude.

### Verificação concluída em 14/10/2026

A captura integrada pela navegação direta, sem evento de clique, também retornou
`automaticCapture: true, bytes: 95261, validTorrent: true`. O build isolado
desse reforço passou. No estado atual do código, 31 testes de `directBrowser`,
`onlineFixTorrent` e `externalDownloadStatus` e `pnpm run codecheck` passaram.
O envio e a transferência completa na conta TorBox pessoal continuam pendentes.

### Confirmação do usuário e captura silenciosa — 14/10/2026

O usuário confirmou que o fluxo TorBox/torrent funcionou e que o download
começou automaticamente. Pediu eliminar a janela que aparecia durante a captura.

A janela Online-Fix e suas janelas filhas agora são criadas com `show: false`,
mantendo a sessão persistente e o processamento em segundo plano. A página
oficial só é revelada quando a resolução não encontra automaticamente um
destino único — por exemplo, login, verificação ou escolha entre arquivos.
Não há temporizador que abra a janela durante uma captura automática demorada.
Páginas bloqueadas de terceiros continuam rejeitadas.

Os testes verificam a criação oculta, a ausência de `show()` no sucesso e a
abertura da página oficial somente no caminho manual. A confirmação recebida
refere-se ao funcionamento do fluxo e ao início do download; a conclusão da
instalação do jogo não foi informada pelo usuário.

Validação dessa captura silenciosa: o teste integrado em Electron com perfil
isolado obteve o torrent real do UNO de 95.261 bytes, válido, com
`initialVisibleWindows: 0` e `revealedWindows: 0`. Os 32 testes de
`directBrowser`, `onlineFixTorrent` e `externalDownloadStatus` passaram;
TypeScript, lint do backend alterado e build isolado também passaram.

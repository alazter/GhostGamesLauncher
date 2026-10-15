# Automação compartilhada de downloads diretos

Integração dos leitores opcionais de Scrapling/Obscura nas seis fontes:
[cobertura, limites e validação](DIRECT_DOWNLOAD_ENGINES.md).

## Relato e causa — 15/10/2026

Ao baixar Graveyard Keeper 2 pelo AnkerGames, o Ghost abriu o portal
"Opening Treasure Box" e permaneceu em "Continue to FileKeeper". O log real
registrou `navigation-status-200` em `ankergames.net`, seguido de
`request-blocked-popup` em `filekeeper.net`. O manifesto Anker não permitia esse
hoster e o fluxo direto ainda abria a janela sem o controlador de navegação
automática usado pelo Online-Fix.

## Implementação

- `directHosters.ts` compartilha a resolução de FileDitch, FileKeeper,
  Pixeldrain, Gofile e VikingFile, incluindo seus servidores finais já
  observados. Os manifestos diretos de AnkerGames, SteamRIP, NXBrew, NSWGF e
  RomsLab agora permitem esses destinos. Isso não libera domínios arbitrários
  nem transforma plugins externos em fontes com automação garantida.
- `sourceDownloadScript.ts` segue controles reais de download e portais como
  "Continue to FileKeeper". Descarta anúncios, torrent, denúncia e ações
  destrutivas; mantém os outros espelhos observados como alternativas.
- `browserDownloadAutomation.ts` executa esse fluxo nas cinco fontes acima.
  Raiz e pop-ups começam ocultos, preservando a sessão Electron e os cliques
  de formulários POST. Um filho legítimo controla a etapa atual, evitando que
  o pai inicie outro espelho enquanto o arquivo está sendo preparado.
- `directWaitNotice.ts` compartilha o aviso de espera: cada tentativa de hoster
  tem 45 segundos para iniciar o download. A intervenção persistente só revela
  a página após 10 segundos; o aviso mostra o prazo original, a tentativa e o
  próximo espelho, quando existente. Links/cliques automáticos continuam
  ocultos durante a espera. O prazo termina quando chega o DownloadItem válido,
  sem limitar a duração da transferência.
- Os módulos Online-Fix reexportam os componentes compartilhados. Seu fluxo
  específico de jogo + fix, arquivos multipart e extração com `online-fix.me`
  permanece coberto pelos testes existentes.

URLs continuam passando por HTTPS, manifesto e bloqueio de report/abuse em
navegação, pop-up e requisição. Não há automação de CAPTCHA nem instalação de
apps/extensões de intermediários. Os domínios exclusivos de provedores,
como o relay MegaDB do SteamRIP, mantêm seu escopo próprio.

Os textos das fontes nativas agora indicam download automático e explicam
que a janela aparece quando é necessária intervenção. Capas e layout da
biblioteca não foram alterados.

## Validação e limites

- 163 testes em nove suítes aprovados, incluindo Online-Fix, recuperação de
  downloads, guardas de rede, fontes alternativas e o controlador compartilhado.
- TypeScript, lint dos oito módulos backend envolvidos (zero erros/avisos) e
  build isolado aprovados.
- Electron com perfil isolado e páginas controladas executou, para AnkerGames,
  SteamRIP, NXBrew, NSWGF e RomsLab, a sequência página do jogo → portal
  "Continue to FileKeeper" → formulário FileKeeper → ZIP. Nas cinco fontes,
  o arquivo recebido foi validado, o POST foi preservado e nenhuma janela foi
  revelada. Evidências em
  `.system_generated/tasks/shared-direct-automation/native-final.log`.
- A repetição desse teste inicialmente reutilizou o ZIP da execução anterior
  e corretamente acionou a proteção contra retomada quando o servidor ignorou
  Range. A fixture passou a usar um diretório novo por execução, sem modificar
  o comportamento de recuperação de produção.

O bloqueio de FileKeeper foi comprovado no log do usuário. O teste de navegação
é controlado; não comprova a transferência e instalação completas do Graveyard
Keeper 2 nem disponibilidade atual de cada hoster. O trabalho não retomou ou
alterou o download existente no perfil do usuário. Erros antigos de caminho de
reinstalação presentes no mesmo log não fazem parte desta correção.

## Retorno do usuário: automação sem confirmação manual — 15/10/2026

O usuário rejeitou o resultado anterior: o AnkerGames não baixou e a janela
manual não abriu. Pediu uma contagem no próprio card para explicar a espera
antes da confirmação. Os testes controlados anteriores não reproduziam o
modal real do Anker e não comprovavam esse caso de falha.

A inspeção real da página de Graveyard Keeper 2 identificou o botão inicial
`Download` e, no modal, opções FileKeeper/DataNodes renderizadas como
`a.download-button[href="#"]` com handler `generateDownloadUrl(...)`. A seleção
anterior só clicava botões e ignorava esses controles. O texto do `li` também
concatena `FileKeeperDownload`, sem espaço. O seletor agora reconhece essas
linhas e clica uma opção real por vez, preservando o handler e a geração do
destino assinado. Não há IDs de arquivo nem URLs geradas fixados no código.

O controlador também marcava uma janela como tentada após navegação/clique e
isso podia impedir a revelação posterior. Ao vencer o prazo, ele encerrava a
operação sem oferecer a janela manual. Uma navegação pendente podia ainda
prender o polling ao aguardar `loadURL`.

### Política atual (substitui a espera silenciosa até falhar)

1. A tentativa automática fica oculta e publica um prazo de até 45 segundos.
   Uma página que já exige intervenção persistente pode antecipar a abertura
   após 10 segundos, com o prazo correspondente enviado ao card.
2. Sem DownloadItem válido, o Ghost abre a página permitida para confirmação,
   inclusive após clique automático sem efeito, DOM não reconhecido ou espera
   que nunca termina. Exibir não depende da injeção bem-sucedida do aviso.
3. A fase manual dispõe de 120 segundos. O card passa a orientar a confirmação
   e mostra esse prazo. A automação deixa os controles para o usuário; pop-ups
   legítimos posteriores são revelados e continuam na mesma captura.
4. Sem arquivo ao fim da confirmação, tenta o próximo espelho observado. Para
   o modal dinâmico ainda aberto no pai Anker, conserva as opções e as marcas
   de tentativas ao retornar ao pai. Se não houver alternativa, informa erro.
5. Captura, cancelamento e término limpam o estado de espera. Reiniciar o
   launcher não restaura um contador vencido. Downloads em curso continuam
   sem limite de duração imposto por esse contador.

`ExternalDownloadJob.directWait` transporta fase, hospedagem e deadline absoluto
ao frontend. Eventos são enviados nas transições; o relógio do card atualiza
localmente a cada segundo, sem reiniciar quando chega um snapshot. O componente
`DirectDownloadWait` é compartilhado pelo card ativo do gerenciador e pelos
cards da tela de downloads externos. As cores ciano/âmbar seguem o card; capas
e altura padrão não foram alteradas. Online-Fix publica o mesmo estado e também
oferece confirmação antes de abandonar um hoster que não entregou arquivo.

### Evidência adicional

- A captura real isolada do Graveyard Keeper 2 seguiu Anker → FileKeeper →
  `tunnel1.dlproxy.uk`, recebeu **1.066.313 bytes**, com **zero janelas
  reveladas**, e foi interrompida intencionalmente. O parcial foi tratado pela
  limpeza do fluxo de teste. Não foi instalado o jogo nem alterado o job do
  usuário. Log: `direct-manual-fallback/real-anker-fixed.log`.
- Electron controlado reproduziu clique automático sem efeito, esperou os
  45 segundos reais, pediu uma janela manual, capturou o ZIP após o segundo
  clique e limpou o estado do contador. Log: `native-manual.log`.
- O teste integrado das cinco fontes agora inclui o modal com links hash e
  handler, seguido do portal e POST FileKeeper; todas receberam o ZIP correto
  com zero janelas. Log: `native-dynamic.log`.
- O card React real, com resolução de capa isolada, foi renderizado em larguras
  de 1040 e 760 px. As duas fases ficaram dentro do card de 180 px, sem cortar
  o contador; imagens e medições em `card-1040.png`, `card-760.png` e
  `card-visual.log`.

Esses artefatos estão em `.system_generated/tasks/direct-manual-fallback/`.
O início real da transferência foi validado; a conclusão da instalação e a
aprovação visual do usuário permanecem pendentes.

Verificação final desta revisão: **171 testes em dez suítes**, TypeScript,
lint dos sete módulos novos/alterados do fluxo sem erros/avisos e build isolado
aprovados. A suíte cobre os prazos, navegação pendente, cliques sem efeito,
links dinâmicos reais, limpeza do contador e propagação do estado pelo serviço.
Também preserva os testes de captura, recuperação, instalação Online-Fix e
fontes alternativas. A aprovação dos testes não substitui a instalação completa
real do jogo, que não foi executada.

O usuário confirmou que esse fluxo funcionou. A extensão seguinte adiciona
Direct/DataNodes e aprendizado de controles manuais; veja
[aprendizado de downloads diretos](DIRECT_DOWNLOAD_LEARNING.md) para o escopo,
validação e limites dessa nova etapa.

## Página de erro deve voltar ao jogo original — 15/10/2026

O usuário mostrou o AnkerGames em "Download Unavailable", com "Please complete
the verification challenge and try again" e botões Return Home/Refresh Page.
O Ghost sobrepunha o aviso de confirmação a esse documento sem download, o que
obrigava o usuário a voltar ao início e pesquisar o título novamente. O log
confirmou a transição automática → manual no domínio Anker, sem identificar
essa tela de erro; ela pode ser servida com HTTP 200.

`sourceDownloadPageStatus` reconhece o título "Ops matey no downloads here" ou
o heading de indisponibilidade acompanhado do contexto de erro. Um desafio
interativo, ou uma descrição de jogo mencionando erro, não recebe essa
classificação. A leitura é feita no resolvedor automático e antes de revelar
uma página de fonte para confirmação, incluindo após um clique manual.

`AnkerAccount.direct` passa o endereço original validado da tarefa ao
controlador. Ao detectar a tela terminal, o controlador:

1. Oculta a tela de erro e fecha filhos da tentativa anterior.
2. Descarta alternativas assinadas antigas e ações manuais não confirmadas.
3. Reabre a página original do jogo na mesma sessão Electron, usando o endereço
   da tarefa. Não segue Return Home, pesquisa ou links sugeridos pelo erro.
4. Aguarda a página carregar (até 30s), abre a janela e orienta o usuário a
   clicar em Download e concluir a verificação, quando solicitada. Permanece em
   modo manual, sem repetir o clique/link automático que falhou. O prazo manual
   de 120s começa quando a página do jogo está pronta.

O card informa "Reabrindo a página deste jogo" durante o retorno; depois, ele
e a faixa da janela orientam o clique na página correta. Se essa página também
retornar erro ou não carregar, a operação informa falha recuperável no card,
sem ciclo de retornos. Cancelamento ou captura impedem revelações posteriores.
Uma mensagem de erro antiga durante a navegação pendente não encerra o retorno
prematuramente. Os prazos e o estilo do card foram preservados.

Evidência Electron com páginas/perfil controlados: um clique automático levou
à tela exata do relato; o Ghost carregou novamente o jogo e mostrou somente
`/game/graveyard-keeper-2`; o clique manual seguinte entregou um ZIP válido. Houve
duas cargas da página do jogo (inicial e retorno), uma janela revelada e nenhuma
navegação para Home. Log: `.system_generated/tasks/direct-source-recovery/native.log`.
Isso valida o comportamento de recuperação; não é uma instalação real do jogo.

Os testes também cobrem erro após clique manual, filho com erro, página original
indisponível, retorno travado, cancelamento durante a carga, rejeição de Home ou
domínio fora do manifesto, e os textos do contador.

Verificação final desta correção: **193 testes em 11 suítes**, TypeScript,
lint dos cinco módulos envolvidos (zero erros/avisos) e build isolado
aprovados. O teste Electron de recuperação também recebeu o arquivo correto
após confirmação na página original.

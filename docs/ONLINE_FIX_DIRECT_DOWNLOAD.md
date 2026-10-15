# Online-Fix: download direto do jogo e do fix

O fallback de leitura agora compartilha Scrapling/Obscura com as outras fontes.
Veja [a cobertura e os limites da sessão](DIRECT_DOWNLOAD_ENGINES.md).

Implementação local de 14/10/2026, solicitada pelo usuário após confirmar o
funcionamento do torrent/TorBox.

## Comportamento

O botão **Download direto — Jogo e fix** inicia uma tarefa única em Downloads.
O Ghost segue o href observado de **Download from Online-Fix Hosters**, sem
executar o handler do botão da página do jogo, e lê o catálogo `data-links` na
sessão Electron. Não constrói caminhos com o título do jogo.

Os cinco hosters da página fornecida são reconhecidos: FileDitch, FileKeeper,
Pixeldrain, Gofile e VikingFile. Cada nome de arquivo representa um pacote;
as cópias desse mesmo arquivo em outros hosters representam espelhos, não
downloads adicionais. O jogo é obtido primeiro, depois o fix. Se um espelho
falha, tenta-se o próximo. Uma transferência interrompida que ainda permite
retomada nativa usa a recuperação existente antes de abandonar o espelho.

- FileDitch: página de arquivo do catálogo, seguida do botão de download e
  de seus redirecionamentos observados. Aguarda a verificação automática da
  hospedagem sem abrir a janela.
- FileKeeper: botão oficial, incluindo `#download-button` observado no DOM
  real, com preservação do POST, cookies e contagem regressiva da hospedagem.
  O relay final observado `tunnel1.dlproxy.uk` é permitido apenas neste fluxo.
- Pixeldrain: `/u/<id>` usa o endpoint oficial `/api/file/<id>?download`.
- Gofile/VikingFile: links e ações de download da linha do arquivo são
  identificados pelo nome esperado, incluindo conteúdo renderizado pelo site.
  O redirecionamento observado `vik1ngfile.site` é restrito ao fluxo direto.

A janela começa oculta. Login, desafio ou resolução manual podem mostrar a
página permitida da hospedagem; o Ghost não resolve CAPTCHAs automaticamente.
O card informa a obtenção dos links e que aguarda todos os arquivos antes de
instalar. Uma hospedagem indisponível não é tratada como download concluído.

## Arquivos e instalação

Downloads devem corresponder ao nome de arquivo do catálogo e a um hoster
permitido. Torrents, instaladores soltos, outros nomes, intermediários de tarefas
e arquivos HTML disfarçados de pacote não são aceitos. O cabeçalho ZIP/RAR/7Z e
o tamanho da transferência concluída são verificados.

Pacotes concluídos são registrados separadamente em `onlineFixPackages`, com
nome, papel, caminho local e bytes. **Retomar** relê o catálogo e reutiliza cada
arquivo apenas quando nome, papel, caminho, tamanho e cabeçalho correspondem.
Links temporários de download não são persistidos. Partes RAR mantêm seus nomes
e ficam juntas; extrai-se somente o primeiro volume. Catálogos incompletos,
volumes ausentes e edições/fixes diferentes não são combinados silenciosamente.

O instalador usa a senha `online-fix.me` em ambos os pacotes. Extrai o jogo
na pasta temporária da tarefa, depois extrai o fix em outra pasta temporária e
aplica seus arquivos sobre o jogo. Pastas significativas, como `x64`, permanecem
no caminho correto; wrappers redundantes do fix são removidos. Links e caminhos
inseguros seguem bloqueados pelo extrator; metadados `.ghost-*` não podem ser
substituídos pelo fix. Nenhum executável do pacote é executado pelo instalador.

Somente depois de aplicar o fix são identificados os executáveis e concluída a
instalação pelo mecanismo existente. Seleção ambígua permanece disponível para
confirmação. Reinstalações conservam o fluxo existente de saves, espaço em
disco, registro e recuperação. Falha na extração permite reutilizar os dois
pacotes locais, sem baixar novamente.

## Evidência e limites

- Catálogo real do UNO consultado: dois pacotes e cinco espelhos por arquivo.
  Fixture reduzida preserva apenas os dados dos links observados.
- Captura real em Electron com perfil isolado pelo FileKeeper: arquivo
  `UNO_Fix_Repair_Steam.rar`, **6.615.054 bytes**, sem solicitação de janela ou
  intervenção manual. O 7-Zip validou a integridade com `online-fix.me`:
  quatro arquivos, três pastas, conteúdo protegido por senha.
- Teste isolado com 7-Zip real: dois pacotes 7Z de teste com cabeçalhos
  criptografados, extração do jogo, aplicação do fix e rejeição de senha errada.
- 122 testes de catálogo, captura, instalação, retomada, torrent, seleção de
  fonte e mensagens passaram. Incluem registro na biblioteca com executável
  corrigido e preservação do jogo concluído quando o fix falha.
- TypeScript e build isolado aprovados; os três módulos novos passaram no lint
  sem erros ou avisos. Arquivos antigos já possuem ocorrências de lint.

Não foi baixado o jogo UNO inteiro nem realizada sua instalação real. A
instalação completa foi validada com pacotes controlados; aprovação do usuário
ainda está pendente. Nas consultas reais, FileDitch respondeu HTTP 520 em HEAD,
Gofile HTTP 502 e VikingFile teve falha TLS. Isso limita a comprovação de
transferência real por todos os hosters neste teste, mesmo com os adaptadores
implementados. O fluxo conserva fallback manual e troca de espelho.

Referências públicas: [página do UNO](https://online-fix.me/games/strategy/18267-uno-online.html),
[API Pixeldrain](https://pixeldrain.com/api). O fluxo de torrent separado está
documentado em [ONLINE_FIX_TORRENT_DOWNLOAD.md](./ONLINE_FIX_TORRENT_DOWNLOAD.md).

## Correção: seleção de Report abuse — 14/10/2026

O usuário mostrou a janela de denúncia do FileDitch após escolher baixar.
O seletor anterior aceitava um href simplesmente por seu último segmento ser
igual ao nome do arquivo. Um link `/report/.../Game.rar` atendia a essa condição,
enquanto o Download legítimo podia usar outro endpoint. A resolução seguinte,
sem ação de download, acabava mostrando a janela de denúncia.

Agora a seleção rejeita rotas de denúncia/remoção, inclusive codificadas e
indicadas em parâmetros de ação, antes de comparar nomes. Textos, atributos e
formulários de denúncia também são excluídos antes de clicar. Links precisam
indicar download, designar o arquivo com `download`, ou apresentar seu nome
exato como texto; promoções de gerenciadores de download não entram nessa
seleção. O destino precisa pertencer aos hosters permitidos.

O mesmo bloqueio é aplicado às requisições, navegações, pop-ups e ao recebimento
de DownloadItem, além de revalidar o destino retornado pelo script.

Teste com DOM real em Electron reproduziu a escolha incorreta do seletor
anterior e passou com a correção em cinco cenários: link Report versus Download,
Report versus botão, Report disfarçado com atributo `download`, formulário de
denúncia e botão legítimo FileKeeper. Todos tiveram **zero cliques em Report**.
A captura real do fix pelo FileKeeper passou novamente, com 6.615.054 bytes e
sem pedido de janela. A página FileDitch real não pôde ser obtida nessa consulta;
o teste de seleção usa DOM controlado que reproduz a ambiguidade mostrada pelo
usuário. Não comprova instalação real completa do UNO.

Verificação final da correção: 101 testes em cinco suítes passaram, assim como
TypeScript e build isolado. Os módulos de resolução/captura alterados passaram
no lint sem erros ou avisos.

## Compartilhamento com outras fontes — 15/10/2026

Os scripts de hosters e o aviso de espera foram extraídos para módulos comuns,
mantendo as exportações anteriores do Online-Fix. AnkerGames, SteamRIP e as
três fontes de ROM integradas agora usam a mesma resolução e política de
janela oculta. O fluxo específico de jogo + fix do Online-Fix permanece
separado e coberto por regressão. Veja
[automação compartilhada](SHARED_DIRECT_DOWNLOAD_AUTOMATION.md) para causa,
escopo e limites da validação.

## Correção: Baixar do FileDitch sem transferência — 14/10/2026

O usuário mostrou a página legítima FileDitch com o botão **⬇ Baixar** e
informou que clicar não iniciava a transferência. A página real foi obtida
em Electron após aguardar sua verificação automática, sem clicar em denúncia.

O DOM observado confirmou:

- O botão é um anchor com atributo `download` vazio e legenda **⬇ Baixar**.
  O seletor não reconhecia a legenda com o ícone.
- Seu href aponta ao relay `blehpooffileditchstuff.org`, com um caminho opaco
  assinado, sem o basename do arquivo. Esse domínio ainda estava bloqueado.
- A captura real seguinte confirmou um segundo redirecionamento ao servidor
  `alpha.struggleditchfr810.st`, também necessário à transferência.
- A ação de denúncia aponta a `abuse.fileditch.com`, cujo caminho termina no
  nome do arquivo. A exclusão de ações agora considera também o hostname.

Os dois servidores foram permitidos exclusivamente no fluxo direto Online-Fix;
domínios parecidos e servidores não observados continuam rejeitados. Legendas
de download aceitam ícones nas extremidades e português. A automação aguarda
silenciosamente enquanto `.verifying-overlay` está visível; não resolve ou
desativa a verificação do site. CAPTCHA ou intervenção efetiva ainda podem
exigir uma janela.

Validação real com a captura de produção em perfis isolados:

- **Fix completo pelo FileDitch:** `UNO_Fix_Repair_Steam.rar`, 6.615.054 bytes,
  sem pedido de janela. Integridade aprovada pelo 7-Zip com `online-fix.me`.
- **Arquivo principal do UNO:** transferência iniciada e 41.912.955 bytes
  recebidos, **zero janelas reveladas**. O teste foi interrompido
  intencionalmente e seu arquivo parcial removido; não foi baixado nem
  instalado o jogo inteiro.

Essa evidência substitui a limitação anterior de acesso à página FileDitch para
diagnóstico do botão. A conclusão da instalação real do jogo e as transferências
reais pelos demais hosters continuam com seus limites de validação próprios.

## Prioridade automática e aviso antes de trocar de hoster — 14/10/2026

O usuário testou outro jogo, Papers, Please: uma hospedagem não iniciou a
transferência e outra entregou o arquivo após confirmação manual. Pediu um
temporizador para explicar a espera e a troca de hoster, mantendo a prioridade
de não abrir a janela.

Cada espelho mantém o prazo de 45 segundos para **iniciar** a transferência.
Se a automação já encontrou o link ou clicou no download, o Ghost continua
aguardando e tenta outro espelho silenciosamente caso ele falhe. O prazo é
cancelado quando o DownloadItem válido chega; não limita a duração do download.

Uma página que realmente continua precisando de intervenção só é revelada
após 10 segundos nessa condição. Verificações automáticas continuam ocultas;
login/CAPTCHA visível pode exigir intervenção mesmo após um clique automático.
Uma tentativa encerrada não pode revelar uma janela por uma resposta atrasada
de seu script.

Quando necessária, a janela apresenta um aviso do Ghost com a hospedagem,
tentativa atual, pedido para aguardar mantendo a janela aberta, contagem
regressiva e nome do próximo hoster. O contador usa o prazo original da
tentativa, sem reiniciar o tempo quando a janela aparece. Na última hospedagem,
o aviso explica que será possível retomar em Downloads, sem prometer um espelho
que não existe. O aviso não intercepta cliques nos controles da hospedagem.

O teste integrado também reproduziu `ERR_FAILED` antes de `will-download`.
Esse código, assim como `ERR_ABORTED`, agora mantém a espera limitada ativa para
receber o arquivo; uma rejeição de navegação isolada não encerra a tentativa
antes do evento de download.

Evidência: Electron com perfil e páginas controlados executou o fluxo completo
com o prazo real de 45 segundos, exibiu o contador (34s → 32s), solicitou uma
única janela de intervenção e recebeu os dois pacotes após trocar de espelho.
O comportamento visual foi conferido em `countdown-window.png`, em
`.system_generated/tasks/online-fix-direct/`. Também há testes de relógio
controlado cobrindo espera oculta, aviso manual, desafio após clique e resposta
atrasada depois de interrupção. Essa validação não baixou nem instalou o jogo
Papers, Please real. Aprovação específica do novo aviso ainda pendente.

Verificação final: 109 testes em cinco suítes, TypeScript e build isolado
aprovados. Os três módulos alterados de captura, resolução e aviso passaram
no lint sem erros ou avisos.

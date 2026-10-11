# Lançamentos nativos no Ghost

A rota `/releases` usa React e o armazenamento do Ghost. Substitui a antiga página remota exibida em webview. O catálogo público continua vindo do Releases.com; o aplicativo não mantém uma base editorial própria nem replica a conta do site.

## Uso

- Calendário com navegação por mês e data, busca, categorias, várias plataformas/serviços simultâneos, gênero e regiões EUA/Reino Unido. A seleção antiga de uma plataforma é migrada e as preferências continuam no backup.
- Meses em painéis com título grande e cantos arredondados. Dias passados têm sinal verde e tempo decorrido; futuros têm calendário ciano. Cabeçalhos exibem o filtro selecionado e um atalho para consultar o dia.
- Barra central com o dia visível, seletor de data sem limite ao ano atual, retorno para hoje, Calendário/Populares, menu de períodos, três formatos (capas, cartões compactos e lista) e expansão do calendário. A busca permanece acima da barra e os monitorados continuam acessíveis na navegação lateral.
- Rolagem contínua: subir carrega lançamentos anteriores, descer carrega os próximos. Os filtros seguem em cada consulta e não existe um limite fixo de títulos na tela. Cada página é carregada quando sua extremidade se aproxima da área visível; não se baixa todo o histórico de uma vez. A posição do título visível é preservada quando datas anteriores são acrescentadas.
- **Hoje** retorna ao lançamento de hoje ou à próxima data disponível no calendário já carregado; em outro período, consulta a data atual.
- Populares com períodos semanal, mensal, anual e geral; próximas páginas automáticas. Botões permitem carregar/repetir uma página manualmente. Páginas repetidas ou indisponíveis interrompem o carregamento automático e preservam o que já está exibido.
- Capas, cartões compactos e lista, com temas claro e escuro. Toda a área do cartão, incluindo o fundo panorâmico, abre os detalhes; trailer, sino e indicador de DRM têm ações independentes.
- O brilho ciano/arredondamento geral dos botões do Ghost em `index.html` exclui a tela nativa de Lançamentos; o hover da fonte não fica preso ao botão estreito da capa. Os estilos das outras telas são preservados.
- Detalhes em painel à direita: capa e título, sinopse expansível, trailer/imagem grande, faixa de miniaturas e coluna de datas por plataforma, com região e sinos individuais. Controles de fechar, expandir e tecla Escape. Há alternativa para abrir o vídeo no provedor.
- O sino acompanha todas as plataformas ou uma plataforma específica. A lista de monitorados funciona com os dados salvos mesmo sem a fonte online.
- Datas distintas do mesmo produto são preservadas na paginação e aparecem nos dias correspondentes. Estimativas de trimestre/mês não geram aviso de dia exato.
- Períodos estimados possuem uma chave de ordenação própria para respeitar sua posição no passado/futuro. Essa chave não vira data de lançamento nem data de notificação.
- Ao saltar para uma data antiga, o coletor corrige cursores diários que a fonte tenha deixado apontando para o período atual. A correção usa os dias confirmados do documento e mantém direção, região e filtros. Isso evita importar datas modernas continuamente ao subir uma lista de 2001.
- Ao consultar uma data, a página abre no primeiro dia confirmado disponível a partir dela. Datas anteriores devolvidas pela fonte permanecem acessíveis ao subir. O cabeçalho acompanha o grupo visível, inclusive quando seu título de mês aparece antes da primeira data.
- O indicador lateral e as notificações usam os monitorados locais. A consulta ocorre ao abrir o aplicativo, ao voltar à janela, após alterações e a cada 30 minutos enquanto o Ghost está aberto. Não existe serviço de notificações com o aplicativo fechado.
- Exportação dos monitorados com datas exatas para `.ics`.

## Status de DRM para jogos

O indicador **DRM** à direita do sino mostra o estado informado para a versão de PC. Clicar nele abre os mesmos detalhes do card. A coluna de detalhes apresenta status, proteção, data da quebra e grupo quando a fonte fornece esses campos, além de links, data da consulta e atualização manual. Informações de PC não são atribuídas às versões de console.

IsItCracked é lido em uma janela Chromium anônima, isolada e invisível, sem Node ou permissões de dispositivos, permitindo somente o domínio da fonte e seus servidores públicos de dados observados. O HTML remoto não é inserido na interface. O título completo precisa corresponder após normalização de caixa, pontuação, marcas e numerais de sequência (por exemplo **Minecraft Dungeons 2 / II**). A consulta tenta no máximo duas grafias e valida o título encontrado. Nomes ambíguos como **Mega Man X** não são confundidos com **Mega Man 10**; outra edição ou uma correspondência incerta resulta em **Não confirmado**.

A integração de r/CrackWatch consulta a busca pública de metadados. Apenas anúncios com título correspondente e flair apropriada podem fornecer status; discussões, rumores, outras edições, atualizações, repacks e links externos são rejeitados. Bypass/hypervisor permanece distinto de uma quebra convencional. Estados diferentes entre as fontes são exibidos como **Fontes divergem**. Não são coletados arquivos, downloads, instruções ou links de download.

A [planilha pública do r/CrackWatch](https://docs.google.com/spreadsheets/d/1f8wm0424N4QsZUYwY41kalaax0K2Lb_GZgfjxY07jkg/edit?gid=737179558#gid=737179558) é uma fonte adicional: as doze abas de jogos são consultadas por CSV, inclusive as tabelas após instruções e cabeçalhos repetidos. Quebra, bypass, lançamento futuro e proteção informada permanecem distintos. Remoção de Denuvo em uma versão não implica ausência de todo DRM nas demais versões; as estimativas da aba de próximos jogos são identificadas. Comentários editoriais, procedimentos e links de download não são importados. A base validada fica em `userData/releases/drm-community.json`, com substituição atômica e preservação independente de cada aba quando a rede ou o formato falha.

A [lista do post fixo](https://old.reddit.com/r/CrackWatch/comments/p9ak4n/crack_watch_games/) complementa a busca existente do Reddit. Somente linhas com título correspondente e coluna de status explícita podem fornecer evidência; prosa ou rumores não confirmam quebra. A consulta pública ao post está sujeita ao mesmo bloqueio de acesso do Reddit.

SkidrowReloaded e AnkerGames complementam as fontes existentes com consultas às páginas públicas de metadados. A correspondência exige título completo; estar listado ou ter um grupo associado não confirma quebra. Apenas um status explícito ou crédito de quebra nos metadados pode contribuir para o resultado. Comentários, instruções, outras edições e atualizações não são importados. O HizSearch fica disponível por link para consulta manual: o site exige verificação interativa, e sua chave de API não é utilizada pelo Ghost.

Há consultas automáticas somente para cards próximos da área visível, deduplicação, no máximo duas leituras simultâneas de jogos e prioridade para o título aberto nos detalhes. O histórico temporário limitado a 500 relatórios em `userData/releases/drm-cache.json` usa gravação atômica. Jogos sem quebra, desconhecidos, com bypass ou com divergência continuam sendo consultados a cada quinze minutos de uso. Quebra ou ausência de DRM confirmada encerra as consultas automáticas: o relatório completo é salvo separadamente em `userData/releases/drm-confirmed/<chave>.json`, sem expiração ou remoção pelo limite do histórico temporário, inclusive após reiniciar. Confirmações válidas de versões anteriores são preservadas. Se uma consulta manual trouxer um novo estado não definitivo, a verificação automática volta a funcionar.

**Verificar DRM**, à direita do cabeçalho e junto de **Expandir calendário**, consulta novamente todos os jogos carregados e monitorados, deduplicados, incluindo os que já têm confirmação salva. A fila usa duas consultas simultâneas, atualiza os indicadores e mostra progresso, falhas e jogos sem confirmação atual. Clicar novamente interrompe os próximos jogos; as consultas já iniciadas terminam. Sair da página também interrompe o restante da fila. O escopo é o conjunto de jogos carregados e monitorados no início da operação; não é baixado todo o histórico infinito do calendário. A atualização individual nos detalhes permanece disponível.

Uma atualização da planilha é compartilhada entre os jogos e baixa no máximo três abas simultaneamente. Falha de rede, estrutura ilegível ou perda de correspondência preserva a evidência anterior com indicação de consulta antiga. HTTP 401/403/429 do Reddit suspende novas consultas por uma hora e mantém o link para consulta manual. As novas fontes também suspendem tentativas repetidas diante de manutenção/bloqueio; a atualização manual pode repetir após um minuto, evitando uma requisição recusada por jogo durante a consulta geral. Os registros de DRM são locais e independentes dos monitorados; não entram no backup dos acompanhamentos.

Na validação ao vivo, IsItCracked forneceu o estado de Star Wars: Galactic Racer e a proteção Denuvo. O Reddit recusou o acesso automático com HTTP 403; o parser comunitário e a preservação do cache foram testados localmente, sem alegar confirmação ao vivo dessa fonte.

Complemento em 04/10/2026: Minecraft Dungeons 2 correspondeu à página Minecraft Dungeons II e forneceu quebra relatada, Steam, RUNE e 30/09/2026. As doze abas da planilha forneceram 468 registros (não necessariamente títulos distintos). Persona 3 Reload confirmou status, proteção Denuvo, grupo voices38 e data nas duas fontes. O Reddit continuou indisponível; não houve confirmação ao vivo do conteúdo do post fixo.

Complemento em 05/10/2026: no Electron isolado, AnkerGames forneceu a página correspondente a Minecraft Dungeons II, registrada como jogo listado. SkidrowReloaded estava em manutenção; o aviso e o link foram preservados. HizSearch exige consulta manual. A interface real com respostas de teste verificou quatro jogos únicos (três da página e um monitorado fora dela), atualização dos indicadores, consulta individual e posição do botão nas larguras de 1500, 1100, 900 e 650 px. As 14 suítes de lançamentos passaram com 74 testes, incluindo confirmações de quebra e ausência de DRM após falha, limpeza do histórico temporário e reinício; jogos sem quebra retomam a consulta. TypeScript e compilação são verificados separadamente. Aprovação visual final do usuário ainda pendente.

## Lista de monitorados

Cada título aparece uma única vez em Monitorados, mesmo com datas diferentes de lançamento por plataforma ou acompanhamentos individuais junto ao acompanhamento geral. O card preserva as versões e os controles de cada acompanhamento; os detalhes e a exportação do calendário mantêm todas as datas. O calendário geral continua mostrando um lançamento em cada dia correspondente. O caso Keep Driving (PC em 2025 e consoles em 2026) reproduziu a duplicação anterior e serviu para validar a correção.

## Backup e restauração

`ghost_release_tracking_v1` contém snapshots dos produtos, plataforma, região, opção de aviso, timestamps e remoções. O snapshot é enviado por IPC com confirmação de persistência; exportação, upload manual e backup diário aguardam essa confirmação. O fluxo de saída já utiliza o snapshot persistido.

Os monitorados e as preferências da página integram o mesmo backup do Ghost, com os provedores já existentes (Google Drive, Dropbox e OneDrive). Configure uma conta em **Configurações → Geral → Backup**. A frase “incluído no próximo backup” confirma a preparação local, não um upload concluído. O momento do upload continua seguindo as opções de backup do aplicativo.

A restauração mescla acompanhamentos por produto/plataforma/região e respeita a alteração mais recente. Remoções possuem timestamps para que um backup antigo não ressuscite títulos removidos. Dados ilegíveis são preservados na chave de recuperação; formatos de versões futuras interrompem a alteração. Chaves antigas de monitoramento local também são migradas. Cookies e dados da conta do Releases.com não entram nesse snapshot.

## Integração da fonte

O processo principal consulta documentos públicos em uma janela Chromium invisível, isolada por região, sem Node, preload, popups ou permissões de dispositivos. Apenas o site, seu CDN e a dependência jQuery observada na página são permitidos; anúncios e reprodução de mídia ficam bloqueados no coletor. Isso não altera a janela principal. O parser extrai dados estruturados; HTML remoto não é inserido no renderer nativo.

Consultas têm prazo de 30 segundos, detalhes 20 segundos e respostas limitadas. Catálogos confirmados são reutilizados por cinco minutos e detalhes por quinze minutos. Um erro com dados guardados exibe aviso; sem dados, a interface apresenta o erro e permite abrir monitorados salvos. Desafios de acesso da fonte não são resolvidos automaticamente.

## Proteção contra mudanças na fonte

- Um arquivo persistente em `userData/releases` guarda até 120 consultas/produtos e três revisões por registro, limitado a aproximadamente 16 milhões de caracteres serializados. Há gravação serializada, substituição atômica e um arquivo anterior recuperável. O limite desse cache não remove os monitorados armazenados separadamente.
- O parser valida identidade, região, datas e campos conhecidos antes de gravar. Uma queda de mais de 60% dos títulos de uma consulta ou desaparecimento de plataformas/datas e campos conhecidos suspende a atualização. Adiamentos explícitos para TBA continuam aceitos. Alterações legítimas mais drásticas podem exigir ajuste do coletor.
- Scrapling aprende referências apenas de documentos já validados. Se os seletores falharem, tenta recuperar elementos com verificações adicionais de identidade, texto e contexto. O resultado passa novamente pela validação antes de substituir dados. Não há garantia de adaptação a qualquer reformulação do site.
- Obscura permanece uma alternativa opcional para falhas de carregamento, respeitando a configuração existente do usuário. Não é ativado automaticamente por esta integração e não é usado para resolver desafios, erros 403/429 ou CAPTCHA. Busca e confirmação regional continuam sujeitas às verificações do coletor.
- Pacotes antigos de Scrapling continuam compatíveis com outras fontes. A adaptação de lançamentos exige a capacidade `release-selectors-v1`; o pacote atualizado tem `integrationRevision: 1`. A seleção de motores impede que um catálogo remoto antigo rebaixe essa revisão. O pacote Windows foi gerado e testado localmente; publicação/distribuição remota não foi realizada.
- Monitorados guardam até três versões anteriores. **Histórico salvo → Recuperar esta versão** restaura o snapshot e pausa atualizações e avisos até **Retomar atualizações e avisos**. Atualizações rejeitadas conservam o snapshot e mostram o motivo. Avisos do sistema são suspensos para itens com falha de atualização ou restauração pausada.
- O backup do Ghost inclui o arquivo persistente e o histórico dos monitorados. A importação valida o arquivo antes de mesclar; confirmações mais recentes e preferências mais recentes são preservadas independentemente, respeitando restaurações pausadas e remoções. Backups antigos sem arquivo de proteção continuam aceitos.

## Limites de paridade

- O conteúdo e a disponibilidade dependem do HTML público do Releases.com; mudanças na fonte podem exigir manutenção.
- As regiões expostas são EUA e Reino Unido. Não se afirma que as datas correspondem ao Brasil.
- Textos editoriais mantêm o idioma fornecido pela fonte; a interface do Ghost está em português.
- Monitorados de uma conta já existente no Releases.com não são importados automaticamente. Login, envio de correções/conteúdo e serviços de e-mail dessa conta não foram replicados.
- O resultado é uma implementação nativa das funções de catálogo e acompanhamento descritas acima, não uma garantia de paridade integral ou visual pixel a pixel com todo o serviço externo.

## Validação

- `pnpm run codecheck`: sem erros.
- 77 testes em quinze suítes: datas exatas/estimadas, leitura regional, mídias permitidas, filtros múltiplos, paginação passada/futura, persistência confirmada, corrupção de arquivo, falha de rede, perda de campos, restauração/pausa, mescla independente de preferências/metadados, remoções, títulos/edições e status de DRM, numerais de sequência, leitura CSV, persistência e recuperação das abas, prioridade de detalhes, um card por título em Monitorados e compatibilidade dos motores.
- `electron-vite build`: concluído. O build ainda emite avisos em outros módulos sobre imports circulares, divisão de chunks e um asset de login.
- Electron isolado, com dados públicos reais: catálogo de jogos, detalhes e trailers, busca “Ace Combat”, filmes do Reino Unido, populares de séries e próximas páginas.
- Scrapling 0.4.15: autoteste Python e executável empacotado aprovados. Electron com perfil isolado consultou seis títulos e detalhes com três datas; após renomear classes no HTML real capturado, recuperou três elementos e preservou as datas. Arquivo persistente confirmado em disco.
- Prévia do componente real com respostas capturadas: cartões/lista, temas, diálogo de detalhes, monitoramento global e PC, persistência após reload e carregamento do player de trailer.
- Recuperação do histórico e retomada verificadas pela interface da prévia, com alteração de sinopse identificada como cenário de teste.
- Calendário real com PC + PlayStation 5: três títulos na consulta inicial, nove na página anterior e quatro na posterior; somente as versões selecionadas. Detalhes reais de Star Wars: Galactic Racer com quatro trailers e cinco imagens de galeria (as miniaturas dos vídeos não aparecem duplicadas como imagens).
- Prévia do componente real: PC e PlayStation 5 marcados simultaneamente e preservados após reload; rolagem para períodos passados (incluindo trimestre estimado) e futuros, sem botão; clique no fundo do cartão abre o painel; seleção de imagem/trailer e URL do player incorporado verificadas. A primeira validação usava páginas capturadas; a prévia agora consulta o coletor real.
- Upload/download com uma conta real de nuvem e notificações visíveis do sistema não foram exercitados; os caminhos de dados foram integrados e a mescla/persistência foram testadas localmente. A prévia usa backup simulado e não é a instalação de produção.
- A prévia local foi ligada ao coletor real, substituindo a extensão finita de páginas capturadas: navegação para outubro de 2001 e continuação para setembro de 2002 verificadas, sem importar anos recentes ao subir a página. A fonte pode devolver intervalos sem produtos; não há um bloqueio ao ano atual na interface.
- Ao investigar o relato de rolagem limitada a três dias, uma aba ainda executava a prévia antiga baseada em capturas. As abas foram atualizadas para o coletor real. A prévia agora verifica uma versão gerada em cada reconstrução e recarrega as abas abertas quando ela muda. Rolagem a partir do período atual passou por 1º de outubro e 29 de setembro; salto para setembro de 2002 seguido de rolagem para outubro de 2001 também confirmado. Não se afirma ter percorrido todas as páginas entre 2026 e 2001 em uma única sessão.
- Meses com destaques, cabeçalho sincronizado, três formatos, menu de populares, expansão/recolhimento e fechamento do seletor por Escape verificados na interface. Indicador de DRM à direita do sino nos cards e proteção Denuvo nos detalhes confirmados com dados reais. Uma falha posterior ao consultar 2001 manteve o calendário confirmado e exibiu o aviso de atualização suspensa.

## Ajuste dos filtros de gênero — 08/10/2026

Os estilos da seção Filtros agora restringem o campo de busca e as duas colunas à largura disponível, alinham os marcadores à esquerda e separam o ícone do texto em Limpar filtros. A largura desktop da navegação permanece em 280px. O tema claro mantém fundo claro no campo e contraste na opção selecionada.

Validação em Electron isolado com os componentes reais e os estilos globais: jogos, filmes e séries em 1500, 1100, 900 e 650px; seleção, digitação e limpeza de gênero/plataformas; temas claro/escuro e zoom de 125%. Sem alteração na consulta ou persistência dos filtros. Aprovação visual do usuário pendente.

Complemento: o estilo global `details { width: 100% }` de GamesSettings somava a largura total às margens de Filtros, empurrando a seta para fora. O contêiner agora usa `width: auto`; o summary neutraliza o padding global e a seta tem a mesma largura e posição horizontal das setas de categorias. Verificado com o CSS real de GamesSettings, aberto/fechado, quatro larguras e zoom de 125%: setas com posições horizontais iguais, sem recorte.

## Posição inicial dos monitorados — 09/10/2026

Monitorados mantém a ordem cronológica do calendário e posiciona a rolagem nos lançamentos de hoje. Quando não há lançamento hoje, abre na data confirmada mais próxima de hoje, passada ou futura; empate prioriza o passado. Estimativas não viram datas exatas. A entrada e as mudanças de filtros/formato reposicionam a lista; atualizações de dados preservam a rolagem que o usuário escolheu. A implementação anterior por data decrescente foi rejeitada pelo usuário porque priorizava lançamentos futuros.

Validação: 22 testes de calendário, filtros e monitoramento; Electron isolado com antigos, ontem, hoje, sem data e dois jogos para daqui a cinco dias. Confirmada a primeira ocorrência visível de hoje; sem hoje, a de ontem; também entrada direta, retorno após rolagem, três formatos, monitorados de PC, somente futuros e somente títulos sem data. Para grupos finais curtos, a interface reserva apenas o espaço inferior necessário para a âncora alcançar o topo, evitando mostrar um jogo antigo primeiro por falta de rolagem; validado com somente jogos passados nos três formatos.

## Arquivos principais

- `src/frontend/screens/Releases/NativeReleases.tsx`, `ReleaseNavigation.tsx`, `ReleaseDetails.tsx` e seus CSS: interface.
- `src/backend/releases/`: consulta isolada, parser e IPC.
- `src/frontend/helpers/releaseTracking.ts`: persistência/mescla.
- `src/frontend/helpers/releasesScanner.ts`: atualização e avisos.
- `src/frontend/utils/localStorageBackup.ts` e `src/backend/backup/localStorageSnapshot.ts`: snapshot confirmado e fronteira de chaves.

A orientação histórica em `RELEASES_SIDEBAR_GUIDE.md` sobre injeção CSS se aplica à implementação antiga. A nova tela mantém a largura de 280px no desktop e o fundo escuro estabelecido; seletores do site não são mais usados para estilizar a página.

# Contas Xbox, EA, Ubisoft Connect e Battle.net

Implementação inicial de conexão e importação de bibliotecas. Os conectores dependem de serviços remotos que podem mudar. Compilação e testes automatizados não substituem a validação com contas reais; essa validação ainda está pendente.

## Uso

Na tela de contas, escolha **Conectar conta**. O login e a autenticação de dois fatores acontecem na página da plataforma. O Ghost só confirma a conexão depois de obter e validar o catálogo. **Sincronizar** atualiza os registros; **Reconectar** renova uma sessão recusada; **Desconectar** remove a sessão e os registros importados daquela plataforma, preservando jogos locais e outras contas.

Os registros entram na biblioteca unificada, inclusive quando não instalados, com IDs separados por plataforma. Não são classificados como jogos da comunidade. Capas ausentes são procuradas pelo SteamGridDB quando o usuário já configurou essa integração. Nenhuma dimensão de capa é alterada.

**Abrir página oficial** abre o endereço da plataforma. Esta implementação não baixa, instala, detecta instalações, acompanha processos nem mede tempo de jogo desses títulos. Os registros importados ficam como não instalados; o filtro “somente instalados” os oculta. Instalação e execução continuam nos clientes oficiais.

## Xbox

É necessário registrar um aplicativo Microsoft para o Ghost, habilitado para contas pessoais e autenticação de cliente público, com redirecionamento `https://login.live.com/oauth20_desktop.srf`. Configure seu ID público em **Configurar login Microsoft do Ghost**. Não informe segredo de aplicativo. O repositório não inclui uma credencial/registro Microsoft de outro launcher. A disponibilidade dos serviços Xbox para esse registro precisa ser validada junto à Microsoft.

O fluxo usa código de autorização, PKCE e validação de `state`, seguido de Xbox Live e XSTS. O catálogo é o histórico Xbox, não uma comprovação de propriedade: pode omitir compras nunca iniciadas e incluir jogos de assinatura sem licença ativa ou títulos exclusivos de console. Essa limitação é exibida na tela de contas e nos detalhes do jogo.

## Demais plataformas

- **EA:** sessão do site oficial e consulta paginada `getPreloadedOwnedGames`. Tenta renovar a autorização usando os cookies da sessão antes de solicitar reconexão. A consulta inclui os tipos de acesso retornados pela EA, inclusive assinaturas e associações Steam/Epic; não significa propriedade permanente.
- **Ubisoft:** sessão Ubisoft Connect e consulta de jogos marcados como pertencentes ao usuário. Uma resposta menor que `totalCount` é rejeitada como incompleta, preservando o catálogo anterior. Não pressupõe que jogos de console sejam executáveis no PC.
- **Battle.net:** sessão da página de conta, jogos/assinaturas e títulos clássicos. Contas regionais do mesmo título são deduplicadas. Chaves de licença clássicas não são persistidas nem enviadas à interface. O nome mostrado é o da plataforma, pois a resposta consultada não fornece um nome de perfil validado.

## Proteção e manutenção

- Uma partição de sessão por provedor; páginas de login sem Node, com isolamento de contexto e sandbox. Navegação principal restrita aos domínios da plataforma, permissões negadas e downloads bloqueados durante login.
- Credenciais adicionais cifradas com `safeStorage`; somente dados de estado e catálogo chegam à interface. Senhas não são solicitadas pelo Ghost. Erros de rede não expõem cabeçalhos, respostas ou tokens.
- Cancelamento não importa dados. Uma operação por provedor evita que reconexão, sincronização e logout concorram. Erros e respostas inválidas não substituem o catálogo anterior.
- A atualização geral da biblioteca sincroniza as contas conectadas. Sessões expiradas ou endpoints alterados podem exigir reconexão ou atualização do conector.
- Internamente os registros usam o armazenamento sideload existente, com `accountProvider` e `accountGameId`. Classificação, logotipos/rótulos, abertura e limpeza de títulos distinguem esses registros de importações manuais.

## Validação

Testes de parsers cobrem paginação, bibliotecas vazias, respostas inválidas, catálogo truncado, deduplicação, identidade por plataforma e descarte de chaves de licença/URLs inseguras. Testes do serviço cobrem sucesso, preservação de cache em erro, isolamento do logout, cancelamento e rejeição de URLs externas arbitrárias.

Verificações em 25/09/2026:

- TypeScript: aprovado, sem erros.
- Testes específicos: 17 aprovados, incluindo cancelamento com requisição pendente, resposta tardia e respostas GraphQL parcialmente bem-sucedidas.
- ESLint dos módulos novos: sem erros (os testes possuem avisos de métodos mockados).
- Build de produção: aprovado; o bundler emite avisos de tamanho de pacotes e mistura de imports estáticos/dinâmicos.
- Interface isolada com API simulada: renderização, sincronização, mensagem de erro e desconexão verificadas em navegador; largura de 360 px sem transbordamento horizontal. Isso não valida autenticação real.
- A última execução da suíte geral teve 23 suítes aprovadas e 17 falhas (238 testes aprovados, 9 falhas). Os erros reportados incluem métodos ausentes nos mocks de Electron, expectativas de parâmetros do SteamGridDB e caminhos temporários inválidos em testes no Windows. A suíte geral não está totalmente aprovada; esses resultados não devem ser apresentados como validação integral do aplicativo.

O fechamento da janela de login aborta as requisições associadas. Uma resposta tardia não importa jogos, não confirma conexão e não inicia a próxima página do catálogo.

Validação manual pendente: conectar cada provedor com uma conta real (incluindo MFA), comparar contagem e títulos com a plataforma, reiniciar o Ghost, sincronizar após expiração e desconectar apenas uma conta. Nenhuma conta do usuário foi acessada automaticamente durante o desenvolvimento.

## Referências de protocolo consultadas em 24/09/2026

- [XboxAccountClient — Playnite](https://github.com/JosefNemec/PlayniteExtensions/blob/master/source/Libraries/XboxLibrary/Services/XboxAccountClient.cs)
- [EaWebsite — integração EA mantida por Jeshibu](https://github.com/Jeshibu/PlayniteExtensions/blob/main/source/EaLibrary/Services/EaWebsite.cs)
- [Ubisoft — backend da integração Galaxy](https://github.com/FriendsOfGalaxy/galaxy-integration-uplay/blob/master/src/backend.py)
- [BattleNetAccountClient — Playnite](https://github.com/JosefNemec/PlayniteExtensions/blob/master/source/Libraries/BattleNetLibrary/Services/BattleNetAccountClient.cs)

São referências de integrações independentes, não contratos oficiais de estabilidade dos endpoints.

## Correções de conclusão do login — 25/09/2026

- Janelas auxiliares de autenticação preservam o opener e a sessão do provedor; continuam isoladas, sem Node e limitadas aos domínios permitidos. São encerradas ao concluir ou cancelar.
- EA reconhece o Bearer nas chamadas ao serviço Juno independentemente da rota e abre a página de catálogo uma única vez após retornos regionais.
- Battle.net verifica a sessão pela API em vez de exigir somente `/overview` ou `/games`, aguardando autenticação pendente sem importar dados.
- A restrição de navegador da Ubisoft é detectada e comunicada; não é contornada e a conta não é marcada como conectada.
- Validação: 22 testes automatizados das contas passaram. Fluxos com contas reais permanecem pendentes de confirmação; essas correções não comprovam compatibilidade completa com os provedores.

## Separação entre sessão EA e importação — 25/09/2026

Usuário confirmou Battle.net funcionando; EA fecha a janela mas continua desconectada, e Ubisoft permanece bloqueada. EA agora valida `me.id` pela API antes de aceitar o token, aguarda tokens anônimos e preserva a conexão verificada quando o catálogo falha, mostrando o erro no cartão com opção Sincronizar. Respostas de catálogo com outra identidade são recusadas. Os erros distinguem formato incompatível, HTTP 400, indisponibilidade e sessão recusada. Ubisoft verifica também frames internos para detectar a página de bloqueio. Nenhum contorno de restrição foi implementado.

Validação automatizada: 25 testes. Importação EA com a conta real continua sem confirmação; o novo diagnóstico permite identificar a falha concreta sem confundi-la com falha de login. Battle.net foi confirmada pelo usuário.

## Diagnóstico de execução após reincidência — 25/09/2026

O usuário relatou novamente falhas EA/Ubisoft. A execução local foi verificada: o Ghost carregava a compilação recente e somente Battle.net constava conectada. Não foi possível obter causa concreta das tentativas anteriores porque não havia registros dessas falhas.

- Cancelamento de carregamento `ERR_ABORTED` durante troca de página não encerra mais o login como erro.
- Verificação de identidade EA usa a operação persistida do catálogo, eliminando a consulta GraphQL customizada introduzida anteriormente. Erros GraphQL não relacionados à autenticação são informados em vez de aguardar indefinidamente.
- Registros locais mostram início, etapa e resultado, sem URLs, tokens, cookies ou respostas do provedor. Falhas persistem no cartão correspondente.
- Detecção Ubisoft em frames internos foi efetivamente aplicada nesta revisão (a substituição textual da revisão anterior não havia alterado esse trecho).
- 28 testes das integrações passaram. EA e Ubisoft continuam sem confirmação real; aguardando nova tentativa com diagnóstico ativo.

### Evidência real EA — 25/09/2026, 14:17
A tentativa monitorada terminou em `opening-ea-catalog`, com `tokenObserved=true`, antes de validar a sessão. O carregamento da página de ofertas falhou depois de emitir a requisição Juno autenticável. Alterado esse caso para continuar a verificação do token e importação pela API; falha de página sem token continua sendo erro. Adicionado teste específico; 29 testes passaram. Importação real após essa correção ainda pendente.

### Retestes reais às 14:20 e 14:21
EA ainda falhou em opening-ea-catalog, agora com tokenObserved=false. Portanto a correção condicional anterior não resolveu o caso real. Erro de carregamento passa a preservar somente o código ERR_* (sem URL) na mensagem e registro, para distinguir falha de rede/bloqueio. Não declarar EA corrigida. Nova tentativa necessária para obter o código exato; Ubisoft continua bloqueada.

### Retorno sem código e tratamento de contexto Electron
Às 14:23:40, o erro ainda veio como AUTH_PAGE_FAILED. A extração anterior dependia de instanceof Error; agora lê estruturalmente code/errno/message e reconhece ERR_ABORTED/errno -3 mesmo de outro contexto V8. Isso é uma correção de robustez, não uma comprovação da causa real. Incluídos testes de erro entre contextos e de não exposição de URL. 31 testes passaram; EA e Ubisoft continuam pendentes de validação real.

## EA conectada, importação recusada — 25/09/2026
Registro real às 14:27:44: sessão EA validada e salva (`connected: true`), falha em `importing-library` por CATALOG_INCOMPLETE. Revisada a paginação: o cursor `next` define o final, não igualdade rígida com totalCount. Divergência de contagem é registrada; resposta vazia contraditória com total positivo, ciclos, troca de identidade e erros GraphQL continuam recusados. 33 testes passaram. Aguardando sincronização real; usuário não precisa autenticar novamente.

Ubisoft: usuário confirmou login normal no navegador comum, enquanto a janela do Ghost segue bloqueada. Isso não implica sessão compartilhada entre navegadores. Integração Ubisoft ainda não funcional neste ambiente.

### Resultado real confirmado às 14:31 — EA
A sincronização salvou 52 jogos, connected=true, erro removido e lastSync atualizado. Registro: pages=1, records=52, reportedTotal=212. A resposta não forneceu próximo cursor. Confirmado que a igualdade rígida de contagem bloqueava esses 52 registros válidos. Não afirmar importação de todos os 212: escopo da diferença ainda não foi verificado. Ubisoft permanece bloqueada na janela integrada.

## Cartões e nomes de perfil — 25/09/2026
Cartões conectados exibem apenas logo, nick e Desconectar. Removidos contadores e ações auxiliares. getConnectedAccounts consulta originName autenticado no perfil EA e battleTag.name no perfil Battle.net quando há nome provisório; falha de perfil preserva a biblioteca e usa o nome da plataforma, nunca um ID numérico. A sincronização preserva nick salvo.

O aviso anterior Battle.net juntava HTTP 401 e 403, portanto não era prova de expiração: indicava falha de consulta e os 11 jogos permaneciam em cache. Mensagens agora distinguem autenticação recusada de acesso recusado. A checagem da sessão Battle.net usa POST /api/, como o site oficial. 35 testes passaram e prévia validou cartões com única ação e sem contagem; nicks reais ainda dependem de consulta bem-sucedida ao abrir a tela.

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

Validação manual pendente: conectar cada provedor com uma conta real (incluindo MFA), comparar contagem e títulos com a plataforma, reiniciar o Ghost, sincronizar após expiração e desconectar apenas uma conta. Nenhuma conta do usuário foi acessada automaticamente durante o desenvolvimento.

## Referências de protocolo consultadas em 24/09/2026

- [XboxAccountClient — Playnite](https://github.com/JosefNemec/PlayniteExtensions/blob/master/source/Libraries/XboxLibrary/Services/XboxAccountClient.cs)
- [EaWebsite — integração EA mantida por Jeshibu](https://github.com/Jeshibu/PlayniteExtensions/blob/main/source/EaLibrary/Services/EaWebsite.cs)
- [Ubisoft — backend da integração Galaxy](https://github.com/FriendsOfGalaxy/galaxy-integration-uplay/blob/master/src/backend.py)
- [BattleNetAccountClient — Playnite](https://github.com/JosefNemec/PlayniteExtensions/blob/master/source/Libraries/BattleNetLibrary/Services/BattleNetAccountClient.cs)

São referências de integrações independentes, não contratos oficiais de estabilidade dos endpoints.

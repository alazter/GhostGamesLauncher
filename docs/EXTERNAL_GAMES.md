# Jogos externos por plugins

## Estado da implementação

O Ghost tem uma página de busca com lupa (`/external-games`), uma seção de fontes externas na página Downloads e um serviço persistente de instalações externas. Jogos de lojas oficiais não podem ser vinculados ou substituídos por esse serviço.

Os seis adaptadores incluídos são **experimentais**. A leitura do catálogo depende do HTML público disponibilizado pelo site; não é uma API oficial nem uma indexação completa. A consulta direta ao AnkerGames retornou verificação de navegador durante o desenvolvimento. Não houve download de jogos comerciais para validar os sites de ponta a ponta.

### Suportado

- Ativação das fontes em **Plugins → Fontes de jogos disponíveis**, ou instalação dos pacotes `.ghost` versão 1.1.0.
- Busca nos catálogos públicos legíveis, filtro por fonte, identificação de erros por fonte e vínculo manual de páginas.
- Download real em streaming quando o plugin informa `type: 'direct'` e `archive: 'zip'`. Os adaptadores de sites reconhecem links ZIP explícitos apenas em domínios declarados no manifesto.
- Progresso por bytes reais, velocidade, pausa, cancelamento e retomada HTTP com Range/ETag. Se o servidor não oferece ETag forte, a retomada reinicia o arquivo com segurança.
- Download assistido: abre o site e mantém o card em **Aguardando pacote do navegador** até o usuário selecionar o ZIP. Não simula porcentagem do navegador.
- ZIP Windows sem senha: extração em pasta separada, seleção do executável, registro na biblioteca sideload e botão Jogar.
- Fonte principal persistente; updates consultados exclusivamente na fonte atual.
- Atualização e troca de fonte por reinstalação limpa, precedida por backup de saves verificado. A fonte só muda após o registro bem-sucedido.
- Vínculo de um jogo Windows sideload já existente, com confirmação da pasta específica. O vínculo não adivinha a versão instalada usando a versão anunciada pelo site.
- Backup local manual, automático ao fechar jogos iniciados pelo Ghost, histórico e restauração com proteção do estado atual.
- Consulta opcional de updates a cada seis horas enquanto o Ghost está aberto. ZIPs diretos entram na fila; o usuário finaliza a instalação em Downloads. Fontes assistidas apenas informam a disponibilidade.
- Recuperação de uma troca interrompida a partir do registro persistido. A cópia anterior é preservada até o registro da nova instalação.

### Ainda não suportado

- Arquivos protegidos por senha e instaladores interativos. RAR/7z/TAR dependem do extrator disponível; pacotes multipartes não têm suporte geral garantido.
- Instalação de Switch, configuração de emuladores, firmware/chaves ou tratamento específico de jogo base/update/DLC. NXBrew, NSWGF e RomsLab ficam disponíveis para consulta e vínculo de páginas; a instalação está desabilitada.
- Cliente torrent local e integração TorBox genérica para plugins de terceiros. O transporte TorBox descrito abaixo é exclusivo da fonte AnkerGames integrada.
- Compartilhamento de cookies de lojas ou automação de verificações interativas dos sites. O login AnkerGames ocorre em janela oficial com sessão separada.
- Detecção universal dos saves e migração automática entre formatos ou perfis incompatíveis. O usuário configura a pasta específica e pode ajustá-la antes de restaurar um backup.
- Sincronização de saves na nuvem, retenção automática de backups e modo de exclusão antecipada para pouco espaço em disco.
- Isolamento de segurança completo de código arbitrário de terceiros: o host existente ainda usa `node:vm`. Não se deve apresentar isso como sandbox inviolável.

## Fluxo para testar

1. Instalar/ativar uma fonte na página Plugins.
2. Usar a lupa **Buscar jogos**. Quando houver bloqueio do catálogo, abrir o site e usar **Vincular a página de um jogo**.
3. Selecionar a opção de download. Downloads assistidos exigem a seleção do ZIP na página Downloads.
4. Escolher o executável extraído e concluir a instalação.
5. Em **Fonte, atualizações e saves**, selecionar a pasta de saves e criar um backup.
6. Buscar o mesmo jogo em outra fonte, selecionar **Substituir [jogo]** e confirmar o jogo/edição. A nova origem fica no card de download; a biblioteca conserva a antiga até concluir.

Para um jogo já identificado na biblioteca, abrir as opções de uma página/fonte, expandir **Já tenho este jogo instalado** e vincular a instalação local. Instalações oficiais não aparecem nessa lista.

## Contrato para plugins

### AnkerGames → TorBox

1. Execute a versão atual do projeto (`pnpm start`). Reabrir um executável antigo não carrega estas alterações.
2. Em **Configurações**, use o atalho **Integrações de downloads · AnkerGames e TorBox**. Clique em **Conectar AnkerGames** e entre na janela oficial. A senha não é armazenada pelo Ghost; o Chromium mantém a sessão em uma partição própria, sem cookies das lojas.
3. Informe a chave da API TorBox e clique em **Salvar e testar**. O Ghost só salva após validar a conexão, usando criptografia do sistema. A chave não é incluída nas configurações copiadas, no estado dos downloads ou enviada aos plugins.
4. Na busca AnkerGames, use o botão existente **Download**. O backend abre a página canônica do jogo, aciona **Download .torrent File** e o link final **Download Torrent**, valida o arquivo recebido e o envia ao TorBox. Links temporários são resolvidos novamente a cada operação.
5. A página **Downloads** distingue obtenção do torrent, preparação na nuvem e transferência local. Ao receber o pacote, o Ghost extrai e usa o fluxo de instalação existente. Se houver múltiplos executáveis, pode ser necessária seleção manual.

A fila guarda o identificador e o hash do torrent para retomada. Após um envio sem resposta conclusiva, procura o hash na conta antes de permitir qualquer novo envio. Um identificador de outra conta que aponte para um torrent diferente é rejeitado.

**Pausa e cancelamento:** interrompem o acompanhamento/transferência no Ghost; não pausam nem apagam a tarefa na nuvem TorBox. Não há consulta periódica desse serviço quando a fila está inativa.

Um torrent com um único ZIP/RAR/7z/TAR usa o link desse arquivo. Diretórios e outros conjuntos usam o ZIP agregado do TorBox; um arquivo compactado interno pode ser extraído em uma segunda etapa. Pacotes com senha, múltiplos arquivos independentes ou estruturas multipartes especiais podem exigir intervenção e não têm instalação automática garantida.

Atualizações e trocas de fonte preservam a instalação anterior até a nova estar preparada. Pasta de saves desconhecida ou vazia bloqueia a substituição; configure a pasta correta. O Ghost verifica o backup antes de substituir os arquivos e restaura a instalação anterior se o registro da nova falhar. Isso não converte formatos de save incompatíveis entre versões.

**Validação:** fluxo autenticado do site conferido até o acionamento do link final de torrent. Os testes automatizados usam arquivos e respostas simuladas para validar fila, deduplicação, pausa, falhas e saves. A transferência real via TorBox e a captura pela janela Electron ainda precisam de teste integrado com a chave configurada no aplicativo; não foram comprovadas de ponta a ponta.

O SDK preserva `ghost.registerSourceProvider({ id, name, search, getSources })` e acrescenta `getDetails(gameId)` opcional. Resultados de busca precisam de `platform: 'windows'` para instalação automática; fontes Switch usam `platform: 'switch'`.

Um arquivo direto deve ser retornado assim:

```js
{ id: 'release-1', name: 'ZIP do jogo', type: 'direct', archive: 'zip',
  url: 'https://dominio-declarado.example/game.zip', sha256: 'checksum-opcional' }
```

`getDetails` deve manter o identificador, plataforma e edição e informar a versão. A comparação automática só aceita versões numéricas ou builds numéricos comparáveis. Uma data de publicação isolada não comprova atualização.

Adaptadores declarativos podem usar `ghost.registerWebsiteSource({ catalogPath, gamePathPrefix, platform })`. A URL-base vem do `homepage` no manifesto; links e redirecionamentos precisam respeitar `allowedDomains`. O transporte de downloads resolve e valida o endereço de conexão, bloqueia redes privadas e remove cabeçalhos entre origens diferentes.

A interface envia identificadores ao backend; o backend resolve novamente a fonte no plugin. Não confia em uma URL de arquivo enviada pelo renderer. Os plugins não recebem acesso às pastas de saves ou instalação.

## Persistência e segurança de arquivos

Estado: `<userData>/external-games/state.json`; pacotes temporários: `downloads/<jobId>`; backups: `backups/<backupId>`.

Instalações novas usam `ghost-<installationId>` na pasta escolhida. Extração e rollback ficam na mesma unidade de destino. Um marcador `.ghost-install.json` identifica a pasta gerenciada. Caminhos fora do destino, links, nomes especiais do Windows, arquivos criptografados e caminhos duplicados são rejeitados na extração.

Antes da troca: verificar jogo fechado → copiar e verificar saves → registrar transação → renomear pasta anterior → promover pasta preparada → restaurar saves internos → registrar biblioteca e origem → remover cópia anterior. Falhas de registro restauram arquivos e metadados anteriores.

Backups armazenam um manifesto SHA-256 por arquivo. A restauração valida todo o backup antes de copiar qualquer save. O backup dos saves não constitui rollback completo após a cópia anterior do jogo ter sido removida.

## Arquivos centrais

- `src/backend/plugins/externalGames.ts`: fila, instalação, origem, vínculo e saves.
- `externalFiles.ts` e `externalPolicy.ts`: extração, integridade e validação de caminhos/versões.
- `websiteSource.ts` e `src/common/builtinGameSources.ts`: adaptadores experimentais.
- `src/frontend/screens/ExternalGames/`: busca, controles e cards da página Downloads.
- `scripts/build-game-source-plugins.cjs`: gera os pacotes de fontes 1.1.0. O antigo pacote AnkerGames 1.0.0 é um protótipo legado; usar 1.1.0.

## Validação

Testes específicos cobrem troca de origem, saves, rollback por falha de registro, ZIP traversal, corrupção de backup, exclusão de runners oficiais, vínculo de jogo existente, retomada Range/ETag, recusa de páginas HTML como arquivo, validação de redirecionamentos e fallback interativo.

O teste visual isolado usa dados fictícios e cobre busca → escolha da fonte → Downloads → pausa, sem erros de runtime e sem overflow horizontal em 760px. Isso valida os componentes, não substitui uma validação dos seis sites e do aplicativo Electron com jogos reais.

## Download direto confirmado no navegador

Em **Opções de Download**, a fonte AnkerGames oferece **TorBox · Torrent** e **Download direto · Confirmar no site**. O botão principal mantém o fluxo TorBox; a alternativa direta não exige chave TorBox.

A opção direta abre a página do jogo na sessão AnkerGames do Ghost. O usuário escolhe Download e confirma o arquivo no site/hospedagem. O Ghost assume o DownloadItem do Electron, define a pasta temporária, mostra bytes/velocidade em Downloads e passa o pacote concluído ao instalador existente. Não repassa credenciais a plugins nem salva o link temporário.

São aceitos pacotes ZIP/RAR/7Z/TAR em HTTPS nos domínios AnkerGames e mirrors já permitidos. Torrents e executáveis avulsos são recusados. Mirrors com fluxo próprio, downloads em blob ou CDNs ainda não permitidas podem não funcionar. Retomar abre novamente o site e reinicia a transferência; não oferece retomada parcial desse transporte. Fechar a janela antes de selecionar o arquivo cancela a espera. A espera de confirmação tem limite de três minutos.

Validação automatizada: pacote simulado chega à extração com progresso e sem consultar TorBox. O download direto de uma hospedagem real ainda precisa ser validado no aplicativo.

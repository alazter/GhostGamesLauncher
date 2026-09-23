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

### ROMs: NXBrew, NSWGF e RomsLab

As três fontes oferecem **Download da ROM · Confirmar no site** quando habilitadas. A janela usa uma sessão separada por fonte; escolha o jogo base e confirme o download na hospedagem. O Ghost captura o arquivo e mostra a transferência em Downloads. Não exige TorBox. São aceitas ROMs NSP/XCI/NSZ/XCZ e pacotes ZIP/RAR/7Z/TAR contendo esses arquivos. A compatibilidade dos formatos comprimidos depende do emulador selecionado.

O Ghost coloca a ROM em uma pasta gerenciada e registra um jogo na biblioteca, preservando título, fonte e capa. Não executa arquivos Windows que acompanhem o pacote. Com mais de uma ROM no pacote, selecione o jogo base em Downloads antes de concluir; updates/DLCs não são automaticamente aplicados ao emulador. Downloads em múltiplas partes e hospedagens não permitidas ainda exigem tratamento adicional. Retomar o download interativo começa a transferência novamente.

Em **Configurações → Geral → Emulador de Nintendo Switch**, selecione o executável já instalado (Eden, Ryujinx, Citron, Nextendo ou outro). O campo **Argumentos do emulador** usa `{rom}` para inserir o caminho do jogo como um argumento; por padrão apenas esse caminho é enviado. Ajuste os argumentos conforme o emulador. Clique em **Jogar** na biblioteca ou no card concluído para iniciar a ROM. A configuração é global, alterável sem reinstalar jogos. O Ghost não instala/configura firmware, chaves ou dependências do emulador.

O registro persistido aponta para a ROM, não para o executável do emulador, evitando excluir a pasta do emulador ao remover o jogo. Saves de Switch não têm descoberta automática: configurar a pasta de saves é necessário antes de usar backup. Substituição automática de ROMs por outra versão/fonte permanece indisponível.

Validação: 130 testes de plugins passaram, incluindo captura simulada nas três fontes, instalação de ROM avulsa e ZIP, capa na biblioteca, seleção de jogo base e argumentos com espaços. TypeScript passou. Os downloads reais e a execução em cada emulador ainda não foram verificados; consulta pública de NXBrew/NSWGF retornou HTTP 403 durante a investigação. RomsLab apresentou links Datanodes/Filekeeper; somente Filekeeper foi acrescentado à lista já existente, exclusivamente para RomsLab.

### Instalação independente por pacote local

Em **Configurações → Geral → Instalar por arquivo local**, ative o recurso (desativado por padrão) para exibir **Selecionar pacote e instalar**. Escolha um ZIP/RAR/7Z/TAR e depois a pasta de destino. A tarefa usa a fila de Downloads e o instalador existente, sem fonte instalada, busca, conta ou rede. O nome inicial vem do arquivo; a origem é **Arquivo local**. Se o executável não puder ser identificado automaticamente, selecione-o em Downloads para concluir.

O arquivo escolhido permanece no lugar e nunca entra na limpeza de downloads temporários do Ghost. Cada instalação cria uma pasta própria; este fluxo não substitui jogos existentes nem associa automaticamente a uma loja para futuras atualizações. Desativar o recurso oculta o botão e impede novas solicitações pelo backend; tarefas já iniciadas continuam. RAR/7Z exigem 7-Zip. A senha padrão Online-Fix continua restrita às tarefas identificadas como dessa fonte.

Testes cobrem instalação local sem chamada de rede, registro do jogo, preservação do compactado original e cancelamento do seletor sem criar tarefa.

Estado: `<userData>/external-games/state.json`; pacotes temporários: `downloads/<jobId>`; backups: `backups/<backupId>`.

Instalações novas usam a pasta principal do pacote ou o título do jogo na pasta escolhida, conforme a seção Nome da pasta de instalação. Extração e rollback ficam na mesma unidade de destino. Um marcador `.ghost-install.json` identifica a pasta gerenciada. Caminhos fora do destino, links, nomes especiais do Windows, arquivos criptografados e caminhos duplicados são rejeitados na extração.

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

### Recuperação de interrupções

O evento `updated: interrupted` do Electron permite recuperação; o Ghost tenta `resume()` quando `canResume()` é verdadeiro, com até cinco tentativas espaçadas em 2/5/10/20/30 segundos. Não confundir esse evento com `done: interrupted`, que encerra a transferência. A continuidade dos bytes depende do suporte da hospedagem; Chromium pode reiniciar quando não há suporte adequado.

Downloads com erro e sem extração iniciada oferecem **Retomar** no card principal. Essa ação manual abre novamente a fonte e começa uma nova transferência; não recupera o parcial descartado pelo fluxo anterior. Cancelar/pausar encerra as tentativas pendentes. O estado registra somente hostname, bytes, horário, recuperabilidade e tentativas, sem URL assinada ou credenciais. Detalhes ficam disponíveis no card de erro. Não há código de causa de rede no evento DownloadItem; a interface não deve atribuir o erro ao servidor sem evidência.

O progresso direto é publicado em intervalos de 500 ms (e no término), evitando regravar todo o estado a cada evento e reduzindo oscilações artificiais da medição. Isso não constitui medição de melhoria real de velocidade em comparação ao IDM.

Em **Opções de Download**, a fonte AnkerGames oferece **TorBox · Torrent** e **Download direto · Confirmar no site**. O botão principal mantém o fluxo TorBox; a alternativa direta não exige chave TorBox.

A opção direta abre a página do jogo na sessão AnkerGames do Ghost. O usuário escolhe Download e confirma o arquivo no site/hospedagem. O Ghost assume o DownloadItem do Electron, define a pasta temporária, mostra bytes/velocidade em Downloads e passa o pacote concluído ao instalador existente. Não repassa credenciais a plugins nem salva o link temporário.

São aceitos pacotes ZIP/RAR/7Z/TAR em HTTPS nos domínios AnkerGames e mirrors já permitidos. Torrents e executáveis avulsos são recusados. Mirrors com fluxo próprio, downloads em blob ou CDNs ainda não permitidas podem não funcionar. Retomar abre novamente o site e reinicia a transferência; não oferece retomada parcial desse transporte. Fechar a janela antes de selecionar o arquivo cancela a espera. A espera de confirmação tem limite de três minutos.

Validação automatizada: pacote simulado chega à extração com progresso e sem consultar TorBox. O download direto de uma hospedagem real ainda precisa ser validado no aplicativo.

## Escolha de transporte e SteamRIP

O clique principal em Download no AnkerGames agora abre uma escolha explícita: TorBox ou Download direto. A escolha ocorre antes de exigir chave TorBox. Atualizações e substituições continuam usando a confirmação existente, independentemente do transporte escolhido.

SteamRIP oferece download direto com confirmação na janela do site. A sessão persistente é separada da sessão AnkerGames. Depois de escolher uma hospedagem e confirmar o pacote ZIP/RAR/7Z/TAR, o Ghost assume a transferência e usa a fila/extração existentes. O usuário pode pausar/cancelar; Retomar inicia nova confirmação e transfere do começo. Não requer TorBox.

Hospedagens que não constam na lista permitida, fluxos em blob, pacotes com senha e instaladores interativos não têm suporte universal. O teste automatizado cobre recebimento/extracao simulados para os dois provedores; a hospedagem SteamRIP real não foi validada de ponta a ponta nesta alteração.

## Online-Fix: Torrent via TorBox

A fonte Online-Fix habilitada oferece **Online-Fix · Torrent via TorBox** nas opções de download. Usa a chave TorBox já configurada no Ghost. Reinicie o aplicativo com a versão compilada atualizada para carregar a integração.

Escolha a opção, entre na conta se necessário na janela Online-Fix e clique em **Скачать Torrent** (baixar torrent). A sessão do site fica persistida separadamente das outras fontes. O Ghost recebe e valida o arquivo `.torrent` (até 16 MB), consulta torrents existentes pelo hash e encaminha ao TorBox quando necessário. A transferência local aparece no gerenciador de Downloads, com os controles existentes de pausa, retomada e cancelamento. Pausar no Ghost não pausa o torrent na nuvem.

A captura aceita HTTPS do domínio Online-Fix e seus subdomínios, incluindo downloads originados em janelas filhas. A espera pela confirmação tem limite de três minutos. Fechar a janela antes de selecionar o torrent interrompe a espera. Não são armazenadas URLs assinadas do TorBox no estado persistido.

Validação desta alteração: TypeScript, compilação e 113 testes do backend de plugins passaram. Os testes simulam Electron/TorBox, incluindo torrent inválido, captura em janela filha e reutilização de torrent. O fluxo real Online-Fix com a conta do usuário ainda precisa ser validado.

### Senha padrão dos pacotes Online-Fix

O instalador usa automaticamente `online-fix.me`, informada pelo usuário, exclusivamente para a fonte Online-Fix. Aplica a senha também ao pacote interno quando o TorBox entrega um ZIP contendo outro arquivo compactado. ZIPs comuns continuam usando o extrator existente; ZIPs criptografados e arquivos RAR/7Z usam o 7-Zip instalado no computador. Se faltar o 7-Zip ou a senha não abrir o arquivo, o Ghost informa o problema e não conclui a instalação.

Antes da extração com senha, a listagem do 7-Zip é verificada para rejeitar caminhos inseguros, links, nomes duplicados e tamanhos excessivos. Testes locais com ZIP e 7Z realmente criptografados confirmaram a extração com a senha correta e a rejeição da incorreta. A bateria direcionada de extração/fila passou com 39 testes; isso não substitui o teste de um pacote real baixado do site.

## Reinstalação após exclusão

A busca considera a biblioteca atual e a existência do executável para exibir Jogar. Jogos removidos, inclusive quando a biblioteca fica vazia, voltam ao fluxo de instalação limpa. A busca e os botões atualizam os registros antes de decidir entre jogar, atualizar e instalar. A falta de pageUrl nos dois registros não representa uma correspondência entre jogos.

A reinstalação cria uma nova pasta gerenciada; arquivos de saves que restarem na pasta anterior não são removidos por esse fluxo. Os testes cobrem exclusão do executável, remoção do último registro e preservação de saves. A conferência visual do fluxo no aplicativo ainda depende de teste real.

## Nome da pasta de instalação

Novas instalações usam a pasta principal do pacote diretamente no destino escolhido, sem a camada ghost-UUID. Exemplo: Jogos/Assassins-Creed-Black-Flag-Resynced/Assassins Creed Black Flag Resynced/ACBlackFlag.exe. Pacotes com arquivos soltos usam o título do jogo como pasta. Nomes incompatíveis com Windows são ajustados; destinos existentes recebem sufixo (2), (3), etc., sem sobrescrita.

A preparação continua em .ghost-stage-ID, preservando rollback e o marcador de propriedade. O campo packageRootLayout mantém a mesma organização em updates; instalações antigas não são movidas e conservam o layout anterior. Testes cobrem estrutura aninhada, nomes repetidos, conflitos de destino e atualização com preservação de saves.


## Reinstalação confirmada com economia de espaço

A confirmação de atualização/migração em Buscar Jogos avisa que a instalação antiga será removida depois do backup verificado. Cancelar ou falhar depois desse ponto deixa o jogo indisponível. A exclusão é restrita à pasta registrada, com marcador válido, sem redirecionamentos, sem outras instalações dentro dela. Uma pasta de remoção por tarefa e o estado persistido permitem retomar exclusões interrompidas.

O backup é conferido arquivo por arquivo (SHA-256) antes da remoção. Downloads pendentes preservam esse backup e impedem sua exclusão pela API. O jogo fica marcado como não instalado; os saves são restaurados ao concluir a nova instalação.

Downloads mostra a pasta de destino, o espaço total necessário, o déficit e a pasta temporária proposta em outro disco. Oferece **Prosseguir**, **Verificar novamente após liberar espaço** e **Cancelar**. Outro disco só é oferecido quando o destino comporta o jogo instalado. A pasta temporária tem marcador próprio e só é removida após validar sua identidade. Arquivos importados pelo usuário não são apagados.

Tamanhos ausentes usam estimativas sinalizadas, baseadas na instalação anterior e no tamanho do pacote, com margem de 512 MiB. O tamanho recebido pelo download direto HTTP é reavaliado; antes da extração, o tamanho descompactado é lido do ZIP ou pelo 7-Zip. Se faltar espaço nessa etapa, o pacote é mantido para nova verificação, sem repetir o download. Pacotes cuja listagem não pode ser lida interrompem a operação com erro.

O modo destrutivo exige `confirmed: true` do modal com aviso. Jobs antigos e atualizações automáticas sem essa confirmação mantêm o fluxo anterior que preserva a instalação até a conclusão.

Validação: testes locais com pacotes sintéticos cobrem remoção após backup, backup inválido, restauração, cancelamento, reinício, remoção interrompida, oferta de disco alternativo e nova verificação de espaço. Não foi feita reinstalação de um jogo real nesta alteração.

Reinstalações canceladas após a remoção permanecem em Downloads com Retomar, reutilizando o backup e criando novamente a pasta temporária. A validação direcionada final passou com 42 testes.


## Versão instalada e consulta de updates

O registro da instalação externa concluída é a referência para a etiqueta da biblioteca e a consulta de updates. Ao iniciar, o Ghost corrige metadados divergentes de jogos existentes; ao concluir uma instalação, elimina overrides antigos de versão, mantendo capas, títulos e outras personalizações. Editar a versão manualmente atualiza também o registro externo e invalida a consulta anterior.

Antes de iniciar outro download, o launcher atualiza os detalhes da fonte e verifica identidade, plataforma e edição. Consultar uma versão mais recente nunca altera por si só a versão instalada. Se faltar versão ou os formatos forem incompatíveis, a interface informa que não é possível confirmar o estado de atualização. A versão registrada é a informada pela fonte para o pacote instalado, não uma verificação universal dos binários de cada jogo.

Validação local: 42 testes direcionados e TypeScript passaram, incluindo a divergência v0.9.0/v0.10.4 relatada no inZOI. O teste visual após reiniciar ainda depende de validação no aplicativo.


## Retomar TorBox e escolher destino

Tarefas TorBox com erro na transferência local apresentam Retomar mesmo em instalações iniciais. O launcher mantém o ID/hash do torrent, consulta a conta e pede um link de arquivo atualizado; não precisa capturar/enviar novamente o torrent já associado. Cancelar uma tarefa não exclui o torrent da nuvem nem sua referência local. A associação continua limitada à mesma fonte, página, versão e edição.

Falhas transitórias da transferência local têm até duas reconexões com novo link; persistindo a falha, o erro orienta usar Retomar e inclui apenas códigos seguros de diagnóstico. Ausência de ETag válido ou servidor sem suporte a retomada pode exigir reiniciar a transferência do pacote local; isso não reenvia o torrent para a nuvem.

Online-Fix agora é aceito explicitamente pelo caminho de TorBox no backend e utiliza sua própria sessão de captura. Novas instalações iniciadas pela busca abrem o seletor de destino usando a pasta salva como sugestão. Cancelar essa escolha não inicia download.

Validação: 86 testes direcionados passaram, com serviços de rede simulados. Ainda é necessário conferir a transferência real do servidor TorBox que falhou anteriormente.


### Correção de preferência: escolha de transporte
Baixar e instalar abre a escolha do transporte disponível na fonte (TorBox — Torrent / Download direto — Confirmar no site). Utiliza a pasta já selecionada, sem solicitar escolha de pasta a cada download. A exigência de conta TorBox ocorre apenas ao selecionar a opção TorBox. Esta preferência substitui o comportamento de seleção de destino descrito acima.

# Detalhes de Buscar jogos

O card de informações de Buscar jogos segue o mockup aprovado em 20/10/2026. O fundo fosco usa a mesma capa do pôster, limitado aos cantos do card; a busca e a navegação permanecem neutras. O card ocupa a largura disponível. As capas da Biblioteca não mudam.

A revisão após a comparação das imagens d3e6b0ba/cf575fa1 corrige a herança de `text-align: center` de `.App`: título, descrição, versão e seleção ficam alinhados à esquerda. A família Cabin e seus pesos são carregados localmente, apenas neste card. Em desktop a partir de 1300 px, o pôster ocupa 230 × 345 px, com 40 px de separação do conteúdo, 35 px de margem interna e título de 34 px. Telas menores conservam o fluxo responsivo. O cabeçalho Detalhes do jogo e o atalho para Downloads completam a composição.

## Conteúdo e seleção

- `GameDetailsPanel` apresenta descrição, avaliações, build, última atualização em português e as tags de release, lançamento, desenvolvedora, distribuidora, Deck, controle e gêneros, sem repetir os tamanhos.
- Plataforma, download e tamanho após instalar ficam à direita da versão; telas estreitas reorganizam esses dados abaixo.
- Conforme a referência ac548d13 (21/10/2026), tags de release/compatibilidade e gêneros ficam dentro da coluna de informações, abaixo da versão/publicação e à direita da capa. Não voltam a ocupar uma seção de largura total sob o pôster. Sem margem lateral duplicada nos breakpoints; a quebra de linhas acompanha a coluna, inclusive no celular. A seção de fontes permanece abaixo do cabeçalho completo.
- Publicação e autor ficam agrupados abaixo da build. `publicationDate` vem da data de publicação da fonte, separada de `sourceDate`/`uploadDate`. Não inventar uma publicação a partir da atualização. A contagem de avaliações aparece somente quando informada. Sem avatar fornecido, usar um ícone de autor.
- Após rejeitar o seletor suspenso, o usuário escolheu os cards da referência f2a11855. `StoreSourceCards` mostra a seção Fontes disponíveis para download, com cards lado a lado de logo/nome, versão, tamanho e grupo da release quando informado. A seleção usa borda ciano, fundo discreto e círculo com check no canto. Não há menu suspenso. Os botões são acessíveis por teclado e se reorganizam em telas estreitas. A lista contém as versões efetivamente retornadas de cada fonte habilitada daquele título/plataforma, sem inventar histórico.
- Selecionar uma fonte atualiza os metadados e as opções de download. O filtro de lojas continua disponível no topo. A lista do seletor preserva as demais fontes quando um filtro é aplicado, com um único seletor de cards visível.
- Ao abrir um jogo, `useGameStoreSources` consulta as fontes habilitadas com o título completo, independentemente do filtro da página e sem esperar abrir o modal de download. Resultados do mesmo título/plataforma entram nos mesmos cards lado a lado, preservando a ordem e os dados detalhados já carregados. As contagens e a seleção dos filtros superiores também reconhecem as lojas descobertas. Não exibir outra sequência/plataforma, fonte desabilitada ou loja sem resultado confirmado como se oferecesse o jogo.
- A consulta mantém os cards existentes disponíveis, informa o carregamento e sinaliza falha parcial sem apagar resultados válidos. Cache limitado por jogo/plataforma/fontes habilitadas evita repetir a busca ao alternar entre os cards; respostas atrasadas não substituem outro jogo. Erros não entram no cache de sucesso. Prova da revisão em `.system_generated/tasks/all-game-stores/`: busca inicial só Anker → consulta com mais lojas → troca de filtros/cards sem perder fontes → outro jogo com resposta tardia → retorno usando cache, além da conferência de oito larguras.
- A capa continua seguindo AnkerGames → Google → SteamGridDB, independentemente da loja de download, pelo resolvedor compartilhado. Pôster e fundo usam uma única resolução, inclusive na troca de jogo/falha da imagem.

## Instalação e discos

`InstallDestination` conserva o seletor nativo de pastas, a persistência, adicionar pasta e gerenciar pastas. Exibe o espaço real à direita dentro do campo, via `checkDiskSpace`, incluindo a capacidade nas opções. Renova ao mudar a lista ou retornar ao aplicativo. Respostas antigas são ignoradas; falha/offline aparece como Espaço indisponível, sem assumir zero.

Para uma instalação nova, se o espaço conhecido não comporta o tamanho instalado informado, apresenta aviso e bloqueia o botão. Essa comparação é mínima: tamanho desconhecido não bloqueia. Atualizações, reinstalações e migrações de uma instalação existente seguem para o planejador, que considera o espaço recuperável da instalação antiga, arquivo temporário, extração e reserva. Não bloqueá-las antecipadamente usando apenas o espaço livre atual. Jogar uma instalação existente permanece disponível mesmo sem espaço para reinstalar.

Os handlers existentes de instalar, atualizar, migrar, jogar e escolher um servidor permanecem. O modal recebe a pasta e todas as fontes disponíveis; sua confirmação continua fechando antes da preparação e encaminhando a Downloads. Não altera backups, arquivos instalados ou sessões das contas.

## Validação

- TypeScript e lint dos novos componentes sem erros.
- 49 testes em cinco suítes: metadados/publicação, extração das fontes, agrupamento e seleção/envio do download.
- Página React real com APIs controladas: troca de loja/versão, ausência de dados inventados, disco insuficiente/desconhecido, resposta atrasada de espaço, adicionar pasta, abertura do modal com pasta/fonte corretas e rótulos/handlers de jogar, atualizar e migrar.
- Layout verificado em 1920, 1536, 1410, 1200, 1024, 736, 360 e 320 px, sem erro de execução. O teste carrega `App.css`, `index.scss` e `themes.scss`, monta `.App`/`.content` e mede o alinhamento à esquerda, a fonte local e o pôster de 230 px em desktop. Capa, cards e logos não aumentam no hover; medição de dimensões e transformações antes/depois confirmou a preferência solicitada. As provas controladas não baixam jogos nem acessam contas pessoais.
- Build e pacote separados da distribuição existente. Avaliação visual no perfil habitual pelo usuário ainda pendente.

## Compilação de teste

Executável: `dist/ghost-mockup-fidelity-20261020/win-unpacked/Ghost Games Launcher.exe`. Fechar a instância anterior antes de abrir esta cópia. A distribuição anterior e seus atalhos não são substituídos. A conferência do pacote 0.3.8-beta inclui manifesto/entrada, chunk atual dos detalhes, proteção de espaço recuperável, CSS, fontes, dependências, preloads e dois motores com SHA-256 válidos.

A configuração isolada inclui explicitamente package.json e materializa em app.asar.unpacked os assets de execução esperados por fixAsarPath. Os mapeamentos de origem do build separado não casavam com os padrões originais de asarUnpack; a correção pertence apenas à geração desta cópia de teste. O arquivo asar e sua integridade não são alterados por essa materialização. Provas e configurações em `.system_generated/tasks/mockup-fidelity/`. Não se iniciou a aplicação com o perfil pessoal nem se instalaram jogos reais para esta conferência.

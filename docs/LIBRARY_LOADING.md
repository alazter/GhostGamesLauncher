# Virtualização da biblioteca de jogos

Em 09/10/2026, após o usuário informar que o loteamento progressivo ainda travava, a biblioteca principal passou a usar uma janela de linhas em `useVirtualLibrary`. O loteamento acumulava todos os cards visitados e montava a coleção inteira ao ir ao fim. Agora ficam montadas apenas as linhas visíveis, três linhas de margem em cada direção e, quando necessário, um card que mantém foco, menu ou diálogo aberto. Espaçadores conservam a altura completa e a barra de rolagem nativa.

A implementação continua em TypeScript/React com APIs do Chromium, sem mudança de linguagem. `ResizeObserver` mede a grade e a área de rolagem; o tamanho e a proporção das capas vêm dos estilos e controles existentes. Um listener passivo de scroll agenda o cálculo da janela por `requestAnimationFrame`, usando índices e medidas já disponíveis. Não há varredura de geometria de todos os cards a cada seta ou scroll.

Setas, Home/End e PageUp/PageDown navegam pelos índices da coleção completa. Ir ao fim ou voltar ao topo monta diretamente a janela de destino. O registro de navegação é consultado antes do manipulador antigo, inclusive para teclas sintetizadas pelo controle. Favoritos/recentes nas primeiras fileiras continuam completos. A seleção em massa usa toda a coleção filtrada.

A identidade inclui runner, ID e ordem: filtros ou ordenações diferentes reiniciam a rolagem, inclusive com a mesma quantidade de jogos. Atualizações apenas de metadados conservam a posição. DLCs e itens excluídos por `onlyInstalled` são filtrados antes do fatiamento.

Menus e seus itens são criados somente ao abrir. O CSS do logotipo da loja está no stylesheet compartilhado, sem um elemento `style` repetido em cada card. O observador compartilhado de capas usa a própria área de rolagem da biblioteca como raiz para antecipar imagens dentro dela. `CachedImage` usa carregamento imediato após a liberação pelo observador e decodificação assíncrona. Sem `IntersectionObserver`, a virtualização continua funcionando e as imagens montadas podem carregar normalmente.

## Validação

`pnpm exec playwright test e2e/library_loading.spec.ts` testa os componentes reais `GamesList`, `GameCard`, `ContextMenu`, `CachedImage`, hooks de status/progresso, SVGs e estilos em uma janela Electron oculta com catálogo simulado e dados isolados. Serviços de lojas, ações dos jogos e diálogos de edição/desinstalação são substituídos. A aceleração de hardware está desativada no teste.

Os três testes passaram: 1.463 jogos com quantidade de cards limitada durante rolagem nos dois sentidos e saltos ao fim/topo; foco por índices; filtros de igual tamanho; metadados sem perda de posição; menu mantido ao rolar; grade responsiva e zoom; seleção dos 1.463 jogos em massa; modo lista; coleção vazia; ausência de IntersectionObserver; primeira fileira completa. A proporção CSS `173/275` é conferida. `pnpm run codecheck`, lint dos novos arquivos e `pnpm exec electron-vite build` também passaram.

O perfil comparativo usa os mesmos cards reais nos dois casos, substituindo apenas o algoritmo de carregamento pelo legado mantido em `e2e/fixtures/legacy-library-loading.ts`. Ao ir ao fim, o legado montou 1.463 cards e 33.660 elementos DOM; a janela virtual montou 23 cards e 541 elementos. Os resultados são gravados em `.system_generated/tasks/library-performance/{before,after}.json`. Para reproduzir o perfil legado, definir `LIBRARY_PROFILE_BASELINE=1` e executar somente o teste `profile real library cards`.

Esses números medem a redução de montagem em um catálogo simulado, com capas locais idênticas. Não medem FPS nem substituem a validação do catálogo real, das lojas conectadas e de um controle físico pelo usuário. A solução está implementada e verificada tecnicamente, aguardando essa avaliação de uso.

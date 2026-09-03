# Custom Rules & Active Reminders

## Central Skills & Chronic Error Protocol (`C:\Users\alazt\Documents\GitHub\Skills\Ghost Games Launcher`)
- **Pre-Implementation Consultation**: Before creating, refactoring, or modifying ANY feature, UI element, or backend logic, ALWAYS consult the skills directory `C:\Users\alazt\Documents\GitHub\Skills\Ghost Games Launcher\` (specifically `regras.md`, `erros_corrigidos.md`, `conquistas_e_solucoes.md`, `sistema_update.md`, `sistema_scaneamento.md`, `designer_interface.md`, `relatorios_bugs.md`) to verify that no existing rules, design preferences, or chronic bug prevention patterns are violated.
- **Feedback & Rejection Recording Protocol**: If the user does NOT approve a layout edit, feature, or code change (either by personal taste or due to a defect/bug), ALWAYS ask the user the exact rationale, and immediately document the user's preferences into `designer_interface.md`, `regras.md`, or `erros_corrigidos.md` so that the exact mistake is NEVER repeated.
- **Success & Victories Log (`conquistas_e_solucoes.md`)**: Whenever a feature, UI design, or architectural solution is functional, well-built, and approved, immediately document it into `conquistas_e_solucoes.md` to celebrate and preserve successful implementation patterns.
- **Continuous Knowledge Feeding**: Every time a new technology is implemented, a bug is fixed, a new rule is established, or a design guideline is applied, ALWAYS update/feed the corresponding `.md` file in `C:\Users\alazt\Documents\GitHub\Skills\Ghost Games Launcher\`.

## Release Publishing Pattern
- **Title Format**: Always title releases as `👻 Ghost v[Version]` (e.g., `👻 Ghost v0.1.4-beta`).
- **Release Description Header**: Right under the header `## Notas de Lançamento da Versão v...` in the release body description, always insert this exact HTML image:
  `<img width="192" height="191" alt="notas da atualização oficial" src="https://github.com/user-attachments/assets/17ab8642-b2fa-4c17-a76e-2573d38b5586" />`
- **Version Auto-Detection**: Always verify the last published version via git tags/GitHub releases, and increment it logically (e.g., bump patch version like 0.1.3 -> 0.1.4) to determine the next release version.

## Releases.com Left Sidebar Expansion
- **Permanent Solution Guide**: When modifying or fixing the left sidebar on the Releases screen (`src/frontend/screens/Releases/index.tsx`), ALWAYS refer to [docs/RELEASES_SIDEBAR_GUIDE.md](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/docs/RELEASES_SIDEBAR_GUIDE.md). Apply the exact comprehensive selectors (`aside, nav, div[class*="sidebar"], div[class*="Sidebar"], div[class*="menu"], div[class*="Menu"], div[class*="left-nav"], div[class*="LeftNav"]`) with `280px` width, and unclip internal text via `white-space: nowrap !important; word-break: keep-all !important; text-overflow: clip !important; overflow: visible !important;`. NEVER use `querySelectorAll('*')` on left sidebar children.

## Concluídos Recentemente
- [x] **Suporte Completo à Conta Steam no Ghost**: Integração nativa como runner oficial (`'steam'`), com detecção automática da conta local (`Alazter`), catálogo unificado de 341 jogos (87 instalados com botão Jogar e 254 não instalados com botão Instalar), capas oficiais em 600x900 da CDN da Valve, filtros dedicados e paridade total com Epic, GOG e Amazon.
- [x] **Importação Automática de Horas Jogadas da Steam (335 Jogos Sincronizados)**: Parser nativo do `localconfig.vdf` da Steam extraindo o total de minutos jogados e datas da última execução, sincronizando diretamente no `timestampStore` do Ghost. Jogos da Steam agora exibem as centenas de horas jogadas no HeroPanel, nos detalhes e no filtro de ordenação.
- [x] **Faixa Diagonal "NOVO" e Ordenação por Adicionados Recentemente e Mais Jogados**: Fita diagonal no canto superior direito dos cards em 45 graus, filtro de ordenação `✨ Classificar por Adicionados Recentemente` (posiciona novidades no topo sem esconder a biblioteca) e filtro de ordenação por horas jogadas `⏱️ Classificar por Mais Jogados` com execução instantânea (0ms RAM Cache).
- [x] **Sistema de Backup Automático e Reversão (Undo) de Capas do SteamGridDB**: Snapshot de segurança criado automaticamente antes de sincronizações, com card de status `🟢 Ponto de Restauração de Capas Disponível` e botão `⏪ Reverter para Capas Anteriores` em Configurações > SteamGridDB para desfazer alterações com 1 clique.
- [x] **Padronização Global do Design System Glassmorphism / Cyber Neon**: Aplicação do estilo translúcido com desfoque de vidro (`backdrop-filter: blur(16px)`), bordas suaves, sombras profundas e iluminação neon ciano (`#00ffff`) em todas as janelas, modais base (`Dialog`), instalação (`InstallModal`), caixas de mensagem (`MessageBoxModal`), menus flutuantes (`Dropdown`) e formulários (`FormControl`).
- [x] **Padrão Oficial do Botão Fechar ("X") com FontAwesome e Neon Direto no Ícone**: Eliminação total de contornos/anéis amarelos e brancos e caixas/molduras de fundo. Uso MANDATÓRIO de `<FontAwesomeIcon icon={faTimes} />` (terminantemente proibido `CloseIcon` do MUI para evitar borrão de canvas quadrado). Ao passar o mouse (hover), o efeito azul/ciano neon (`#00ffff`) acende diretamente sobre o glifo do "X" com glow dinâmico `drop-shadow` e escala suave `1.05`.
- [x] **Efeito Neon Direto nos Ícones da Sidebar Esquerda**: Aplicação da mesma tecnologia de iluminação neon ciano (`#00ffff`) com `drop-shadow` direto nos glifos dos ícones da barra lateral (Biblioteca, Lojas, Configurações, Downloads, Lançamentos, Sair) no hover e no estado ativo.
- [x] **Personalização Seletiva dos Estilos Neon nos Controles da Biblioteca**: Opções individuais de 'Padrão (Manter como está)' vs 'Novo Estilo Neon Suave' na tela de Personalização para Barra de Lojas (3 opções), Header Action Icons, Filtro Alfabético & Contador e Botões de Cabeçalho (Edição em Massa, Categorias, Filtros), com Live Preview interativo e mapeamento 1:1 de cada área.
- [x] **Sistema de Degradê Vetorial com 3 Canais de Cor e Glow Direcional**: Customização com abas para Cor Inicial, Cor Final e Cor do Glow, botão de sincronização dinâmica (`[✓ Glow Sincronizado]` / `[🔄 Sincronizar]`), eliminação de wash branco via projeção direcional de 135° e seções dedicadas independentes para Ícones e Botões de Ação.
- [x] **Transparência Absoluta e Proibição de Moldura/Vidro Atrás do Logo nas Notas de Lançamento**: Eliminação total de qualquer caixa, fundo estilo vidro, borda ou sombra atrás do logo oficial do Ghost ou imagens inseridas nas notas de atualização (`ChangelogModal` e `UpdatePopupModal`).
- [x] **Preservação Permanente de Capas de Jogos Ocultados (Cover Snapshot on Hide)**: Gravação e retenção da capa ativa (customizada, SteamGridDB ou oficial) no instante exato da ocultação, blindagem contra syncs em lote e renderização 100% fiel na aba de Jogos Ocultados.
- [x] **Busca Universal e Irrestrita na Biblioteca (Bypass de Filtros Ativos)**: Ao pesquisar no campo de busca, o launcher consulta toda a biblioteca mestre, contornando abas de lojas, favoritos, categorias, instalados, plataformas e filtros alfabéticos para exibir o jogo procurado instantaneamente.
- [x] **Otimização Extrema de Performance da Biblioteca (1.463+ Jogos)**: Contenção nativa do Chromium via `content-visibility: auto`, eliminação de 4.400 listeners de janela por card, pré-indexação O(1) de categorias, lazy loading de imagens com decodificação assíncrona e lote inicial instantâneo para fluidez total a 60/120 FPS.
- [x] **Sincronização 1:1 da Barra de Lojas, Preview Fiel de Glow e 3 Alvos Interativos (Só no Logo / Só no Nome / Em Ambos)**: Barra de filtro de lojas sem corte de 6 lojas na Personalização, espelho total da Biblioteca com sincronização bidirecional, correção do preview do degradê na Cor Glow e cards visuais selecionáveis com demonstração em tempo real de cada modo de efeito.
- [x] **Resolução Segura e Dinâmica dos Ícones nos Cards de Alvo Neon (Zero Imagens Quebradas)**: Substituição de caminho estático inexistente por `targetExampleStore.icon` dinâmico em memória com fallback oficial para `<SteamLogo />` vetorial em SVG.
- [x] **Aplicação Prática e Diferenciação Fiel dos 3 Alvos do Efeito Neon (Preview & Biblioteca)**: Resolução de especificidade no CSS do preview e isolamento de seletores dinâmicos na Biblioteca. Selecionar "Só no Logo" agora aplica o neon estritamente no ícone da loja (texto branco puro), "Só no Nome" aplica neon/degradê estritamente no texto (ícone sem filtro), e "Em Ambos" ilumina ambos em perfeita harmonia.
- [x] **Controle Completo do Background da Loja Individual na Store Filter Bar (Slider de Transparência + Botão de Troca de Cor)**: Slider de transparência (0% a 100%) e botão de troca de cor com seletor expansível na seção dedicada "Background Individual da Loja", com sincronização em tempo real no Live Preview, nos 3 cards de demonstração e na Biblioteca.
- [x] **Sincronização 1:1 e Transparência Absoluta do Background na Biblioteca de Jogos**: Persistência simultânea de chaves novas e legadas (`default_bg_opacity` + `bg_opacity`), eliminação de sobreposição de fallback `0.05` no boot, desativação irrestrita de `backdrop-filter` em 0% e blindagem inline de transparência no `<button className="platform-filter-btn">`.
- [x] **Extinção Definitiva do Retângulo Avermelhado Cortado por overflow:hidden e Blindagem Total do Zero-Background na Biblioteca de Jogos**: Eliminação absoluta de qualquer caixa de fundo nos estados de repouso, hover e active através de `overflow: visible !important;`, `border: none !important; border-width: 0 !important;` e isolamento de especificidade `:not(.platform-filter-btn--zero-bg)`.
- [x] **Harmonização Perfeita do Contorno em Degradê com a Força do Neon (Glow) na Store Filter Bar**: Eliminação do ofuscamento do degradê através da arquitetura de dupla camada de luz (`drop-shadow` de contorno nítido a 135° em 0.5px de blur + halo neon suave em 0.5 de opacidade proporcional ao slider), remoção da sombra monocromática central e sincronização 1:1 no preview, cards de alvos e biblioteca.
- [x] **Paridade Completa de Customização do Alphabetical Filter & Counter com a Store Filter Bar**: Implementação do slider oficial 'Transparência do Background' (0% a 100%), botão 'Trocar Cor do Fundo' expansível com módulo réplica completo (switch Degradê, 3 abas, sincronização de glow, SVBox, Hue slider e campo Hex), blindagem anti-cápsula zero-background (zero caixas avermelhadas em repouso, hover e ativo via `overflow: visible !important;`) e neon harmônico em dupla camada para as letras A-Z e o contador de jogos.

## 🚫 Regra de Notas de Lançamento (Changelog)
- **Zero Molduras/Fundos nas Imagens**: Em todas as telas de Changelog / Notas de Lançamento, imagens e ilustrações (como o mascote Ghost lendo o pergaminho) são estritamente transparentes (`background: transparent !important; border: none !important; box-shadow: none !important; border-radius: 0 !important;`). NUNCA aplicar background estilo vidro ou bordas atrás dessas imagens.

## 🖼️ Regra de Preservação de Capas de Jogos Ocultados
- **Snapshot Fiel e Imutável no Momento da Ocultação**: Ao ocultar qualquer jogo (card individual, Edição em Massa ou desinstalação), sua capa ativa no momento (`art_cover`, `art_square`, `gameOverrides`) deve ser gravada no objeto do jogo oculto e blindada contra syncs em lote do SteamGridDB (`batchReplaceAllCovers`).

## 🔍 Regra de Busca Universal na Biblioteca
- **Bypass de Filtros Contextuais**: O campo de busca pesquisa na biblioteca mestre completa (`makeLibrary()`), exibindo os resultados imediatamente sem ser restringido pela loja ativa, letra do alfabeto, apenas instalados ou categorias.

## ⚡ Regra de Alta Performance para Bibliotecas Massivas
- **Contenção Nativa e Zero Listeners em Cards**: Todo container de grade e lista deve ter `content-visibility: auto`, cards sem listeners de janela internos, categorias indexadas em O(1) e lazy loading assíncrono em todas as capas.

## 🎨 Regra da Barra de Filtro de Lojas (Sincronização e 3 Alvos)
- **Sincronização 1:1 e 3 Alvos Selecionáveis**: A barra de filtro de lojas da Personalização deve renderizar todas as lojas visíveis sem limitação (`.slice(0, 6)`), e disponibilizar os 3 cards selecionáveis ("Só no Logo", "Só no Nome", "Em Ambos") com preview dinâmico em tempo real.

## 🛡️ Regra de Resolução Segura de Ícones (Zero Imagens Quebradas)
- **store.icon e Fallback SVG Vetorial**: Nunca utilizar caminhos estáticos hardcoded (`/images/<loja>.png`); utilizar `store.icon` em memória ou componentes SVG vetoriais com `?react` como fallback seguro.

## 🎯 Regra de Isolamento e Especificidade de CSS em Controles com Múltiplos Alvos
- **Seletores Diretos Condicionados ao Alvo**: Em componentes com múltiplos alvos visuais seletivos (`target-logo`, `target-text`, `target-both`), NUNCA aplicar regras genéricas de glow com `!important` na classe base para depois tentar cancelá-las com regras de menor especificidade. Condicione o CSS diretamente à classe do alvo ativo (`.target-logo`, `.target-text`, `.target-both`) e force o estado neutro (`color: #fff !important; filter: none !important;`) nos elementos não contemplados.

## 🎨 Regra de Customização do Background dos Botões Individuais da Barra de Lojas
- **Slider de Transparência do Background (0% a 100%) e Módulo Réplica de Cor**: Os botões individuais de loja na Store Filter Bar devem possuir controle total de fundo com slider nomeado oficialmente como **Transparência do Background** (escala de 0% totalmente transparente até 100% sólido) e botão "Trocar Cor do Fundo" que expande o módulo réplica completo (switch Degradê, 3 abas de cor: Cor Inicial, Cor Final, Cor Glow, botão de sincronização de glow e seletor de cor com SVBox, Hue slider e campo Hex), refletindo instantaneamente no Preview, nos 3 cards de demonstração e na Biblioteca. **Quando a Transparência do Background for colocada em 0%, na Biblioteca de Jogos não pode existir nenhuma caixa de fundo avermelhado nem em repouso, nem ao passar o mouse e nem quando a loja estiver clicada/selecionada.**

## 🔄 Regra de Sincronização Bidirecional e Paridade de Armazenamento
- **Persistência Simultânea e Desativação de Backdrop-Filter em 0%**: Salvar sempre chaves novas e legadas (`default_bg_opacity` + `bg_opacity`), ler via coalescência nula `??` com fallback `0` e desligar expressamente `backdrop-filter: none` em 0% para eliminar resíduo de vidro fosco em botões de lojas na Biblioteca.

## 🛡️ Regra Anti-Cápsula e Proibição de overflow:hidden em Efeitos Neon com Fundo Transparente
- **Proibição de overflow:hidden em Elementos com Neon/Glow e Zero-Background**: Em qualquer componente (como os botões da Store Filter Bar) onde o usuário possa definir a transparência do background em 0%, é **TERMINANTEMENTE PROIBIDO** manter `overflow: hidden` no elemento pai. O `overflow: hidden` decepa o `drop-shadow` nas quinas do `border-radius`, transformando o feixe de luz num retângulo geométrico fechado/sólido. Nesses estados, o elemento DEVE ter obrigatoriamente:
  - `overflow: visible !important;`
  - `border: none !important; border-width: 0 !important;`
  - `background: none !important; background-color: transparent !important; background-image: none !important;`
  - `box-shadow: none !important; backdrop-filter: none !important;`
  - Todas as regras de hover e active condicionadas a `:not(.platform-filter-btn--zero-bg)` para impedir que o CSS de neon herde fundos ou bordas sólidas.

## ✨ Regra de Harmonização entre Contorno em Degradê e Força do Neon (Glow)
- **Dupla Camada de Iluminação**: Em logos e ícones no modo Degradê, nunca aplicar drop-shadows difusos e de alta opacidade que saturem a silhueta. Aplicar estritamente:
  1. `drop-shadow(-1.5px -1.5px 0.5px ${cor1}) drop-shadow(1.5px 1.5px 0.5px ${cor2})`: traça o contorno do ícone com nitidez absoluta nas duas cores puras a 135°.
  2. `drop-shadow(-3px -3px calc(${força} * 0.7) ${cor1_suave}) drop-shadow(3px 3px calc(${força} * 0.7) ${cor2_suave})`: aura neon translúcida (alpha 0.5) proporcional ao slider de força sem apagar o contorno.
  3. Proibido adicionar sombras centrais monocromáticas `(0 0 2px ...)` no modo degradê para não contaminar a transição das cores.

## 🔤 Regra de Paridade do Filtro Alfabético & Contador
- **Paridade Visual e Comportamental 1:1**: O Filtro Alfabético e o Contador de Jogos seguem estritamente a arquitetura da Store Filter Bar: controle completo de background individual com slider oficial **Transparência do Background** (0% a 100%), botão **Trocar Cor do Fundo** com amostra dinâmica e módulo réplica completo (switch Degradê, 3 abas, sincronização de glow, SVBox, Hue slider e campo Hex), blindagem anti-cápsula zero-background (`overflow: visible !important; border: none !important;`) sem caixas avermelhadas sob 0% em repouso, hover ou ativo, e neon harmônico com texto degradê suave em dupla camada para as letras A-Z e contador.

## 🔢 Regra do Elemento Total de Jogos em Telas de Customização
- **Fidelidade da Contagem Unificada e Interatividade**: Em qualquer tela de customização com Live Preview (como `PersonalizationScreen`), o elemento **Total de Jogos** (`numberOfgames`) NUNCA deve exibir números fictícios ou estáticos (como "6"). Deve calcular a contagem real e unificada da biblioteca em memória (`realGamesList.length`, somando Epic, GOG, Steam, Amazon, Zoom e Sideloaded), ser totalmente clicável no preview (`.preview-games-total-group` com feedback de contorno ciano `#00e5ff` ao passar o mouse e selecionado) direcionando ao painel correspondente, e possuir um card de demonstração dinâmico em tempo real dentro do painel lateral.

## 🃏 Regra de Preservação Obrigatória do Efeito de Ampliação nos Cards de Jogos
- **Proibição de Contenção de Pintura e Padrão de Hover**: É terminantemente proibido utilizar `content-visibility: auto` ou `contain: paint` em `.gameList > div` ou nos cards de jogos, pois isso decepa a escala de hover. No hover, o card deve executar `transform: scale(1.06)`, `z-index: 10` e sombra profunda `box-shadow: 0px 10px 28px 6px rgba(0, 0, 0, 0.75)`, com o container da célula recebendo `.gameList > div:hover { z-index: 10; }` e a capa aplicando zoom interno suave `transform: scale(1.03)` sem cortes.

## 🏬 Regra de Logotipos Oficiais para Lojas na Barra Lateral
- **Eliminação de Ícones Genéricos e Proporção Equilibrada**: É terminantemente proibido utilizar ícones genéricos (`faShoppingBag` ou `faStore`) para representar plataformas na barra lateral ou menus flutuantes. Devem ser utilizados estritamente os vetores oficiais: `<EpicLogo />` (`epic-logo.svg`), `<GOGLogo />` (`gog-logo.svg`), `<FontAwesomeIcon icon={faSteam} />`, `<FontAwesomeIcon icon={faAmazon} />` e `<ZoomLogo />` (`zoom-logo.svg`), com `fill="currentColor"` e proporções harmoniosas de `18px` na barra expandida, `20px` na barra colapsada e `16px` no menu hover.

## 🚪 Regra de Isolamento de Fluxo e Espaçamento de Botões de Fechar ("X") e Navegação
- **Zero Invasão e Isolamento de Fluxo**: Em qualquer cabeçalho com botões de navegação circular ("Jogo Anterior" e "Próximo Jogo") e botão de fechar ("X"):
  1. Em containers flex (`InlineGameSettings`), o botão "X" deve ter `position: relative !important; top: auto !important; right: auto !important; flexShrink: 0 !important;` e classe isenta `:not(.inline-settings-close-button)` no CSS global, mantendo `gap: 18px` limpo e inalterado.
  2. Em diálogos modais com "X" absoluto a 14px (`SettingsModal`), os botões de navegação à direita devem possuir margem direita de pelo menos `58px` (`flexShrink: 0`), blindando os controles contra sobreposições com a área de 42px do "X".
  3. O título do jogo à esquerda DEVE ter sempre `minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'` para impedir que títulos longos empurrem os botões contra a borda da janela.

## 🔔 Lembretes Ativos para o Próximo Contato
- [ ] **Testar Nova Versão no Windows Sandbox (VM)**: Ao lançar uma nova versão, lembrar o usuário de testar em uma VM nova no Windows Sandbox, apresentando a lista detalhada de todas as alterações feitas.







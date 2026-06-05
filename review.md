# Review das Alterações - 04/06/2026

Compilado de todas as modificações de estilo, alinhamento, estrutura e novas funcionalidades aplicadas no Heroic Games Launcher hoje.

---

## 📋 Resumo das Alterações Realizadas

### 1. Novo Auto-Scanner de Jogos Instalados (Sideload Auto-Scanner)
* **Problema:** Usuários precisavam adicionar manualmente cada jogo instalado externamente no PC por meio do Sideload, o que requeria localizar o executável manualmente.
* **Solução:**
  - Criamos o módulo `src/backend/storeManagers/sideload/scanner.ts`.
  - Implementamos a busca automática via PowerShell na Registry do Windows para encontrar jogos instalados no PC.
  - Criamos regras inteligentes de filtragem heurística para ignorar softwares gerais, drivers e atualizadores não-jogos.
  - Implementamos um algoritmo de pontuação para correlacionar o nome da pasta com arquivos executáveis a fim de selecionar o binário correto do jogo.
  - Integramos com a API do SteamGridDB para obter automaticamente capas e imagens para os jogos detectados.
  - Adicionamos a funcionalidade de Blacklist para permitir ignorar jogos detectados que o usuário não quer importar.
  - Criamos a opção de exportar o log de varredura para um arquivo `.txt`.

### 2. Redesign Completo do Diálogo de Sideload (SideloadDialog) e Filtragem de Duplicados
* **Problema:** A interface de Sideload manual possuía campos desorganizados, caixas de imagens desalinhadas e falta de suporte para o novo auto-scanner. Além disso, jogos já adicionados continuavam poluindo a lista de escaneados.
* **Solução:**
  - Reformulamos a estrutura em `SideloadDialog` criando abas diferenciadas: **Adicionar Manualmente** e **Scanner Automático**.
  - Criamos um painel lateral esquerdo simulando o Hero Panel (`.simulated-hero-panel`), que apresenta a capa vertical em proporção de tela (`aspect-ratio: 2/3`) e links rápidos de ação com ícones correspondentes.
  - Reorganizamos a aba do Scanner Automático para listar todos os jogos detectados com capas em miniatura, nomes e binários, oferecendo controles para "Importar" ou enviar para a "Blacklist".
  - **Filtro de Duplicados:** Adicionamos um checkbox dinâmico "Ocultar itens escaneados que já estão adicionados no Heroic" para ocultar opcionalmente jogos repetidos e incluímos a tag visual de destaque "Já Adicionado" nos itens já presentes na biblioteca.
  - **Validação de Argumentos:** Adicionamos validação contra erros nos argumentos de inicialização do executável, prevenindo cliques acidentais e desabilitando o botão de finalizar se houver falhas.
  - Refatoramos todo o CSS em `SideloadDialog/index.scss` usando flexbox de duas colunas, bordas com efeitos premium e scroll otimizado.

### 3. Funcionalidade de Desinstalação em Lote (Bulk Uninstall)
* **Problema:** Não existia uma forma nativa de selecionar vários jogos na biblioteca e desinstalá-los ou removê-los em massa.
* **Solução:**
  - Implementamos o IPC handler `bulkUninstall` em `src/backend/utils/uninstaller.ts`.
  - Adicionamos suporte à desinstalação paralela com limpeza de prefixos (Wineprefix), logs e configurações locais.
  - Na tela de Biblioteca (`GamesList/index.tsx`), atualizamos o painel flutuante do modo Mass Edit (Modo de Edição em Lote) adicionando opções de "Marcar Todos", "Desmarcar Todos" e o botão "Desinstalar" com transições fluidas e desabilitação condicional se nenhum jogo for selecionado.

### 4. Botão de Alternância de Layout (Novo Modo / Modo Antigo)
* **Problema:** Havia a necessidade de alternar facilmente entre o novo layout de configurações Inline no painel lateral ("Novo Modo") e o gerenciamento clássico baseado em modais ("Modo Antigo").
* **Solução:**
  - Implementamos no painel de Personalização (`Personalization/index.tsx`) um controle switch premium (`premium-switch`) posicionado na barra de navegação mockada.
  - O estado é persistido no localStorage (`heroic_use_inline_panel`) e propaga-se dinamicamente por meio de eventos globais customizados (`heroicUseInlinePanelChanged`).

### 5. Estilização Premium e Efeitos Neon nas Configurações Inline
* **Problema:** As caixas de texto e opções de seleção nas configurações inline possuíam estilo padrão e sem refinamento estético de foco e transições.
* **Solução:**
  - Adicionamos uma folha de estilos interna sofisticada com suporte a **Glassmorphism** (`background: rgba(255, 255, 255, 0.05)`, `backdrop-filter: blur(8px)`) em todos os campos de texto, comboboxes e botões de input.
  - Implementamos efeitos de transição suave em `:hover` e foco com brilho em tom azul-turquesa (`#00ffff` e sombra neon).
  - Limpamos as bordas pretas padrão e outlines do navegador ao focar nos elementos para manter o visual premium e integrado.

---

## 🛠️ Arquivos Modificados e Criados

### Backend
- [NEW] [scanner.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/storeManagers/sideload/scanner.ts)
- [MODIFY] [main.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/main.ts)
- [MODIFY] [uninstaller.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/utils/uninstaller.ts)
- [MODIFY] [game_overrides/index.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/game_overrides/index.ts)
- [MODIFY] [storeManagers/sideload/library.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/storeManagers/sideload/library.ts)

### Frontend
- [NEW] [index.css](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Personalization/index.css)
- [MODIFY] [SideloadDialog/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Library/components/InstallModal/SideloadDialog/index.tsx)
- [MODIFY] [SideloadDialog/index.scss](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Library/components/InstallModal/SideloadDialog/index.scss)
- [MODIFY] [GamesList/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Library/components/GamesList/index.tsx)
- [MODIFY] [InlineGameSettings/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Library/components/InlineGameSettings/index.tsx)
- [MODIFY] [Personalization/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Personalization/index.tsx)

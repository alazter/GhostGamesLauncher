# Review das Alterações - 04/08/2026

Compilado de todas as modificações de estilo, alinhamento, estrutura e novas funcionalidades aplicadas no Ghost Games Launcher hoje e nas últimas sessões.

---

## 📋 Resumo das Alterações Realizadas

### 1. Customização e Padrões de Fábrica do Launcher (Factory Defaults)
* **Problema:** O launcher vinha configurado com padrões padrão originais que não condiziam com a identidade visual e o comportamento esperado do Ghost Games Launcher.
* **Solução:**
  - Implementamos a personalização de configurações padrão diretamente nos arquivos de configuração do Ghost Games Launcher.
  - Modificamos os padrões iniciais de fábrica de lojas visíveis, opacidades de botões, comportamento de ocultar na bandeja (system tray) ao fechar, e definimos o idioma padrão do app.

### 2. Correções no Atualizador Automático (Updater Fix)
* **Problema:** O sistema de atualização automática falhava em alguns cenários e apontava para links incorretos.
* **Solução:**
  - Ajustamos o `updater.ts` para importar e utilizar o pacote oficial de semver.
  - Corrigimos o redirecionamento e tratamento do link oficial da página de releases do repositório no GitHub para buscar e baixar as atualizações corretamente de `alazter/GhostGamesLauncher`.

### 3. Melhorias Visuais e Ícones de Alta Definição
* **Problema:** Alguns ícones e visualizações continham bordas indesejadas e baixa resolução.
* **Solução:**
  - Atualizamos o arquivo de ícone do Windows `win_icon.ico` para um formato de alta resolução garantindo visual premium no sistema operacional.
  - Removemos o contorno laranja indesejado da visualização das lojas (store preview) na tela de personalização.

### 4. Lançamento das Releases `0.0.2-alpha` e `0.0.3-alpha`
* **Problema:** Gerar builds estáveis sucessivas empacotando as novas melhorias para validação.
* **Solução:**
  - Realizamos o incremento de versões no `package.json` gerando as tags de pré-lançamento correspondentes.
  - Geramos as novas releases portáteis com sucesso no GitHub.

### 5. Atualizador Interno do Launcher (In-App Downloader)
* **Problema:** Usuários precisavam acessar o GitHub manualmente para baixar a nova versão após o popup de atualização.
* **Solução:**
  - Implementamos um fluxo completo de download e execução direta do executável (.exe/portable) dentro do próprio launcher.
  - Criamos o componente modal `UpdatePopupModal` com barra de progresso em tempo real e changelog integrado.
  - Implementamos o IPC `downloadLauncherUpdate` no backend para baixar a nova versão e executá-la automaticamente.

### 6. Scanner de Jogos Locais (Sideload Rules) e Otimizações de Imagem/Cache
* **Problema:** Identificação de jogos locais sideloaded necessitava de suporte a novos títulos e regras de escaneamento aprimoradas, além de otimizações de cache de imagens e ajustes na interface de usuário.
* **Solução:**
  - Expansão massiva das regras de scanner em `scanner_rules.json` e otimização do scanner de sideload no backend.
  - Refatorações no cache de imagens (`images_cache.ts` e `CachedImage`) e ajustes de layout em telas da biblioteca, cards de jogos e painel de preferências.

### 7. Otimizações de Performance e Renderização
* **Problema:** Gargalos de performance ao carregar a biblioteca ou renderizar os cards dos jogos.
* **Solução:**
  - Otimização no carregamento e verificação de imagens no componente `CachedImage`.
  - Melhorias na lógica de atualização e renderização de layouts na visualização da biblioteca (`Library` e `GameCard`/`GamesList`), diminuindo a sobrecarga de renderizações desnecessárias.

### 8. Atalhos de Desktop na Inicialização e Painel de Backup
* **Problema:** Necessidade de criar atalhos automaticamente e interface para backup/restauração de dados.
* **Solução:**
  - Implementação de criação automática de atalhos na inicialização no backend/main.ts.
  - Integração do novo painel de configurações para Backup e Restauração (`BackupRestoreSettings`).

### 9. Lançamento da Versão Beta (`v0.1.0-beta`) e Alpha (`v0.0.9-alpha`)
* **Problema:** Gerar novas versões estáveis (Beta) empacotando as otimizações.
* **Solução:**
  - Incremento de versões correspondente e publicação das releases automatizadas no GitHub.

### 10. Correção de Atalhos Portáteis (PORTABLE_EXECUTABLE_FILE)
* **Problema:** Atalhos de jogos criados na versão portátil apontavam incorretamente para o wrapper loader.
* **Solução:**
  - Ajustamos a resolução do caminho do executável usando `PORTABLE_EXECUTABLE_FILE` no Windows ao gerar os atalhos.

### 11. Sistema de Backup e Restauração na Nuvem (Cloud Backup)
* **Problema:** Sincronizar backups de configurações na nuvem.
* **Solução:**
  - Helpers de backup para empacotamento, envio e recepção de arquivos de backup.
  - Lógica do painel `BackupRestoreSettings.tsx` suportando opções de backup na nuvem.

### 12. Lançamento das Versões `v0.1.1-beta` e `v0.1.2-beta`
* **Solução:** Incremento de versão e publicação automatizada das novas releases no GitHub.

### 13. Paralelização na Busca de Capas (Startup Speedup)
* **Problema:** A busca síncrona por capas de jogos sideloaded no SteamGridDB atrasava a inicialização do launcher em até 10 segundos.
* **Solução:**
  - Reformulamos a lógica em `sideload/library.ts` para executar a busca e cache em segundo plano de maneira concorrente, com limite de concorrência igual a 3. O startup agora é instantâneo.

### 14. Filtro e Ordenação por Jogos Recentes (Recent Games Sort)
* **Problema:** Usuários precisavam rolar ou buscar para encontrar os jogos jogados recentemente.
* **Solução:**
  - Adicionada opção de ordenação rápida `sortByRecent` na biblioteca, priorizando no grid/lista os últimos 12 títulos que foram executados.

### 15. Widget de Status do Cloud Backup
* **Problema:** Falta de feedback visual em tempo real sobre o estado de sincronização com o Cloud Backup.
* **Solução:**
  - Implementado widget de nuvem no rodapé da biblioteca, exibindo dinamicamente o status (atualizado, pendente, erro ou inativo) com cores e mensagens informativas no hover.

### 16. Lançamento das Versões `v0.1.3-beta` e `v0.1.4-beta`
* **Solução:** Incremento de versão no package.json e publicação automatizada das novas releases estáveis (Beta) no GitHub.

### 17. Documentação das Regras de Lançamento
* **Solução:**
  - Criação de `.agents/AGENTS.md` para documentar e aplicar os padrões de lançamento do Ghost Launcher (como cabeçalhos de descrição, tags, imagem de atualização oficial e auto-detecção lógica de semver).

### 18. Lançamento da Versão `v0.1.5-beta` e Otimizações de Imagens / Lojas
* **Solução:**
  - Incremento de versão para `v0.1.5-beta` no `package.json`.
  - Melhorias e ajustes no gerenciador de lojas (`storeManagers/index.ts`) e ajudantes do SteamGridDB (`steamgridHelper.ts`).
  - Otimização da estratégia de cache de imagens (`images_cache.ts`).

---

## 🛠️ Arquivos Modificados e Criados

### Configuração e Build
- [MODIFY] [package.json](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/package.json)
- [MODIFY] [electron-builder.yml](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/electron-builder.yml)
- [MODIFY] [review.md](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/review.md)
- [NEW] [.agents/AGENTS.md](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/.agents/AGENTS.md)

### Backend & Core
- [MODIFY] [updater.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/updater.ts)
- [MODIFY] [main.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/main.ts)
- [MODIFY] [main_window.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/main_window.ts)
- [MODIFY] [images_cache.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/images_cache.ts)
- [MODIFY] [game_overrides/index.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/game_overrides/index.ts)
- [MODIFY] [scanner.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/storeManagers/sideload/scanner.ts)
- [MODIFY] [scanner_rules.json](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/storeManagers/sideload/scanner_rules.json)
- [MODIFY] [storeManagers/index.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/storeManagers/index.ts)
- [MODIFY] [tray_icon.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/tray_icon/tray_icon.ts)
- [MODIFY] [types.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/common/types.ts)
- [MODIFY] [ipc.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/common/types/ipc.ts)
- [MODIFY] [progress_bar.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/progress_bar.ts)
- [MODIFY] [utils.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/utils.ts)
- [MODIFY] [heroicVersion.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/utils/systeminfo/heroicVersion.ts)
- [MODIFY] [index.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/utils/systeminfo/index.ts)
- [MODIFY] [progress_bar.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/__tests__/progress_bar.test.ts)
- [MODIFY] [steamgridHelper.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/storeManagers/sideload/steamgridHelper.ts)
- [MODIFY] [sideload/library.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/storeManagers/sideload/library.ts)
- [NEW] [cloudBackup.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/backup/cloudBackup.ts)
- [NEW] [backupHelper.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/backup/backupHelper.ts)

### Preload & API
- [MODIFY] [misc.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/preload/api/misc.ts)
- [MODIFY] [library.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/preload/api/library.ts)

### Frontend
- [MODIFY] [App.css](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/App.css)
- [MODIFY] [App.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/App.tsx)
- [MODIFY] [index.scss](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/index.scss)
- [MODIFY] [CachedImage/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/components/UI/CachedImage/index.tsx)
- [MODIFY] [Header/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/components/UI/Header/index.tsx)
- [MODIFY] [Header/index.css](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/components/UI/Header/index.css)
- [MODIFY] [Personalization/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Personalization/index.tsx)
- [MODIFY] [Personalization/index.css](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Personalization/index.css)
- [MODIFY] [StoreLogos/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/components/UI/StoreLogos/index.tsx)
- [MODIFY] [HeroicVersion/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/components/UI/Sidebar/components/HeroicVersion/index.tsx)
- [MODIFY] [HeroicVersion/index.scss](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/components/UI/Sidebar/components/HeroicVersion/index.scss)
- [MODIFY] [SidebarLinks/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/components/UI/Sidebar/components/SidebarLinks/index.tsx)
- [MODIFY] [Sidebar/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/components/UI/Sidebar/index.tsx)
- [MODIFY] [Library/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Library/index.tsx)
- [MODIFY] [LibraryHeader/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Library/components/LibraryHeader/index.tsx)
- [MODIFY] [LibraryContext.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Library/LibraryContext.tsx)
- [MODIFY] [GameCard/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Library/components/GameCard/index.tsx)
- [MODIFY] [GameCard/index.css](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Library/components/GameCard/index.css)
- [MODIFY] [GamesList/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Library/components/GamesList/index.tsx)
- [MODIFY] [HeroPanel/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Library/components/HeroPanel/index.tsx)
- [MODIFY] [InlineGameSettings/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Library/components/InlineGameSettings/index.tsx)
- [MODIFY] [SideloadDialog/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Library/components/InstallModal/SideloadDialog/index.tsx)
- [MODIFY] [LogSettings/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Settings/sections/LogSettings/index.tsx)
- [MODIFY] [GeneralSettings/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Settings/sections/GeneralSettings/index.tsx)
- [MODIFY] [BackupRestoreSettings.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Settings/components/BackupRestoreSettings.tsx)
- [MODIFY] [constants.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/hooks/constants.ts)
- [MODIFY] [hasStatus.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/hooks/hasStatus.ts)
- [MODIFY] [GlobalState.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/state/GlobalState.tsx)
- [MODIFY] [types.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/types.ts)
- [MODIFY] [ActionIcons/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/components/UI/ActionIcons/index.tsx)
- [MODIFY] [LibraryFilters/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/components/UI/LibraryFilters/index.tsx)
- [MODIFY] [SteamGridDBPicker/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/components/UI/SteamGridDBPicker/index.tsx)
- [NEW] [localStorageBackup.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/utils/localStorageBackup.ts)
- [NEW] [update-ghost.png](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/assets/update-ghost.png)
- [NEW] [UpdatePopupModal/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/components/UI/UpdatePopupModal/index.tsx)
- [NEW] [UpdatePopupModal/index.scss](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/components/UI/UpdatePopupModal/index.scss)

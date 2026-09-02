# Review das Alterações - 02/09/2026

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

### 19. Limpeza e Sanitização de Títulos Sideload e Refatoração de Executáveis
* **Problema:** Nomes de jogos escaneados do registro vinham com sufixos/lixo de versão ou desinstaladores, e a lógica de seleção do melhor `.exe` estava duplicada.
* **Solução:**
  - Adicionada função `cleanScannedGameTitle` e `sanitizeExistingSideloadLibrary` no backend do sideload scanner para limpar e higienizar títulos na biblioteca existente e ao escanear.
  - Criado o utilitário `findBestExecutable` para unificar a seleção do executável principal dos jogos escaneados.

### 20. Resolução Definitiva de Ícone Permanente e Tratamento de Erros OAuth (Google Cloud)
* **Problema:** Ícones de atalhos e janelas perdiam o formato HD em certos ambientes portáteis e o login OAuth do Google Cloud apresentava erro 403 (access_denied) sem explicação clara.
* **Solução:**
  - Criada a função `ensurePermanentAppIcon()` em `paths.ts` com busca em múltiplos caminhos e cópia resiliente do `win_icon.ico` para `userDataPath`.
  - Atualizada a criação da janela principal e dos atalhos da área de trabalho para usarem o ícone permanente.
  - Implementada captura e tratamento de erros OAuth (como `access_denied`/403) no servidor HTTP callback de `cloudBackup.ts`.
  - Adicionadas dicas visuais de configuração de usuários de teste no painel `BackupRestoreSettings.tsx`.

### 21. AdBlocker de Rede / DoH, Tela de Releases, Filtro de Duplicados e Otimização de Tray
* **Problema:** Exibição de anúncios em webviews, falta de visualização histórica de lançamentos no launcher, duplicatas de títulos de lojas/sideload e inicialização minimizada ao ligar o Windows.
* **Solução:**
  - Configurado DNS criptografado via HTTPS (Quad9 Secure DoH) e bloqueador de anúncios/trackers via `onBeforeRequest` no backend (`main.ts`).
  - Criada a tela de **Lançamentos** (`/releases`) integrada com atalho na Sidebar e preview de atalhos na tela de Personalização (`Personalization/index.tsx`).
  - Criada detecção e filtro inteligente de **Jogos Duplicados** no cabeçalho da Biblioteca (`getDuplicateGameIds`).
  - Otimizadas as configurações de inicialização com o Windows (`startAtLogin` + `startInTray`), abrindo oculto/minimizado na bandeja automaticamente.

### 22. Seletor de Idioma (PT-BR / EN) com Bandeiras HD e Tradução Dinâmica na Tela de Lançamentos
* **Problema:** A página de Lançamentos exibia o changelog em inglês sem opção intuitiva de alternar o idioma para Português (Brasil).
* **Solução:**
  - Adicionadas imagens de alta definição das bandeiras 🇧🇷 Brasil (`flag_br.png`) e 🇺🇸 Estados Unidos (`flag_us.png`).
  - Implementado sistema de tradução injetado via Webview para converter datas relativas ("Aug 6th 3 days ago" -> "6 Agosto 3 dias atrás") e textos da interface em tempo real.
  - Adicionada barra de ferramentas e botões de bandeira com animação hover para rápida alternância de idioma.

### 23. Guia de Expansão da Sidebar do Releases e Ajustes de Cores de Tema HSL/RGBA
* **Problema:** A barra lateral esquerda da tela do Releases comprimia o logo `releases` e textos do menu, e as cores do topo e painéis precisavam de harmonização visual no tema escuro.
* **Solução:**
  - Criado o documento [docs/RELEASES_SIDEBAR_GUIDE.md](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/docs/RELEASES_SIDEBAR_GUIDE.md) definindo a regra de 280px de largura e remoção de cortes de texto.
  - Adicionada regra no `.agents/AGENTS.md` para prescrever o guia em todas as futuras manutenções.
  - Ajustados os seletores CSS injetados via Webview em `Releases/index.tsx` para fundos `rgba(3, 4, 5, 1)` (topbar/sidebars) e `hsl(242, 37%, 18%)` (área central de jogos).

### 24. Lançamento das Versões `v0.1.7-beta` e `v0.1.8-beta`
* **Solução:**
  - Incremento de versão no `package.json` para `v0.1.8-beta`.
  - Atualização de regras de scanner em `scanner_rules.json` e publicação automatizada das novas releases no GitHub.

### 25. Badge Vermelho de Notificação de Lançamentos do Dia na Sidebar
* **Problema:** Usuários não tinham ciência de lançamentos de jogos ocorrendo no dia atual sem abrir manualmente a tela de Lançamentos.
* **Solução:**
  - Criado o auxiliar de varredura `releasesScanner.ts` que consulta e identifica lançamentos para a data atual.
  - Implementado o selo visual de notificação (`Sidebar__badge`) no ícone de "Lançamentos" da barra lateral com estilo circular vermelho neon em `SidebarItem`.
  - Adicionada limpeza automática do badge ao clicar no item de menu e sincronização de eventos com `ghostReleasesBadgeChanged`.

### 26. Submenu Hover de Lojas na Sidebar, Categorias Automáticas por Loja e Suporte a Steam no WebView
* **Problema:** Necessidade de atalhos diretos para navegar em cada loja na Sidebar, separação automática de jogos por loja na biblioteca e opção de silenciar o aviso de login não efetuado.
* **Solução:**
  - Criado o componente `StoreHoverMenu` (com estilos CSS dedicados) no item de Lojas da barra lateral.
  - Implementados os auxiliares `autoStoreCategories.ts` e `autoStoreAssignments.ts` para agrupar jogos automaticamente por loja.
  - Adicionada integração para a loja Steam (`/store/steam`) no WebView do launcher com partição `steamstore`.
  - Adicionada a opção "Não mostrar novamente" com `ToggleSwitch` no modal de aviso de login `LoginWarning`.

### 27. Performance Virtualizada para 900+ Jogos, Ocultação de Duplicados e Protocolos de Skills
* **Problema:** Lentidão na navegação da biblioteca com centenas de jogos, necessidade de atribuir jogos a lojas customizadas e esconder jogos duplicados manualmente.
* **Solução:**
  - Implementada virtualização CSS nativa com contenção por GPU (`contain: layout style paint`) e lazy storage lookups em `Library`, `GamesList` e `GameCard`.
  - Adicionado modo de edição de duplicados com botão de ocultar rastreamento (`hideFromDuplicates`) e filtro visual para exibir/ocultar duplicados.
  - Criado o seletor automático de pasta raiz no file picker de executáveis nas configurações do jogo.
  - Atualizado o `.agents/AGENTS.md` com protocolos de consulta às habilidades em `C:\Users\alazt\Documents\GitHub\Skills\Ghost Games Launcher\`.

### 28. HeroPanel Cover Art, Notificações de Tracking de Lançamentos e Lembretes de Afazeres
* **Problema:** O HeroPanel cortava capas ou exibia capas genéricas sem aplicar as customizações do usuário, e faltava notificação em tempo real de jogos em tracking do Releases.com para a data atual.
* **Solução:**
  - Unificada a proporção de tela dos cards (173/275) e utilizado `getImageFormatting` em `HeroPanel` para renderizar a capa exata configurada pelo usuário.
  - Otimizadas as dimensões do HeroPanel (310px) e removido o botão redundante de configurações na base.
  - Implementada notificação silenciosa de lançamentos em tracking baseada na data do Windows (`releasesScanner.ts`).
  - Adicionados os lembretes de prioridade para a próxima sessão em `.agents/AGENTS.md`.

### 29. Suporte Nativo Completo à Conta Steam, Notificação de Lançamentos do Dia e Polimento de Temas
* **Problema:** Ausência de suporte à integração da conta Steam como runner nativo com catálogo unificado de jogos instalados/não instalados, e notificações de desktop para lançamentos de jogos rastreados no Releases.com.
* **Solução:**
  - Implementada integração nativa completa com a Steam (`'steam'`), com escaneamento automático da conta local (`Alazter`), catálogo unificado de 341 jogos (87 instalados com botão "Jogar" e 254 não instalados com botão "Instalar").
  - Adicionada resolução dinâmica de capas HD 600x900 via CDN oficial da Valve (`cdn.akamai.steamstatic.com`) e suporte a busca/seleção customizada de artes via SteamGridDB.
  - Implementado sistema de notificações no desktop do Windows para jogos em tracking com lançamento no dia atual.
  - Ajustados os estilos e temas na tela de Lançamentos com paletas confortáveis de modo escuro e transições suaves.
  - Atualizada a documentação e regras ativas em `.agents/AGENTS.md`.

### 30. Integração Total da Steam no Ghost, Downloader Nativo, Seletor de Unidades e Deleção/Ocultação
* **Problema:** Integração da Steam como runner nativo com suporte a downloads diretos, seletor de discos no modal de instalação, e suporte a ocultação/deleção de jogos da biblioteca.
* **Solução:**
  - Finalizada a integração da conta Steam (`'steam'`), com escaneamento local da conta `Alazter`, exibindo 341 jogos (87 instalados com botão Jogar e 254 não instalados com botão Instalar).
  - Criado o módulo `downloader.ts` e `authModal.ts` no backend da Steam para autenticação via Steam Guard e suporte a downloads no Gerenciador de Downloads.
  - Implementado o componente `DriveSelector` para identificação de unidades/SSDs do Windows com barra de espaço livre no modal de instalação.
  - Atualizados os modais `UninstallModal` e menus de contexto para suporte completo a remoção e ocultação de jogos da Steam na biblioteca.
  - Registrado lembrete ativo no `.agents/AGENTS.md` para validação prática de ocultação/deleção de jogos da Steam.

### 31. Otimização Instantânea de Capas da Steam, Cache em Memória Síncrono e Modal Batch SteamGridDB
* **Problema:** Diferença de performance no carregamento inicial de capas dos 341 jogos da Steam importados vs outras lojas, e necessidade de edição visual em lote via SteamGridDB.
* **Solução:**
  - Reformulada a arquitetura do `images_cache.ts` com indexação em memória síncrona (`syncMemoryIndexFromDisk`), eliminação de chamadas de disco bloqueantes e pré-população concorrente de thumbnails em `steam/library.ts` e `steamgridHelper.ts`. Renderização de capas agora é 100% instantânea.
  - Otimizado o componente `CachedImage` com resolução direta de caminhos `file://` e redução de re-renders desnecessários.
  - Criado o componente `SteamGridBatchModal` para busca, pré-visualização e aplicação em lote de capas e banners do SteamGridDB diretamente na biblioteca.
  - Atualizada a lista de conquistas e lembretes ativos no `.agents/AGENTS.md`.

---

## 🛠️ Arquivos Modificados e Criados

### Configuração e Build
- [MODIFY] [package.json](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/package.json)
- [MODIFY] [electron-builder.yml](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/electron-builder.yml)
- [MODIFY] [review.md](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/review.md)
- [NEW] [.agents/AGENTS.md](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/.agents/AGENTS.md)
- [NEW] [docs/RELEASES_SIDEBAR_GUIDE.md](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/docs/RELEASES_SIDEBAR_GUIDE.md)

### Configuração e Build
- [MODIFY] [package.json](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/package.json)
- [MODIFY] [electron-builder.yml](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/electron-builder.yml)
- [MODIFY] [review.md](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/review.md)
- [NEW] [.agents/AGENTS.md](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/.agents/AGENTS.md)
- [NEW] [docs/RELEASES_SIDEBAR_GUIDE.md](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/docs/RELEASES_SIDEBAR_GUIDE.md)

### Backend & Core
- [MODIFY] [updater.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/updater.ts)
- [MODIFY] [main.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/main.ts)
- [MODIFY] [main_window.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/main_window.ts)
- [MODIFY] [constants/paths.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/constants/paths.ts)
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
- [MODIFY] [cloudBackup.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/backup/cloudBackup.ts)
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
- [MODIFY] [TraySettings.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Settings/components/TraySettings.tsx)
- [MODIFY] [helpers/library.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/helpers/library.ts)
- [MODIFY] [constants.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/hooks/constants.ts)
- [MODIFY] [hasStatus.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/hooks/hasStatus.ts)
- [MODIFY] [GlobalState.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/state/GlobalState.tsx)
- [MODIFY] [types.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/types.ts)
- [MODIFY] [ActionIcons/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/components/UI/ActionIcons/index.tsx)
- [MODIFY] [LibraryFilters/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/components/UI/LibraryFilters/index.tsx)
- [MODIFY] [SteamGridDBPicker/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/components/UI/SteamGridDBPicker/index.tsx)
- [NEW] [Releases/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Releases/index.tsx)
- [NEW] [Releases/index.css](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Releases/index.css)
- [NEW] [localStorageBackup.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/utils/localStorageBackup.ts)
- [NEW] [update-ghost.png](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/assets/update-ghost.png)
- [NEW] [UpdatePopupModal/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/components/UI/UpdatePopupModal/index.tsx)
- [NEW] [UpdatePopupModal/index.scss](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/components/UI/UpdatePopupModal/index.scss)

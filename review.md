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

# Review das Alterações - 03/09/2026

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

### 32. Faixa "NOVO", Ordenação por Adicionados Recentemente / Mais Jogados, Undo de Capas e Horas Steam
* **Problema:** Destacar novos títulos no catálogo sem ocultar outros jogos, ordenar por horas jogadas, sistema de restauração de capas do SteamGridDB e sincronização de horas jogadas da Steam.
* **Solução:**
  - Criada fita diagonal "NOVO" no canto superior direito dos cards de jogos e auxiliar `newGamesTracker.ts`.
  - Adicionadas opções de ordenação `✨ Classificar por Adicionados Recentemente` e `⏱️ Classificar por Mais Jogados` no painel de filtros e cabeçalho da biblioteca.
  - Implementado sistema de backup automático e reversão (Undo) de capas do SteamGridDB em Configurações > SteamGridDB com o botão `⏪ Reverter para Capas Anteriores`.
  - Desenvolvido parser de `localconfig.vdf` para sincronizar automaticamente as horas jogadas dos 335+ jogos da Steam no `timestampStore`.
  - Atualizado `.agents/AGENTS.md` registrando as novas conquistas e conquistas do sistema.

### 33. Busca Universal na Biblioteca, Padrão Neon Ciano nos Ícones/X, Sistema de Degradê 3 Canais e Snapshot de Ocultados
* **Problema:** Busca restringida por filtros ativos, inconsistência visual nos botões de fechar "X" e ícones da sidebar, falta de personalização seletiva neon e perda de capa ao ocultar jogos.
* **Solução:**
  - Implementada busca universal irrestrita na biblioteca (`index.tsx`), consultando a biblioteca mestre completa ao pesquisar e contornando filtros de loja, plataforma, categoria e alfabeto.
  - Padronizado o estilo Glassmorphism com neon ciano (`#00ffff`) e glow direcional em janelas, modais (`Dialog`, `InstallModal`, `MessageBoxModal`) e formulários (`FormControl`).
  - Aplicado o padrão oficial do botão fechar ("X") usando `<FontAwesomeIcon icon={faTimes} />` com glow direto sobre o glifo no hover e eliminado qualquer fundo/anel.
  - Aplicado glow neon ciano direto sobre os glifos dos ícones da barra lateral esquerda e nos controles da biblioteca (Barra de Lojas, Header Action Icons, Filtro Alfabético & Contador e Botões de Cabeçalho) com Live Preview interativo na tela de Personalização.
  - Desenvolvido o sistema de degradê vetorial com 3 canais de cor (Inicial, Final, Glow) e projeção direcional de 135°.
  - Garantida transparência absoluta atrás de logos/ilustrações no Changelog e criado o snapshot permanente de capas no momento da ocultação do jogo.
  - Atualizadas as regras mandatórias em `.agents/AGENTS.md`.

### 34. Transparência Absoluta e Blindagem Zero-Background na Store Filter Bar e Alphabetical Filter
* **Problema:** Retângulos avermelhados decepados por `overflow:hidden` em botões com background transparente (0%), falta de paridade no Filtro Alfabético & Contador, necessidade de iluminação neon em dupla camada e contagem real unificada.
* **Solução:**
  - Implementado slider oficial **Transparência do Background** (0% a 100%) e botão **Trocar Cor do Fundo** expansível com módulo réplica em `Store Filter Bar` e `Alphabetical Filter & Counter`.
  - Aplicada a blindagem anti-cápsula zero-background com `overflow: visible !important;` e desativação total de bordas e backdrop-filter em 0%, eliminando qualquer caixa avermelhada nos estados repouso, hover e ativo.
  - Desenvolvida a arquitetura de dupla camada de luz (`drop-shadow` nítido a 135° + halo neon translúcido proporcional ao slider) sem sombras monocromáticas.
  - Atualizado o elemento **Total de Jogos** (`numberOfgames`) para exibir a contagem real unificada em memória (`realGamesList.length`) e feedback visual interativo no Live Preview.
  - Preservado obrigatoriamente o efeito de zoom em hover nos cards (`scale(1.06)`, `z-index: 10` e zoom interno `scale(1.03)`) sem cortes por contenção de pintura.
  - Substituídos ícones genéricos na sidebar por vetores oficiais de marcas (`<EpicLogo />`, `<GOGLogo />`, `<FontAwesomeIcon icon={faSteam} />`, `<FontAwesomeIcon icon={faAmazon} />`, `<ZoomLogo />`).
  - Registradas todas as novas diretrizes no `.agents/AGENTS.md`.

# Review das Alterações - 24/09/2026

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
  - Implementado sistema de notificações no desktop do Windows para jogos em tracking com lançamento no day atual.
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

### 32. Faixa "NOVO", Ordenação por Adicionados Recentemente / Mais Jogados, Undo de Capas e Horas Steam
* **Problema:** Destacar novos títulos no catálogo sem ocultar outros jogos, ordenar por horas jogadas, sistema de restauração de capas do SteamGridDB e sincronização de horas jogadas da Steam.
* **Solução:**
  - Criada fita diagonal "NOVO" no canto superior direito dos cards de jogos e auxiliar `newGamesTracker.ts`.
  - Adicionadas opções de ordenação `✨ Classificar por Adicionados Recentemente` e `⏱️ Classificar por Mais Jogados` no painel de filtros e cabeçalho da biblioteca.
  - Implementado sistema de backup automático e reversão (Undo) de capas do SteamGridDB em Configurações > SteamGridDB com o botão `⏪ Reverter para Capas Anteriores`.
  - Desenvolvido parser de `localconfig.vdf` para sincronizar automaticamente as horas jogadas dos 335+ jogos da Steam no `timestampStore`.
  - Atualizado `.agents/AGENTS.md` registrando as novas conquistas e conquistas do sistema.

### 33. Busca Universal na Biblioteca, Padrão Neon Ciano nos Ícones/X, Sistema de Degradê 3 Canais e Snapshot de Ocultados
* **Problema:** Busca restringida por filtros ativos, inconsistência visual nos botões de fechar "X" e ícones da sidebar, falta de personalização seletiva neon e perda de capa ao ocultar jogos.
* **Solução:**
  - Implementada busca universal irrestrita na biblioteca (`index.tsx`), consultando a biblioteca mestre completa ao pesquisar e contornando filtros de loja, plataforma, categoria e alfabeto.
  - Padronizado o estilo Glassmorphism com neon ciano (`#00ffff`) e glow direcional em janelas, modais (`Dialog`, `InstallModal`, `MessageBoxModal`) e formulários (`FormControl`).
  - Aplicado o padrão oficial do botão fechar ("X") usando `<FontAwesomeIcon icon={faTimes} />` com glow direto sobre o glifo no hover e eliminado qualquer fundo/anel.
  - Aplicado glow neon ciano direto sobre os glifos dos ícones da barra lateral esquerda e nos controles da biblioteca (Barra de Lojas, Header Action Icons, Filtro Alfabético & Contador e Botões de Cabeçalho) com Live Preview interativo na tela de Personalização.
  - Desenvolvido o sistema de degradê vetorial com 3 canais de cor (Inicial, Final, Glow) e projeção direcional de 135°.
  - Garantida transparência absoluta atrás de logos/ilustrações no Changelog e criado o snapshot permanente de capas no momento da ocultação do jogo.
  - Atualizadas as regras mandatórias em `.agents/AGENTS.md`.

### 34. Transparência Absoluta e Blindagem Zero-Background na Store Filter Bar e Alphabetical Filter
* **Problema:** Retângulos avermelhados decepados por `overflow:hidden` em botões com background transparente (0%), falta de paridade no Filtro Alfabético & Contador, necessidade de iluminação neon em dupla camada e contagem real unificada.
* **Solução:**
  - Implementado slider oficial **Transparência do Background** (0% a 100%) e botão **Trocar Cor do Fundo** expansível com módulo réplica em `Store Filter Bar` e `Alphabetical Filter & Counter`.
  - Aplicada a blindagem anti-cápsula zero-background com `overflow: visible !important;` e desativação total de bordas e backdrop-filter em 0%, eliminando qualquer caixa avermelhada nos estados repouso, hover e ativo.
  - Desenvolvida a arquitetura de dupla camada de luz (`drop-shadow` nítido a 135° + halo neon translúcido proporcional ao slider) sem sombras monocromáticas.
  - Atualizado o elemento **Total de Jogos** (`numberOfgames`) para exibir a contagem real unificada em memória (`realGamesList.length`) e feedback visual interativo no Live Preview.
  - Preservado obrigatoriamente o efeito de zoom em hover nos cards (`scale(1.06)`, `z-index: 10` e zoom interno `scale(1.03)`) sem cortes por contenção de pintura.
  - Substituídos ícones genéricos na sidebar por vetores oficiais de marcas (`<EpicLogo />`, `<GOGLogo />`, `<FontAwesomeIcon icon={faSteam} />`, `<FontAwesomeIcon icon={faAmazon} />`, `<ZoomLogo />`).
  - Registradas todas as novas diretrizes no `.agents/AGENTS.md`.

### 35. Redesign Cyber Neon do Gerenciador de Downloads, Telemetria Steam Real, Paridade de Capas e Auto-Update
* **Problema:** Downloads da Steam invisíveis ou travando em 99%, senoides fictícias de velocidade, ausência de telemetria real de rede/disco, desacoplamento de capas/backgrounds com a biblioteca e falta de switch auto-update.
* **Solução:**
  - Redesign completo Cyber Neon / Glassmorphism Split Grid no Gerenciador de Downloads (`/download-manager`), com barra de progresso em gradiente Ghost (`linear-gradient(90deg, #2563eb, #00ffff)`), cards de fila translúcidos e pluralização gramatical (`CONCLUÍDO (1)` vs `CONCLUÍDOS (N)`).
  - Implementado switch toggle deslizante Cyber Neon de Atualizações Automáticas (`.premium-switch`) na barra superior de Downloads com persistência no `autoUpdateGames`.
  - Desenvolvida a telemetria 100% real de downloads da Steam baseada no parser de `content_log.txt` (taxa de rede em Mbps/8, bytes e staging exatos sem senoides `Math.sin`), resolvendo o congelamento em 99% e garantindo transição para a seção "CONCLUÍDOS".
  - Sincronização 1:1 de capas (`art_square`) e background desfocado (`cardBgImage`) com a biblioteca em todos os cards de downloads (Ativo, Fila, Concluídos), com preenchimento integral (Flush Poster) sem margens ou vazios.
  - Alinhamento uniforme alinhado à esquerda nos cards concluídos com logotipo da loja no topo direito e clique na capa abrindo a busca de capas do SteamGridDB isoladamente em tela cheia.
  - Sincronização silenciosa e não-intrusiva da Steam via `SteamQueueWatcher` (0% CPU em repouso), descarte de falsos positivos como o app ID "1003800" (Gang Beasts Soundtrack) e eliminação do crash de boot por TDZ de logging.
  - Otimização extrema da tela de Configurações dividida em 26 subcomponentes com lazy loading e carregamento instantâneo de capas via geometria reservada e `loading="eager"`.

### 36. Eliminação Total de Lag na Navegação da Biblioteca e Interceptação ESC
* **Problema:** Otimização de renderização, remoção de listeners desnecessários e atalho global ESC para desmarcar seleção e fechar HeroPanel/InlineSettings.
* **Solução:**
  - Extinção definitiva do lag na navegação por scroll, teclado e controle na Biblioteca. Purificação de `imageVisibilityObserver.ts` com remoção total de `runSweep()`, `sweepVisibleImages()` e todos os listeners manuais de scroll.
  - Interceptação global e local da tecla ESC desmarcando instantaneamente o contorno neon ciano (`.selectedInline`) da capa selecionada no grid da Biblioteca, fechando o painel expandido (`HeroPanel`), fechando as configurações inline (`InlineGameSettings`) e desativando a edição em massa (`heroicToggleMassEdit`).
  - Otimização do phantom box overlay para menus de contexto via `requestAnimationFrame` e early exit em 0ms quando nenhum menu está visível.
  - Otimização do cálculo de altura do header via `requestAnimationFrame` e listener passivo de `resize`.

### 37. Sistema de Plugins de Fontes de Jogos, GhostShield Save Manager (48 Jogos Piratas), Comparador Multi-Fonte Cyber Neon, Preservação de Saves em Migrações e Detecção Precisa de Tamanhos
* **Problema:** Integração de plugins de download e busca de jogos fora de lojas oficiais (SteamRIP, AnkerGames, Online-Fix, NXBrew, NSWGF, RomsLab), falta de backup automático de saves para jogos de procedência "Piratas", bloqueio de diálogos nativos brancos do Windows (`showMessageBox`), incompatibilidade com mirrors externos e desacoplamento na busca/gerenciador de downloads.
* **Solução:**
  - **Ecossistema de Plugins Game Source Sandbox**: Criação do SDK Sandbox (`pluginManager.ts`, `pluginHost.ts`, `networkGuard.ts`) com permissão `'game-sources'` e lista `TRUSTED_GAME_MIRROR_DOMAINS` (`pixeldrain`, `buzzheavier`, `fileditch`, `gofile`, `1fichier`, `rapidgator`, `mega`, `mediafire`, `archive.org`), suporte a resoluções diretas, Magnet e integração com TorBox API (`torboxClient.ts`).
  - **GhostShield Save Manager & Motor de IA (48 Jogos Piratas)**: Motor em 7 camadas (`piratasSaveKnowledge.ts`) para auto-detecção e snapshot automático de saves de jogos da loja Piratas (Goldberg, RUNE, CODEX, OnlineFix, Unreal, Unity, Godot) cobrindo 48 jogos mapeados (~2 GB protegidos). Modal Cyber Neon com restore em 1 clique e snapshot preventivo automático.
  - **Eliminação Definitiva de Diálogos Nativos do Win32 (`dialog.showMessageBox`)**: Criação do Modal Cyber Neon de Troca de Fonte / Atualização de Jogos com container `#131a20`, contorno ciano neon, comparador visual dinâmico (*Fonte Atual ➔ Nova Fonte*), preservação de saves GhostShield e botão fechar `<FontAwesomeIcon icon={faTimes} />` sem moldura (Regra 12).
  - **Resolução e Separação Precisa de Tamanho de Download vs Tamanho Instalado**: Extração multi-camada no backend (`websiteSource.ts`) tratando JSON-LD, badges e especificações, exibindo badges dinâmicas no Hero Card e chips técnicos.
  - **Detecção Automática e Inclusão da Pasta Atual no Seletor "Instalar em:"**: Auto-detecção do diretório atual do jogo instalado com injeção automática no topo do `<select>` com rótulo `🎯 ${p} (Pasta Atual do Jogo)`, permitindo atualizações *in-place* diretas e preservação de saves.
  - **Integração de Downloads Externos no Gerenciador de Downloads (`/download-manager`)**: Renderização de `<ExternalDownloads hideWhenEmpty={true} />` com cards Cyber Neon, capas com blur, velocidade em tempo real, suporte a arquivos `.zip`, `.rar`, `.7z`, `.iso` e botão `[ ▶ Jogar ]` com glow verde-esmeralda.
  - **Normalização Universal de Providers e Vitrine Interativa**: Resolvedor universal `isMatchingProvider` corrigindo o clique nos cards de destaques da Home (AnkerGames, SteamRIP, Online-Fix, Nintendo Switch Collection) com fallback resiliente de download e injeção síncrona em memória.
  - **Atribuição Seletiva Exclusiva à Loja "Piratas"**: Restrição rígida em `autoStoreAssignments.ts` para que apenas jogos de SteamRIP, AnkerGames e Online-Fix sejam atribuídos à loja Piratas, isolando jogos de Switch (NXBrew, NSWGF, RomsLab) em suas respectivas categorias.
  - **Qualidade & Testes**: Suíte de testes unitários Jest automatizados (`src/backend/plugins/__tests__`) com 100% de aprovação e 0 erros no TypeScript (`pnpm exec tsc --noEmit`).

### 38. Indicador Dinâmico de Backup no Rodapé da Biblioteca, Gerenciador de Pastas Cyber Neon e Auto-Backup GhostShield
* **Problema:** Texto estático no widget de backup, falta de gerenciador de pastas de instalação para executáveis externos com caminhos longos, formato antigo de exportação de backups e ausência de verificação diária de updates para jogos piratas.
* **Solução:**
  - **Indicador Dinâmico de Backup em Nuvem**: Supressão absoluta do texto estático "Conta Conectada", gaveta animada ultra suave (`transition: max-width 0.45s cubic-bezier(0.16, 1, 0.3, 1)`), exibição temporizada/cíclica (7s na abertura, 6s a cada 45s, 8s pós-upload) e 38x38px quando recolhido.
  - **Purificação de Ícones e Badges do HeroPanel**: Remoção total de molduras e backgrounds (`background: transparent !important`, `border: none !important`), badges informativos de origem com 38px (sem zoom e sem links), iluminação neon equalizada e 100% SVG (zero emojis).
  - **Gerenciador de Pastas de Instalação Cyber Neon**: Layout em 2 linhas no seletor "Instalar em:" (`.installPathSelectorBox`), modal Cyber Neon (`ghostPathsModalOverlay`) em `#131a20` com contorno `#00ffff`, destaque da pasta atual em verde-esmeralda `#10b981` e exclusão atômica no `localStorage` com fallback reativo instantâneo.
  - **Modernização do Backup Ghost (`.GhostBackup`)**: Payload expandido com metadados e saves da loja Piratas, rotação e deleção de backups antigos no Google Drive, formato `${dd}-${mm}-${yyyy}.GhostBackup` associado ao ícone oficial do Ghost (`win_icon.ico`) no Windows.
  - **Configurações e Updates da Loja Piratas**: Logo de origem no `HeroPanel` com tooltip da loja, rotina de checagem diária a cada 24h com toggle em Configurações > Geral, modal Cyber Neon de exclusão física do jogo (`#ff5252`) e auto-backup GhostShield ativado por padrão.
  - **Logo AnkerGames Ultra HD e Resolução de Capas em 3 Níveis**: Transparência suave anti-aliased em 1024x1024 (`ankergames-logo.png`), resolução de capas com 3 níveis (Biblioteca/GameOverrides ➔ SteamGridDB via IPC ➔ Site de origem) e logo exclusivo ampliado sem texto nos cards de downloads.
  - **Unificação de Downloads Externos no `/download-manager`**: Integrados os cards `ExternalActiveCard` (hero card de 180px com telemetria e ondas no topo), `ExternalFinishedCard` (compacto 82px com `[ ▶ Jogar ]`) e `ExternalQueueCard` (compacto 82px na fila unificada).
  - **Eliminação Definitiva de Diálogos Nativos Win32**: Modal Cyber Neon de Troca de Fonte / Atualização de Jogos substituindo caixas brancas `dialog.showMessageBox`.

### 39. Hub de Configurações Cyber Neon, Auto-Resolução de Acrônimos, Suporte Multi-Card Ativo em Downloads e Feedback Visual de Deleção
* **Problema:** Falta de hub central de configurações na busca de jogos, necessidade de digitar pontos em acrônimos (S.T.A.L.K.E.R.), limitação a 1 card ativo no gerenciador de downloads e falta de feedback visual em tempo real nos cards da biblioteca durante deleção/remoção sem travar o aplicativo.
* **Solução:**
  - **Hub de Configurações Cyber Neon de Buscar Jogos**: Engrenagem `.externalSettingsPillBtn` com modal Glassmorphism em 4 abas (`ghostSettingsModalExpandedCard`) para gestão de pastas, loja personalizada padrão de downloads, credenciais TorBox/AnkerGames e grade de jogos instalados com botão de lixeira rápida (`.ghostInstDeleteBtn`).
  - **Busca Inteligente com Auto-Resolução de Acrônimos**: Fim do debounce automático na digitação. Motor de acrônimos pontuados (`KNOWN_GAME_ACRONYMS` e `generateSearchQueryVariants`) permitindo que buscar `stalker 2` encontre `S.T.A.L.K.E.R. 2: Heart of Chornobyl`. Dropdown suspenso de sugestões em tempo real (`.searchSuggestionsDropdown`) sem trocar a página.
  - **Suporte a Múltiplos Cards Ativos no Gerenciador de Downloads (Conquista 96/Regra 64)**: Suporte a N downloads ativos em paralelo na área `BAIXANDO AGORA` com telemetria agregada e reorganização de layout automática (quando `> 2` processos ativos, a seção `BAIXANDO AGORA` assume a largura total no topo com grid de 2 colunas e a seção `NA FILA` desce para a linha inferior ao lado de `CONCLUÍDOS`).
  - **Indicador Local de Remoção/Deleção no GameCard (Conquista 94/Regras 61 e 62)**: Store reativo não-bloqueante (`removingGamesStore.ts`) acionado em 0ms. Overlay interno ao card (`.gameCardRemovalOverlay`) com blur, bordas pulsantes neon e spinner sem alterar o tamanho, largura, altura ou proporção `aspect-ratio: 173/275` do card (Regra 62), permitindo navegar pela biblioteca enquanto a remoção roda em background (Regra 61).
  - **Qualidade & Testes**: `pnpm run codecheck` com 0 erros no TypeScript (`tsc --noEmit`) e 160/160 testes unitários Jest aprovados.

### 40. Otimização Vertical de Downloads (180px Fixos), Botão de Abrir Diretório no PathSelectionBox, Redirecionamento Contextual de Lojas e Logotipo HD Online-Fix
* **Problema:** Mensagens informativas quebrando a layout do card ativo de 180px no Gerenciador de Downloads, falta de botão rápido para abrir o diretório do jogo no Explorador de Arquivos a partir de campos de caminho, redirecionamento genérico no botão "Loja" para jogos comunitários/piratas, e dependência remota frágil para favicon do Online-Fix.
* **Solução:**
  - **Otimização de Layout Vertical no Card Ativo (Conquista 108/Regra 76)**: Mantida a altura fixa em 180px (`height: 180px; max-height: 180px; overflow: hidden`) e capa 125px. Banner de mensagens `.dmExternalNoticeBanner` compacto de 11px/line-height 1.32, linha de status com justificativa `space-between` (status à esquerda e porcentagem ciano neon à direita), e folga vertical garantida de mais de 40px.
  - **Abertura do Diretório da Pasta do Jogo em Endereços de Executável (Conquista 106/Regra 74)**: Criado utilitário universal `pathUtils.ts` (`openGameFolder`). Botão de pasta transparente com `<FontAwesomeIcon icon={faFolder} />` em ciano neon no `PathSelectionBox` acionando `window.api.openFolder()` para abrir diretamente no Windows Explorer.
  - **Redirecionamento Contextual do Botão "Loja" para Buscar Jogos (Conquistas 105 e 107/Regra 75)**: Botão "Loja" no `HeroPanel` e badges clicáveis no card de downloads redirecionam jogos não-oficiais/comunitários ("Piratas", repacks, AnkerGames, SteamRIP, Online-Fix) diretamente para a página rica do jogo em Buscar Jogos (`/external-games?q=...&installation=...`).
  - **Logotipo Oficial HD Bundled do Online-Fix (Conquistas 100 e 101/Regras 68 e 69)**: Asset local HD 180x180 transparente (`onlinefix-logo.png`) empacotado, eliminando requisições remotas sujeitas a bloqueios de CORS/Cloudflare, com renderização instantânea em 0ms e cache síncrono de módulo (`cachedExternalGamesState`).
  - **Remoção de Botões Redundantes de Lixeira (Conquista 103/Regra 71)**: Exclusão das lixeiras do cabeçalho de `InlineGameSettings` e alinhamento elegante das tags à esquerda de `{currentTitle} (Configurações)`.
  - **Exclusividade da Biblioteca (Conquista 104/Regra 72)**: Expurgo completo do bloco de fontes da comunidade da tela da Biblioteca, mantendo-as exclusivas na tela Buscar Jogos.

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

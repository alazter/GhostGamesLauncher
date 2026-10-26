# Review das Alterações - 26/10/2026

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

### 45. Janela Ampliada de Adicionar Jogo (1240px × 800px / 85vh), Reconciliação Reativa de Updates na Biblioteca, Resolução de Torrents Online-Fix e Desbloqueio MegaDB
* **Problema:** O formulário da janela de adicionar jogo manualmente ficava apertado exigindo rolagem constante; jogos permaneciam indevidamente na lista e no filtro de atualizações após serem atualizados; torrents do Online-Fix falhavam ou ficavam em timeout devido à porta não convencional (2053); e downloads diretos de espelhos MegaDB no SteamRIP eram bloqueados no servidor final (`fs4.megadb.xyz`).
* **Solução:**
  - **Dimensões Confortáveis e Arejadas do SideloadDialog (Conquista 170/Regra 136)**: Largura expandida de 1.120px para 1.240px (+120px de área útil) e altura de 80vh (máx 720px) para 85vh (máx 800px, mín 540px), eliminando a necessidade de rolagem para visualizar executável, argumentos e loja, mantendo o HeroPanel esquerdo fixo em 280px com capa vertical em 420px.
  - **Reconciliação Reativa do Filtro de Atualizações da Biblioteca (`GlobalState.gameUpdates`)**: Sincronização atômica ao evento `external-games-updated` e reconciliação com o backend, impedindo que títulos já atualizados sejam reinseridos no filtro e eliminando o erro crônico de jogos desatualizados fantasmas.
  - **Automação e Resolução de Torrents Online-Fix com Scrapling Worker v3 e Porta HTTPS 2053**: Liberação da porta 2053 estritamente para `uploads.online-fix.me`, captura automática do arquivo `.torrent` via Scrapling e exibição de telemetria transparente no card de downloads durante a espera pela nuvem TorBox (*"Aguardando o TorBox concluir o download para iniciar a transferência para o PC"*).
  - **Desbloqueio de Servidores Finais MegaDB no SteamRIP (`fs4.megadb.xyz`)**: Inclusão de `fs4.megadb.xyz` no manifesto de download assistido do SteamRIP em `ankerAccount.ts`, permitindo que os downloads via MegaDB completem a navegação e entreguem o arquivo ao gerenciador sem bloqueios de segurança.
  - **Qualidade & Testes**: `pnpm run codecheck` com 0 erros TypeScript (`tsc --noEmit`), novos testes Jest aprovados em `gameUpdateState`, `externalDownloadStatus` e `onlineFixTorrent`, e conformidade estrita com a Regra Canônica 62.

### 46. Vitrine Dinâmica via Scrapling/Obscura, Purga SteamRIP (20 Jogos de Recently Added), Brilho Neon Sem Amarelo e Alinhamento Pixel-Perfect no Cabeçalho
* **Problema:** A vitrine inicial de "Buscar Jogos" apresentava conteúdos estáticos suscetíveis a quebras caso os sites parceiros mudassem de layout; a prateleira do SteamRIP exibia cards institucionais indesejados ("Top Games", "Recent Updates", "All Games Games Collection", "How to Run Games") no lugar de lançamentos autênticos; o botão de busca de atualizações da loja Piratas ficava apagado durante o carregamento com cor amarela rejeitada pelo usuário; e os botões de ação ("Jogos Sem Classificação" e "Edição em Massa") estavam desalinhados verticalmente em relação aos dropdowns ("Categorias" e "Filtros") no cabeçalho da Biblioteca.
* **Solução:**
  - **Vitrine Dinâmica e Resiliente de Buscar Jogos (Conquista 171/Regra 137)**: Integração de Scrapling adaptativo (`adaptiveGames` via `scrapling_worker.py`) e Obscura (`experimentalPage`) contornando Cloudflare com cache em três camadas (RAM + Disco `ghost_home_content_cache.json` + `localStorage`) garantindo 0ms de latência ao abrir e botão `🔄 Atualizar Destaques` com telemetria visual.
  - **Expurgamento Multicamada de Não-Jogos e 20 Jogos de Recently Added no SteamRIP (Conquista 172/Regra 138)**: Sanitização canônica universal (`isNonGameCard`) eliminando tutoriais e caixas institucionais de ponta a ponta (parser HTML, Scrapling, cache do backend e camada de renderização). Entrega garantida dos 20 primeiros jogos reais cronológicos da seção "Recently Added" com paginação automática e Spotlight Hero refletindo o jogo autêntico #1.
  - **Brilho Neon Íntegro no Ícone de Atualizações da Loja Piratas (Conquista 173/Regra 139/Erro 136/Seção 78)**: Blindagem com `opacity: 1 !important` e `cursor: wait !important` durante a checagem, expurgo absoluto de cores amarelas hardcoded, e paridade 100% com a paleta configurada pelo usuário (`var(--action-color-1)`, `var(--action-glow-color-1)` ou degradê nativo SVG) preservando a rotação de inércia elástica da caveira.
  - **Alinhamento Vertical e Geometria Pixel-Perfect no Cabeçalho da Biblioteca (Conquista 174/Regra 140/Erro 137/Seção 79)**: Padronização unificada de altura em `32px !important` para `.Header__actionBtn` e `.Header__dropdownBtn` no modo padrão e neon, eliminando o strut de descendente de linha com `display: inline-flex !important; align-items: center !important; margin: 0 !important; line-height: 1 !important;` e sincronização 1:1 em `themes.scss`.
  - **Qualidade & Testes**: `pnpm run codecheck` com 0 erros TypeScript (`tsc --noEmit`), testes unitários Jest 100% aprovados e preservação soberana da Regra Canônica 62 (`aspect-ratio: 173/275`).

### 47. Seletor de Coleta de Lançamentos (Electron/Scrapling/Obscura), Download Headless Online-Fix, Lupa de Busca na Loja e Alta Performance de Encerramento
* **Problema:** Usuários precisavam de flexibilidade para escolher o motor de coleta de dados no calendário de lançamentos para contornar bloqueios de rede sem perder histórico; o download de torrents do Online-Fix abria uma janela transitória rápida indesejada na tela; os cards e detalhes de lançamentos de jogos não possuíam acesso direto com 1 clique para buscar o título na loja "Buscar Jogos"; e o encerramento do launcher podia ficar represado aguardando timeouts de presença no GOG ou cancelamento de uploads em nuvem.
* **Solução:**
  - **Download Silencioso Headless via TorBox/Torrent no Online-Fix (Conquista 175/Regra 141/Erro 138)**: Eliminação da exibição prematura da janela Electron no `OnlineFixAccount.torrent`, captura 100% invisível em segundo plano com revelação controlada apenas em caso de desafio interativo ou grace timeout de 8s; persistência dupla e independente de plataformas por categoria (`platformsByCategory: Record<string, string[]>`) sincronizada de forma síncrona com `configStore` e `localStorage` (preservando PC e PC Early Access entre navegações e reinicializações).
  - **Botão de Busca Direta na Loja nos Cards e Detalhes de Lançamentos (Conquista 176/Regra 142/Seção 80)**: Inclusão do botão `.nr-card-search` com ícone `faSearch` nos cards de lançamentos (`product.category === 'games'`) com `stopPropagation` e navegação instantânea para `/external-games?q=...`; inclusão do botão `.nr-product-search` ("Buscar na loja") no cabeçalho do `<ReleaseDetails>` envolvido no contêiner `.nr-product-actions` com hover em ciano neon `#38d9e6`.
  - **Seletor de Motores de Coleta de Lançamentos (`ReleaseCollectorPicker` e `collector.css`)**: Implementação de dropdown Cyber Neon no cabeçalho de Lançamentos permitindo escolher entre *Electron (Padrão)*, *Preferir Scrapling* e *Preferir Obscura*; persistência conjunta no `localStorage` e `configStore`; integração do script `release_page.py` com Scrapling 0.4.15 integração 5 (`release-page-v1`); retenção anual resiliente e fallback transparente para Electron com aviso em português em caso de indisponibilidade.
  - **Otimização de Shutdown e Encerramento Imediato (`applicationExit.ts`)**: Criação de barramento de saída seguro com cancelamento atômico de operações pendentes (`abortAllOperations`), cancelamento gracioso de backups em nuvem sem travar e desconexão instantânea de presença GOG (`gogPresenceExit.ts`), garantindo fechamento rápido e sem processos órfãos.
  - **Atualização do Alazterflix v1.3.3**: Suporte ampliado a títulos baseados em diretórios/pastas, empacotamento do arquivo de extensão `alazterflix-v1.3.3.ghost`, sanitização de headers no renderer e melhorias no player de streaming.
  - **Qualidade & Testes**: `pnpm run codecheck` com 0 erros TypeScript (`tsc --noEmit`), 131 testes unitários em 20 suítes de Releases e Backend aprovados (100%), e conformidade estrita com a Regra Canônica 62 (`aspect-ratio: 173/275`).

### 48. Seletor Integrado da Loja Personalizada "Softwares" nas Caixas de Texto/Endereço de "Scripts e Softwares" (`SoftwareStorePathBox`) e Releases v0.3.4-beta / v0.3.5-beta
* **Problema:** Nas configurações dos jogos, as caixas de texto/endereço de "Scripts e Softwares" permitiam apenas digitação manual de caminhos ou seleção via diálogo nativo de arquivos locais (`📁`). Usuários que possuem softwares cadastrados na loja personalizada "Softwares" do Ghost precisavam navegar manualmente pelos diretórios do Windows para vincular executáveis aos jogos.
* **Solução:**
  - **Descoberta Automática e Conexão Reativa com a Loja "Softwares" (Conquista 177/Regra 143/Seção 81)**: Implementação do motor `softwareStoreItems.ts` (`resolveGameExecutablePath`, `findPrimarySoftwareStore`, `getSoftwareStoreItems`, `findMatchingSoftwareByPath`) e hook `useSoftwareStoreCatalog` monitorando em tempo real as lojas personalizadas e atribuições, exibindo indicador dinâmico no cabeçalho: `🧰 Conectado à sua loja personalizada "Softwares" (N apps disponíveis)`.
  - **Caixa de Endereço Cyber-Neon com Popover e Botão `"🧰 Loja Softwares ▾"`**: Novo componente `SoftwareStorePathBox` integrado em `BeforeLaunchScriptPath` e `AfterLaunchScriptPath`, embutindo o botão da loja diretamente ao lado do seletor local `📁` e de limpeza `⌫`. Popover com filtro de busca rápida, miniatura da capa do aplicativo, caminho `.exe` em fonte monoespaçada e botão de seleção em 1 clique.
  - **Badge Identificador de Vínculo**: Exibição em tempo real do badge de status (`Vinculado da Loja Softwares: [Nome]` com ícone ou `📁 Selecionado via Pasta Local: [arquivo]`).
  - **Lançamento das Versões `v0.3.4-beta` e `v0.3.5-beta`**: Incremento de versões no `package.json`, atualização de regras do scanner de sideload e estabilização de build.
  - **Qualidade & Testes**: `pnpm run codecheck` com 0 erros TypeScript (`tsc --noEmit`), 99/99 testes unitários Jest aprovados (100% em 5 suítes de Custom Stores & Connected Accounts) e conformidade estrita com a Regra Canônica 62 (`aspect-ratio: 173/275`).

### 49. Auto-Cura de Executáveis Portáteis, Desacoplamento de Cards Sideload, Miniaturas com `imagecache://`, Auto-Encerramento e Leitor do r/CrackWatch
* **Problema:** Softwares auxiliares falhavam ao abrir (`ENOENT`) caso o executável tivesse sido atualizado com sufixo de versão portátil (ex: `dlss5oneclick.exe` vs `DLSS5-Swapper-2.2.5-portable.exe`); cadastrar múltiplos aplicativos no mesmo diretório compartilhado causava sobrescrita de cards e descarte do título informado pelo usuário; o seletor da loja de softwares exibia miniaturas vazias devido ao bloqueio de caminhos locais do Windows no Chromium; faltava opção de encerrar o aplicativo auxiliar automaticamente ao fechar o jogo; e o leitor anterior de DRM do r/CrackWatch sofria com bloqueios HTTP 403 e 429.
* **Solução:**
  - **Auto-Cura Resiliente de Executáveis Portáteis (Conquista 178/Regra 144/Erro 140)**: Motor `findAlternativeExecutableCandidate` em `launcher.ts` que decompõe o executável por termos alfanuméricos, ranqueia candidatos na mesma pasta e seleciona o mais recente por `mtime` em caso de arquivo ausente, com fallback de `folder_name` e hardlink transparente.
  - **Desacoplamento e Fim da Sobrescrita de Cards Sideload na Mesma Pasta (Conquista 179/Regra 145/Erro 141)**: Eliminação do matching cego por pasta `folder_name` em `SideloadLibraryManager.addNewApp`, garantindo a convivência pacífica de múltiplos softwares no mesmo diretório com soberania absoluta do título digitado pelo usuário e sincronização em `overrides`.
  - **Restauração de Capas e Miniaturas de Softwares via `imagecache://` (Conquista 180/Regra 146/Erro 142/Seção 82)**: Conversão transparente de caminhos locais do Windows para `imagecache://localhost/${encodeURIComponent(...)}`, motor `resolveGameIconUrls` com prioridade para `overrides.art_square`, descarte de placeholders vazios e renderização reativa com `SoftwareThumbnail` e `CachedImage` (`32x32px` na lista e `18x18px` no badge), com fallback suave para o glifo `🧰`.
  - **Encerramento Automático do Software ao Fechar o Jogo (`closeBeforeLaunchScriptOnExit`)**: Novo `ToggleSwitch` em `BeforeLaunchScriptPath.tsx` e função `stopBeforeLaunchScript` em `launcher.ts` (acionada ao sair do jogo e em `SideloadGame.stop()`), finalizando o processo auxiliar por PID e nome de imagem via `taskkill /F /T` (com fallback elevado UAC), aliado a `waitForChildGameProcessInFolder` para monitorar processos filhos de bootstrappers.
  - **Leitor Público e Resiliente do r/CrackWatch para Status de DRM (`drmReddit.ts`, `drmRedditParser.ts`)**: Consulta em sessão Electron isolada e sem login, busca otimizada com aliases numéricos, prevenção contra tradução automática de nomes de grupos, tratamento independente de HTTP 403 e 429 com `Retry-After`, cache de 15 minutos e validação com 60 testes em 11 suítes.
  - **Qualidade & Testes**: `pnpm run codecheck` com 0 erros TypeScript (`tsc --noEmit`), 100% dos testes unitários Jest aprovados e preservação rigorosa da Regra Canônica 62 (`aspect-ratio: 173/275`).

### 50. Prioridade de LAST UPDATE em Atualizações Externas, Tag de Data Editável no Card, Status Manual de DRM e Resolução Boltgun 2
* **Problema:** A comparação de atualizações de jogos da loja Piratas priorizava número de versão, falhando quando fontes atualizavam jogos sem alterar a numeração textual; versões 1.0 eram preenchidas artificialmente gerando dados falsos; datas de releases incorretas não podiam ser ajustadas pelo usuário; e inconsistências entre provedores de status de DRM (Denuvo/quebras) não permitiam correção manual pelo usuário nem resolução de desafios interativos na fonte.
* **Solução:**
  - **Motor Canônico de Atualizações com Prioridade LAST UPDATE + Versão (Regra 17/10/2026)**: Gravação atômica do par `LAST UPDATE` da release na fonte + versão em cada instalação/update. A data mais recente no provedor decide o update mesmo com texto de versão idêntico; datas iguais ou ausentes recorrem à comparação de versão; fim do preenchimento fictício de "v1.0" em instalações externas; cards da loja Piratas exibem versão e `LAST UPDATE` formatada em `dd/mm/aa` (ou "Data não registrada").
  - **Tag LAST UPDATE Editável nas Configurações do Card (`InstalledReleaseLabel.tsx`)**: Possibilidade de editar diretamente a data da release instalada no card para corrigir dados divergentes ou orientar futuras checagens com o provedor, persistindo em `state.json` (`sourceDate` e `uploadDate`) e no manifesto físico `.ghost-manifest.json`.
  - **Editor e Override de Status Manual de DRM (`ReleaseDrmEditor.tsx`, `drmOverrides.ts`)**: Implementação de modal Cyber Neon permitindo ao usuário definir e sobrepor manualmente o status de DRM (ex: *Quebra Relatada*, *Sem DRM*, *Não Quebrado*, *Não Confirmado*), com badge explicativo "Definido pelo usuário" e preservação do resultado automático em segundo plano.
  - **Acesso Interativo por Clique na Fonte de DRM (HizSearch e SkidrowReloaded)**: Abertura de sessão Electron persistente em janela centralizada para resolução pontual de desafios/Cloudflare com validação no conteúdo real do jogo.
  - **Evidência DRM em Anúncios de Release e Resolução Boltgun 2 (`DRM_BOLTGUN_2.md`)**: Validação de posts completos de grupos oficiais da cena com URL canônica, categoria de PC e metadados, respeitando limites e Retry-After de provedores.
  - **Qualidade & Testes**: `pnpm run codecheck` com 0 erros TypeScript (`tsc --noEmit`), novos testes unitários Jest em `drmOverrides`, `drmContinuity`, `installedReleaseLabel` e `drmBatch`, e preservação absoluta da Regra Canônica 62 (`aspect-ratio: 173/275`).

### 51. Seletor de Lojas na Janela de Download, Compartilhamento de Plugins (.ghost) e Atualização Direta do Motor Obscura v0.2.5
* **Problema:** A janela de download ("Escolha como baixar") exibia apenas a fonte inicial do card sem permitir selecionar outra loja disponível para o mesmo jogo; faltava um mecanismo portátil para exportar e compartilhar plugins e motores de scraping entre usuários (.ghost); e o catálogo estável do Ghost respondeu HTTP 404, impossibilitando a atualização do motor Obscura v0.2.5 para Windows x64.
* **Solução:**
  - **Seletor de Lojas no Diálogo de Download (`SourcePicker.tsx`, Conquista 183)**: Menu suspenso compacto ancorado ao botão da loja com posicionamento automático (acima/abaixo), seleção rápida por teclado (Setas, Enter, Home/End) e logos oficiais de cada loja; sincronização instantânea de versão, `sourceDate`/`uploadDate` e tamanho (`size`) da fonte selecionada; isolamento de capas para impedir vazamento de arte de lojas anteriores; e novos layouts personalizáveis **Ghost compacto** e **Ghost com capa** (600:900 desfocado) compartilhados entre o diálogo e a tela de Personalização.
  - **Compartilhamento de Plugins e Motores em Pacotes `.ghost` (`pluginPacker.ts`, `sourceEnginePackage.ts`, `PLUGIN_SHARING.md`, Conquista 184)**: Exportação autossuficiente de plugins e motores em formato `.ghost` com metadados `GHOST-ENGINE/1`; importador com conferência de integridade SHA-256, versão mínima do Ghost e proteção rígida contra symlinks/directory traversal; preservação de dados sensíveis e isolamento de `plugins_data`.
  - **Atualização Oficial do Motor Obscura v0.2.5 (`obscuraRelease.ts`, `SOURCE_ENGINE_UPDATES.md`)**: Consulta resiliente e direta à API do GitHub de releases oficiais do projeto Obscura para Windows x64 (SHA-256 `9e56fa1c...`), teste funcional do executável no runtime do Ghost e cache persistido em `source-engines/obscura-release.json`.
  - **Correções & Performance (Conquistas 181 e 182)**: Leitura de cauda de logs (`readLogFileTail` em 0.5ms) e higienização imediata do `ghost.log`, eliminando travamentos na página de Configurações; auto-desativação síncrona (0ms) do filtro `showUpdatesOnly` na Biblioteca ao concluir todas as atualizações.
  - **Qualidade & Testes**: `pnpm run codecheck` com 0 erros TypeScript (`tsc --noEmit`), 55+ testes unitários Jest aprovados e preservação rigorosa da Regra Canônica 62 (`aspect-ratio: 173/275`).

### 52. Modal "Mover Jogo de HD" Inspirado na Steam, Painel de Detalhes de Buscar Jogos, Prioridade de Capas (Anker ➔ Google ➔ SGDB) e Portabilidade de Extração
* **Problema:** Usuários precisavam transferir pastas de instalação entre discos/HDs/NVMes diretamente pelas configurações dos cards sem intervenção manual em pastas do sistema; a tela de detalhes de Buscar Jogos precisava de layout alinhado ao mockup com cards lado a lado de fontes em vez de menus suspensos; capas de jogos externos demandavam hierarquia de qualidade unificada; e descompactação de pacotes RAR/7Z em diferentes máquinas falhava por falta de dependências universais ou travas de extração prévia.
* **Solução:**
  - **Ação e Modal "Mover Jogo de HD" com Engrenagem (`MoveGameModal.tsx`, Conquista 185)**: Nova ação `move-install` em Ações do Jogo e Organizar Seções; engrenagem `⚙️ Configurar HDs` que permite ao usuário pré-definir suas próprias unidades e diretórios (`ghost_move_game_drive_paths`); visualização com barras de ocupação do disco, espaço livre (`GB / TB LIVRE(S)`), badge `UNIDADE ATUAL`, realce azul Steam (`#2a80eb`) e progresso em tempo real; backend universal de movimentação para `sideload`/`ExternalGames`, `steam`, `legendary` (Epic), `gog` e `nile` (Amazon) via `robocopy /MOVE /E /R:2 /W:1` sem duplicação de diretório e preservando executável, manifesto e saves do GhostShield.
  - **Card de Detalhes de Buscar Jogos & Cards de Lojas Lado a Lado (`GameDetailsPanel.tsx`, `StoreSourceCards.tsx`, `InstallDestination.tsx`, Conquista 186)**: Pôster 230×345px em desktop com fundo de vidro fosco desfocado, alinhamento à esquerda, tipografia Cabin local, tags de compatibilidade (Steam Deck, controle) e metadados; seção "Fontes disponíveis para download" com cards lado a lado contendo logo/nome, versão, tamanho e grupo da release com borda ciano e check mark; descoberta reativa de todas as lojas habilitadas via `useGameStoreSources.ts`; seletor de pasta de instalação com espaço livre em disco em tempo real via `checkDiskSpace` e validação mínima sem bloquear atualizações ou migrações.
  - **Resolvedor Canônico de Capas em Buscar Jogos (`externalCoverResolver.ts`, `PreferredGameCover.tsx`)**: Hierarquia estrita: AnkerGames (imediata) ➔ Google Imagens vertical (janela Electron oculta, serializada e sem Node) ➔ SteamGridDB 600×900 estático com chave do Ghost; compartilhamento idêntico de arte e fundo desfocado entre vitrine, detalhes e diálogo de download; intocabilidade total das capas da Biblioteca (Regra Canônica 62: `aspect-ratio: 173/275`).
  - **Portabilidade de Extração (7-Zip / UnRAR) & Retomada Resiliente TorBox (`archiveTools.ts`, `archiveReader.ts`, `rangedCheckpoint.ts`, `directDownloadDefaults.ts`)**: Suporte a 7-Zip e console do WinRAR/UnRAR sem abrir janelas; limpeza segura de resíduos parciais que geravam o erro "Uma extração anterior já existe"; distribuição de receitas de download direto genéricas da Anker com desativação preventiva após falhas; retomada de downloads TorBox via Range/If-Range e ETag (`package.ext.resume.json`).
  - **Qualidade & Testes**: `pnpm run codecheck` com 0 erros TypeScript (`tsc --noEmit`), 83+ testes unitários Jest aprovados e preservação rigorosa da Regra Canônica 62 (`aspect-ratio: 173/275`).

### 53. Suporte a Links IMDb, Edição Completa de Mídias/Episódios no Alazterflix, Scrapling v0.5 e Resolução Legendary Auth
* **Problema:** Ao colar pôsteres verticais do IMDb ou links diretos de capa no Alazterflix, a validação de proporção horizontal de backdrop lançava erro fatal impedindo o salvamento da obra; páginas de mídia do IMDb sofriam bloqueio por WAF; episódios e temporadas de séries não possuíam campos dedicados no modal nem sincronização no player; a nota TMDB não era editável manualmente; o toast de feedback ficava travado na tela sem auto-dismiss; o motor Scrapling falhava ao atualizar para v0.5 por incompatibilidade com versão de 2 segmentos; e o login do Legendary lançava erro "No saved credentials".
* **Solução:**
  - **Blindagem de Backdrop e Entradas Dedicadas no Alazterflix (`plugins/alazterflix/index.js`, `Alazterflix/index.tsx`, Conquista 193)**: Gravação de backdrop encapsulada em bloco try/catch com supressão preventiva em links verticais e preservação integral de dados salvos (capa física, notas, títulos, episódios); campos dedicados no modal para URL da Capa e Imagem de Fundo (Backdrop 16:9) com botão rápido "Escolher Fundo PC".
  - **Resolvedor Headless de Capas do IMDb (`imdbImageResolver.ts`, Conquista 188)**: Resolução de páginas `/mediaviewer/rm...` em janela Electron headless isolada contornando o WAF, extração da imagem original de alta qualidade e gravação física nas pastas de mídia com canal IPC `cinemaResolveImdbImage`.
  - **Edição Explícita de Episódios e Temporadas (`Alazterflix/index.tsx`, Conquista 190)**: Campos dedicados para Temporada [S], Episódio [E] e Título do Episódio, com botão de conversão rápida para série e sincronização em tempo real no menu lateral direito do player de vídeo com botões de edição rápida.
  - **Edição Manual da Nota TMDB (0 a 10) (Conquista 191)**: Desbloqueio do campo de nota TMDB aceitando ponto ou vírgula decimal com propagação automática para todos os episódios da mesma obra.
  - **Botão "Abrir Local do Arquivo" & Auto-Dismiss de Toast (`toastUtils.ts`, Conquistas 187 e 189)**: Botão interativo Cyber Neon no banner de arquivo original abrindo e destacando o arquivo no Windows Explorer; utilitário de duração inteligente com auto-dismiss (4s comum / 20s assíncrono) e botão manual de fechamento.
  - **Motor Scrapling v0.5 & Cards de Motores Sempre Visíveis (`SourceEnginesPanel.tsx`, `sourceEngines.ts`, Conquista 192)**: Normalização SemVer de 2 segmentos (`0.5` -> `0.5.0`), empacotamento do executável nativo `ghost-scrapling.exe` v0.5 e seção de motores sempre visível estilizada no padrão dos cards de plugins.
  - **Autocura e Blindagem do Legendary Auth (`library.ts`, `user.ts`, `utils.ts`, Conquista 186)**: Restauração de `LEGENDARY_CONFIG_PATH`, autocura de `user.json` e bloqueio de corrida na transição de autenticação.
  - **Qualidade & Testes**: `pnpm run codecheck` com 0 erros TypeScript (`tsc --noEmit`), 85/85 testes unitários Jest aprovados e preservação rigorosa da Regra Canônica 62 (`aspect-ratio: 173/275`).

---

## 🛠️ Arquivos Modificados e Criados

### Configuração, Documentação e Scripts
- [MODIFY] [package.json](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/package.json)
- [MODIFY] [electron-builder.yml](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/electron-builder.yml)
- [MODIFY] [electron.vite.config.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/electron.vite.config.ts)
- [MODIFY] [review.md](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/review.md)
- [MODIFY] [.agents/AGENTS.md](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/.agents/AGENTS.md)
- [MODIFY] [.github/workflows/source-engines.yml](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/.github/workflows/source-engines.yml)
- [MODIFY] [docs/ONLINE_FIX_TORRENT_DOWNLOAD.md](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/docs/ONLINE_FIX_TORRENT_DOWNLOAD.md)
- [NEW] [docs/ALAZTERFLIX_FOLDER_TITLES.md](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/docs/ALAZTERFLIX_FOLDER_TITLES.md)
- [NEW] [docs/ALAZTERFLIX_PLAYER_STREAMING.md](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/docs/ALAZTERFLIX_PLAYER_STREAMING.md)
- [NEW] [docs/CRACKWATCH_DRM_SOURCE.md](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/docs/CRACKWATCH_DRM_SOURCE.md)
- [NEW] [docs/DRM_BOLTGUN_2.md](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/docs/DRM_BOLTGUN_2.md)
- [MODIFY] [docs/DRM_MANUAL.md](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/docs/DRM_MANUAL.md)
- [NEW] [docs/DRM_MANUAL_STATUS.md](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/docs/DRM_MANUAL_STATUS.md)
- [NEW] [docs/audits/external-releases-2026-10-17.md](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/docs/audits/external-releases-2026-10-17.md)
- [NEW] [docs/audits/external-releases-2026-10-17.json](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/docs/audits/external-releases-2026-10-17.json)
- [NEW] [docs/audits/external-releases-2026-10-17-retry.json](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/docs/audits/external-releases-2026-10-17-retry.json)
- [NEW] [scripts/audit-external-releases.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/scripts/audit-external-releases.ts)
- [NEW] [docs/DIRECT_DOWNLOAD_ENGINES.md](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/docs/DIRECT_DOWNLOAD_ENGINES.md)
- [NEW] [docs/DIRECT_DOWNLOAD_LEARNING.md](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/docs/DIRECT_DOWNLOAD_LEARNING.md)
- [NEW] [docs/ONLINE_FIX_DIRECT_DOWNLOAD.md](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/docs/ONLINE_FIX_DIRECT_DOWNLOAD.md)
- [NEW] [docs/RELEASES_ANNUAL_CALENDAR.md](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/docs/RELEASES_ANNUAL_CALENDAR.md)
- [NEW] [docs/RELEASES_COLLECTION_ENGINES.md](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/docs/RELEASES_COLLECTION_ENGINES.md)
- [NEW] [docs/RELEASES_PAGINATION_RECOVERY.md](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/docs/RELEASES_PAGINATION_RECOVERY.md)
- [NEW] [docs/SHARED_DIRECT_DOWNLOAD_AUTOMATION.md](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/docs/SHARED_DIRECT_DOWNLOAD_AUTOMATION.md)
- [NEW] [docs/STARTUP_SHUTDOWN_PERFORMANCE.md](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/docs/STARTUP_SHUTDOWN_PERFORMANCE.md)
- [NEW] [docs/YOUTUBE_EMBED_PLAYER.md](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/docs/YOUTUBE_EMBED_PLAYER.md)
- [NEW] [plugins/alazterflix-v1.3.3.ghost](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/plugins/alazterflix-v1.3.3.ghost)
- [MODIFY] [plugins/alazterflix/README.md](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/plugins/alazterflix/README.md)
- [MODIFY] [plugins/alazterflix/index.js](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/plugins/alazterflix/index.js)
- [MODIFY] [plugins/alazterflix/plugin.json](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/plugins/alazterflix/plugin.json)
- [MODIFY] [scripts/engines/prepare_engines.py](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/scripts/engines/prepare_engines.py)
- [MODIFY] [scripts/engines/runtime_smoke.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/scripts/engines/runtime_smoke.ts)
- [MODIFY] [scripts/engines/scrapling_worker.py](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/scripts/engines/scrapling_worker.py)
- [NEW] [scripts/engines/direct_download_page.py](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/scripts/engines/direct_download_page.py)
- [NEW] [scripts/engines/release_page.py](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/scripts/engines/release_page.py)
- [NEW] [scripts/engines/sharing_smoke.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/scripts/engines/sharing_smoke.ts)
- [NEW] [docs/DOWNLOAD_DIALOG_APPEARANCE.md](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/docs/DOWNLOAD_DIALOG_APPEARANCE.md)
- [NEW] [docs/PLUGIN_SHARING.md](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/docs/PLUGIN_SHARING.md)
- [MODIFY] [docs/SOURCE_ENGINES.md](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/docs/SOURCE_ENGINES.md)
- [MODIFY] [docs/SOURCE_ENGINE_UPDATES.md](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/docs/SOURCE_ENGINE_UPDATES.md)
- [NEW] [docs/DOWNLOAD_INSTALL_PORTABILITY.md](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/docs/DOWNLOAD_INSTALL_PORTABILITY.md)
- [NEW] [docs/EXTERNAL_COVER_PRIORITY.md](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/docs/EXTERNAL_COVER_PRIORITY.md)
- [NEW] [docs/EXTERNAL_GAME_DETAILS_DESIGN.md](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/docs/EXTERNAL_GAME_DETAILS_DESIGN.md)
### Backend & Core
- [MODIFY] [src/backend/__mocks__/electron.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/__mocks__/electron.ts)
- [NEW] [src/backend/__tests__/abortAllOperations.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/__tests__/abortAllOperations.test.ts)
- [NEW] [src/backend/__tests__/appRouteLoading.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/__tests__/appRouteLoading.test.ts)
- [NEW] [src/backend/__tests__/applicationExit.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/__tests__/applicationExit.test.ts)
- [NEW] [src/backend/__tests__/gogPresenceExit.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/__tests__/gogPresenceExit.test.ts)
- [NEW] [src/backend/__tests__/rendererRequestHeaders.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/__tests__/rendererRequestHeaders.test.ts)
- [NEW] [src/backend/applicationExit.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/applicationExit.ts)
- [MODIFY] [src/backend/backup/cloudBackup.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/backup/cloudBackup.ts)
- [NEW] [src/backend/backup/__tests__/cloudBackupCancellation.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/backup/__tests__/cloudBackupCancellation.test.ts)
- [MODIFY] [src/backend/constants/paths.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/constants/paths.ts)
- [MODIFY] [src/backend/main.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/main.ts)
- [MODIFY] [src/backend/plugins/__tests__/alazterflixCatalog.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/__tests__/alazterflixCatalog.test.ts)
- [MODIFY] [src/backend/plugins/__tests__/sourceEngines.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/__tests__/sourceEngines.test.ts)
- [MODIFY] [src/backend/plugins/adaptiveSource.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/adaptiveSource.ts)
- [MODIFY] [src/backend/plugins/ankerAccount.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/ankerAccount.ts)
- [MODIFY] [src/backend/plugins/externalGames.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/externalGames.ts)
- [MODIFY] [src/backend/plugins/ipcHandler.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/ipcHandler.ts)
- [MODIFY] [src/backend/plugins/mediaStreamServer.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/mediaStreamServer.ts)
- [MODIFY] [src/backend/plugins/onlineFixAccount.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/onlineFixAccount.ts)
- [MODIFY] [src/backend/plugins/pluginManager.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/pluginManager.ts)
- [MODIFY] [src/backend/plugins/romSources.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/romSources.ts)
- [MODIFY] [src/backend/plugins/sourceEngines.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/sourceEngines.ts)
- [MODIFY] [src/backend/plugins/websiteSource.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/websiteSource.ts)
- [NEW] [src/backend/plugins/browserDownloadAutomation.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/browserDownloadAutomation.ts)
- [NEW] [src/backend/plugins/directDownloadLearning.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/directDownloadLearning.ts)
- [NEW] [src/backend/plugins/directHosters.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/directHosters.ts)
- [NEW] [src/backend/plugins/directPageEngines.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/directPageEngines.ts)
- [NEW] [src/backend/plugins/directWaitNotice.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/directWaitNotice.ts)
- [NEW] [src/backend/plugins/mediaByteRange.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/mediaByteRange.ts)
- [NEW] [src/backend/plugins/onlineFixDirect.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/onlineFixDirect.ts)
- [NEW] [src/backend/plugins/onlineFixHosters.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/onlineFixHosters.ts)
- [NEW] [src/backend/plugins/onlineFixInstall.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/onlineFixInstall.ts)
- [NEW] [src/backend/plugins/onlineFixWaitNotice.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/onlineFixWaitNotice.ts)
- [NEW] [src/backend/plugins/sourceDownloadScript.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/sourceDownloadScript.ts)
- [MODIFY] [src/backend/releases/__tests__/catalogPersistence.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/releases/__tests__/catalogPersistence.test.ts)
- [MODIFY] [src/backend/releases/__tests__/engines.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/releases/__tests__/engines.test.ts)
- [MODIFY] [src/backend/releases/__tests__/parser.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/releases/__tests__/parser.test.ts)
- [MODIFY] [src/backend/releases/__tests__/resilience.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/releases/__tests__/resilience.test.ts)
- [NEW] [src/backend/releases/__tests__/calendarCache.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/releases/__tests__/calendarCache.test.ts)
- [NEW] [src/backend/releases/__tests__/collector.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/releases/__tests__/collector.test.ts)
- [MODIFY] [src/backend/releases/archive.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/releases/archive.ts)
- [MODIFY] [src/backend/releases/catalog.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/releases/catalog.ts)
- [MODIFY] [src/backend/releases/engines.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/releases/engines.ts)
- [MODIFY] [src/backend/releases/ipc.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/releases/ipc.ts)
- [MODIFY] [src/backend/releases/parser.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/releases/parser.ts)
- [NEW] [src/backend/releases/calendarCache.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/releases/calendarCache.ts)
- [NEW] [src/backend/releases/collector.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/releases/collector.ts)
- [NEW] [src/backend/rendererRequestHeaders.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/rendererRequestHeaders.ts)
- [MODIFY] [src/backend/storeManagers/connectedAccounts/__tests__/softwareStoreItems.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/storeManagers/connectedAccounts/__tests__/softwareStoreItems.test.ts)
- [MODIFY] [src/backend/storeManagers/gog/presence.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/storeManagers/gog/presence.ts)
- [MODIFY] [src/backend/storeManagers/sideload/__tests__/library.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/storeManagers/sideload/__tests__/library.test.ts)
- [MODIFY] [src/backend/storeManagers/sideload/games.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/storeManagers/sideload/games.ts)
- [MODIFY] [src/backend/storeManagers/sideload/library.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/storeManagers/sideload/library.ts)
- [MODIFY] [src/backend/storeManagers/sideload/scanner_rules.json](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/storeManagers/sideload/scanner_rules.json)
- [MODIFY] [src/backend/storeManagers/storeManagerCommon/games.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/storeManagers/storeManagerCommon/games.ts)
- [MODIFY] [src/backend/config.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/config.ts)
- [MODIFY] [src/backend/game_config.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/game_config.ts)
- [MODIFY] [src/backend/launcher.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/launcher.ts)
- [NEW] [src/backend/__tests__/alternativeExecutableCandidate.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/__tests__/alternativeExecutableCandidate.test.ts)
- [MODIFY] [src/backend/releases/__tests__/drmManualScope.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/releases/__tests__/drmManualScope.test.ts)
- [MODIFY] [src/backend/releases/__tests__/drmPersistence.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/releases/__tests__/drmPersistence.test.ts)
- [NEW] [src/backend/releases/__tests__/drmReddit.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/releases/__tests__/drmReddit.test.ts)
- [NEW] [src/backend/releases/__tests__/drmRedditReader.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/releases/__tests__/drmRedditReader.test.ts)
- [MODIFY] [src/backend/releases/drm.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/releases/drm.ts)
- [MODIFY] [src/backend/releases/drmParser.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/releases/drmParser.ts)
- [NEW] [src/backend/releases/drmReddit.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/releases/drmReddit.ts)
- [NEW] [src/backend/releases/drmRedditParser.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/releases/drmRedditParser.ts)
- [MODIFY] [src/backend/utils.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/utils.ts)
- [MODIFY] [src/backend/utils/aborthandler/aborthandler.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/utils/aborthandler/aborthandler.ts)
- [MODIFY] [src/backend/plugins/externalVersion.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/externalVersion.ts)
- [MODIFY] [src/backend/plugins/ghostManifest.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/ghostManifest.ts)
- [MODIFY] [src/backend/plugins/__tests__/externalGames.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/__tests__/externalGames.test.ts)
- [MODIFY] [src/backend/plugins/__tests__/externalUpdateCheck.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/__tests__/externalUpdateCheck.test.ts)
- [MODIFY] [src/backend/plugins/__tests__/externalVersion.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/__tests__/externalVersion.test.ts)
- [MODIFY] [src/backend/plugins/__tests__/gameReleaseComparator.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/__tests__/gameReleaseComparator.test.ts)
- [NEW] [src/backend/plugins/__tests__/installedReleaseLabel.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/__tests__/installedReleaseLabel.test.ts)
- [MODIFY] [src/backend/plugins/__tests__/websiteSource.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/__tests__/websiteSource.test.ts)
- [MODIFY] [src/backend/releases/__tests__/drmBatch.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/releases/__tests__/drmBatch.test.ts)
- [NEW] [src/backend/releases/__tests__/drmContinuity.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/releases/__tests__/drmContinuity.test.ts)
- [MODIFY] [src/backend/releases/__tests__/drmManual.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/releases/__tests__/drmManual.test.ts)
- [NEW] [src/backend/releases/__tests__/drmOverrides.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/releases/__tests__/drmOverrides.test.ts)
- [NEW] [src/backend/releases/__tests__/drmPublicPage.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/releases/__tests__/drmPublicPage.test.ts)
- [MODIFY] [src/backend/releases/__tests__/drmSites.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/releases/__tests__/drmSites.test.ts)
- [NEW] [src/backend/releases/drmAccessWindow.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/releases/drmAccessWindow.ts)
- [NEW] [src/backend/releases/drmContinuity.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/releases/drmContinuity.ts)
- [MODIFY] [src/backend/releases/drmManual.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/releases/drmManual.ts)
- [NEW] [src/backend/releases/drmOverrides.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/releases/drmOverrides.ts)
- [NEW] [src/backend/releases/drmPublicPage.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/releases/drmPublicPage.ts)
- [MODIFY] [src/backend/releases/drmSites.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/releases/drmSites.ts)
- [MODIFY] [src/backend/releases/drmSitesParser.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/releases/drmSitesParser.ts)
- [MODIFY] [src/backend/logger/index.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/logger/index.ts)
- [MODIFY] [src/backend/logger/ipc_handler.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/logger/ipc_handler.ts)
- [MODIFY] [src/backend/logger/log_writer.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/logger/log_writer.ts)
- [NEW] [src/backend/logger/__tests__/log_tail_and_sanitization.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/logger/__tests__/log_tail_and_sanitization.test.ts)
- [MODIFY] [src/backend/plugins/__tests__/pluginManagerInstallations.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/__tests__/pluginManagerInstallations.test.ts)
- [NEW] [src/backend/plugins/__tests__/chooseDownloadSources.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/__tests__/chooseDownloadSources.test.ts)
- [NEW] [src/backend/plugins/__tests__/chooseDownloadSubmission.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/__tests__/chooseDownloadSubmission.test.ts)
- [NEW] [src/backend/plugins/__tests__/obscuraRelease.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/__tests__/obscuraRelease.test.ts)
- [NEW] [src/backend/plugins/obscuraRelease.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/obscuraRelease.ts)
- [MODIFY] [src/backend/plugins/pluginPacker.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/pluginPacker.ts)
- [NEW] [src/backend/plugins/sourceEnginePackage.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/sourceEnginePackage.ts)
- [MODIFY] [src/backend/storeManagers/connectedAccounts/__tests__/customStores.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/storeManagers/connectedAccounts/__tests__/customStores.test.ts)
- [MODIFY] [src/backend/utils/systeminfo/index.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/utils/systeminfo/index.ts)
- [NEW] [src/backend/__tests__/moveGameModal.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/__tests__/moveGameModal.test.ts)
- [NEW] [src/backend/plugins/__tests__/archiveReader.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/__tests__/archiveReader.test.ts)
- [NEW] [src/backend/plugins/__tests__/downloadEngineMemory.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/__tests__/downloadEngineMemory.test.ts)
- [NEW] [src/backend/plugins/__tests__/externalCoverResolver.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/__tests__/externalCoverResolver.test.ts)
- [NEW] [src/backend/plugins/__tests__/externalCoverSources.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/__tests__/externalCoverSources.test.ts)
- [NEW] [src/backend/plugins/__tests__/gameDetailsMetadata.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/__tests__/gameDetailsMetadata.test.ts)
- [NEW] [src/backend/plugins/archiveReader.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/archiveReader.ts)
- [NEW] [src/backend/plugins/archiveTools.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/archiveTools.ts)
- [NEW] [src/backend/plugins/directDownloadDefaults.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/directDownloadDefaults.ts)
- [NEW] [src/backend/plugins/downloadEngineMemory.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/downloadEngineMemory.ts)
- [NEW] [src/backend/plugins/externalCoverResolver.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/externalCoverResolver.ts)
- [NEW] [src/backend/plugins/externalCoverSources.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/externalCoverSources.ts)
- [NEW] [src/backend/plugins/rangedCheckpoint.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/rangedCheckpoint.ts)
- [MODIFY] [src/backend/plugins/archiveSize.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/archiveSize.ts)
- [MODIFY] [src/backend/plugins/externalFiles.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/externalFiles.ts)
- [MODIFY] [src/backend/plugins/rangedDownload.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/rangedDownload.ts)
- [MODIFY] [src/backend/storeManagers/steam/games.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/storeManagers/steam/games.ts)
- [MODIFY] [src/backend/utils/filesystem/drives.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/utils/filesystem/drives.ts)
- [MODIFY] [src/backend/plugins/__tests__/archiveSize.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/__tests__/archiveSize.test.ts)
- [MODIFY] [src/backend/plugins/__tests__/directDownloadLearning.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/__tests__/directDownloadLearning.test.ts)
- [MODIFY] [src/backend/plugins/__tests__/directPageEngines.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/__tests__/directPageEngines.test.ts)
- [MODIFY] [src/backend/plugins/__tests__/rangedDownload.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/__tests__/rangedDownload.test.ts)
- [NEW] [src/backend/__tests__/legendaryAuth.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/__tests__/legendaryAuth.test.ts)
- [NEW] [src/backend/plugins/__tests__/alazterflixEpisodeEditing.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/__tests__/alazterflixEpisodeEditing.test.ts)
- [NEW] [src/backend/plugins/__tests__/alazterflixToast.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/__tests__/alazterflixToast.test.ts)
- [NEW] [src/backend/plugins/__tests__/imdbImageResolver.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/__tests__/imdbImageResolver.test.ts)
- [NEW] [src/backend/plugins/imdbImageResolver.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/imdbImageResolver.ts)
- [MODIFY] [src/backend/plugins/enginePolicy.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/enginePolicy.ts)
- [MODIFY] [src/backend/plugins/mediaArtwork.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/mediaArtwork.ts)
- [MODIFY] [src/backend/plugins/__tests__/enginePolicy.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/__tests__/enginePolicy.test.ts)
- [MODIFY] [src/backend/plugins/__tests__/mediaArtwork.test.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/plugins/__tests__/mediaArtwork.test.ts)
- [MODIFY] [src/backend/storeManagers/legendary/library.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/storeManagers/legendary/library.ts)
- [MODIFY] [src/backend/storeManagers/legendary/user.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/storeManagers/legendary/user.ts)
- [MODIFY] [src/backend/updater.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/updater.ts)
### Common & Preload
- [MODIFY] [src/common/types.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/common/types.ts)
- [MODIFY] [src/common/externalDownloadStatus.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/common/externalDownloadStatus.ts)
- [MODIFY] [src/common/releaseValidation.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/common/releaseValidation.ts)
- [MODIFY] [src/common/types/ipc.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/common/types/ipc.ts)
- [MODIFY] [src/common/types/plugins.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/common/types/plugins.ts)
- [MODIFY] [src/common/types/releases.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/common/types/releases.ts)
- [MODIFY] [src/common/utils.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/common/utils.ts)
- [NEW] [src/common/defaultHomeContent.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/common/defaultHomeContent.ts)
- [NEW] [src/common/directDownloadLearning.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/common/directDownloadLearning.ts)
- [MODIFY] [src/preload/api/plugins.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/preload/api/plugins.ts)
- [NEW] [src/preload/directDownloadLearning.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/preload/directDownloadLearning.ts)
- [NEW] [src/common/externalReleaseInfo.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/common/externalReleaseInfo.ts)
- [MODIFY] [src/common/releaseDrm.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/common/releaseDrm.ts)
- [MODIFY] [src/preload/api/releases.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/preload/api/releases.ts)
- [NEW] [src/common/externalGameCover.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/common/externalGameCover.ts)
- [MODIFY] [src/common/types/electron_store.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/common/types/electron_store.ts)
- [MODIFY] [src/preload/api/misc.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/preload/api/misc.ts)
### Frontend
- [MODIFY] [src/frontend/App.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/App.tsx)
- [MODIFY] [src/frontend/components/ChooseDownloadModal/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/components/ChooseDownloadModal/index.tsx)
- [MODIFY] [src/frontend/components/UI/ActionIcons/index.css](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/components/UI/ActionIcons/index.css)
- [MODIFY] [src/frontend/components/UI/ActionIcons/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/components/UI/ActionIcons/index.tsx)
- [MODIFY] [src/frontend/components/UI/CachedImage/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/components/UI/CachedImage/index.tsx)
- [MODIFY] [src/frontend/components/UI/Dropdown/index.scss](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/components/UI/Dropdown/index.scss)
- [MODIFY] [src/frontend/components/UI/Header/index.css](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/components/UI/Header/index.css)
- [MODIFY] [src/frontend/components/UI/Header/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/components/UI/Header/index.tsx)
- [MODIFY] [src/frontend/helpers/customStoreFiltering.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/helpers/customStoreFiltering.ts)
- [NEW] [src/frontend/helpers/softwareStoreItems.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/helpers/softwareStoreItems.ts)
- [MODIFY] [src/frontend/screens/Alazterflix/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Alazterflix/index.tsx)
- [MODIFY] [src/frontend/screens/DownloadManager/components/ExternalActiveCard/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/DownloadManager/components/ExternalActiveCard/index.tsx)
- [MODIFY] [src/frontend/screens/ExternalGames/Downloads.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/ExternalGames/Downloads.tsx)
- [MODIFY] [src/frontend/screens/ExternalGames/index.css](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/ExternalGames/index.css)
- [MODIFY] [src/frontend/screens/ExternalGames/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/ExternalGames/index.tsx)
- [MODIFY] [src/frontend/screens/Releases/NativeReleases.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Releases/NativeReleases.tsx)
- [NEW] [src/frontend/screens/Releases/ReleaseCollectorPicker.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Releases/ReleaseCollectorPicker.tsx)
- [NEW] [src/frontend/screens/Releases/collector.css](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Releases/collector.css)
- [MODIFY] [src/frontend/screens/Settings/components/AfterLaunchScriptPath.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Settings/components/AfterLaunchScriptPath.tsx)
- [MODIFY] [src/frontend/screens/Settings/components/BeforeLaunchScriptPath.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Settings/components/BeforeLaunchScriptPath.tsx)
- [NEW] [src/frontend/screens/Settings/components/SoftwareStorePathBox.scss](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Settings/components/SoftwareStorePathBox.scss)
- [NEW] [src/frontend/screens/Settings/components/SoftwareStorePathBox.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Settings/components/SoftwareStorePathBox.tsx)
- [MODIFY] [src/frontend/screens/Settings/sections/GamesSettings/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Settings/sections/GamesSettings/index.tsx)
- [MODIFY] [src/frontend/themes.scss](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/themes.scss)
- [NEW] [src/frontend/components/DirectDownloadWait/](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/components/DirectDownloadWait/)
- [NEW] [src/frontend/screens/Alazterflix/videoBuffering.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Alazterflix/videoBuffering.ts)
- [NEW] [src/frontend/screens/ExternalGames/SearchStatus.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/ExternalGames/SearchStatus.tsx)
- [MODIFY] [src/frontend/helpers/releaseDrmRequests.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/helpers/releaseDrmRequests.ts)
- [MODIFY] [src/frontend/screens/Library/components/InlineGameSettings/GameVersionBadge.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Library/components/InlineGameSettings/GameVersionBadge.tsx)
- [NEW] [src/frontend/screens/Library/components/InlineGameSettings/InstalledReleaseLabel.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Library/components/InlineGameSettings/InstalledReleaseLabel.tsx)
- [MODIFY] [src/frontend/screens/Releases/ReleaseDrm.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Releases/ReleaseDrm.tsx)
- [NEW] [src/frontend/screens/Releases/ReleaseDrmEditor.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Releases/ReleaseDrmEditor.tsx)
- [MODIFY] [src/frontend/screens/Releases/drm.css](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Releases/drm.css)
- [MODIFY] [src/frontend/components/ChooseDownloadModal/index.css](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/components/ChooseDownloadModal/index.css)
- [NEW] [src/frontend/components/ChooseDownloadModal/DownloadAppearanceSettings.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/components/ChooseDownloadModal/DownloadAppearanceSettings.tsx)
- [NEW] [src/frontend/components/ChooseDownloadModal/SourcePicker.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/components/ChooseDownloadModal/SourcePicker.tsx)
- [NEW] [src/frontend/components/ChooseDownloadModal/appearance.css](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/components/ChooseDownloadModal/appearance.css)
- [NEW] [src/frontend/assets/ghost-logo.png](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/assets/ghost-logo.png)
- [NEW] [src/frontend/state/downloadDialogAppearance.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/state/downloadDialogAppearance.ts)
- [MODIFY] [src/frontend/state/ChooseDownloadModal.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/state/ChooseDownloadModal.ts)
- [MODIFY] [src/frontend/helpers/storeFiltersStorage.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/helpers/storeFiltersStorage.ts)
- [MODIFY] [src/frontend/screens/Library/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Library/index.tsx)
- [MODIFY] [src/frontend/screens/Personalization/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Personalization/index.tsx)
- [MODIFY] [src/frontend/screens/Plugins/SourceEnginesPanel.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Plugins/SourceEnginesPanel.tsx)
- [MODIFY] [src/frontend/screens/Plugins/index.scss](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Plugins/index.scss)
- [MODIFY] [src/frontend/screens/Plugins/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Plugins/index.tsx)
- [MODIFY] [src/frontend/screens/Settings/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Settings/index.tsx)
- [MODIFY] [src/frontend/screens/Settings/sections/LogSettings/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Settings/sections/LogSettings/index.tsx)
- [MODIFY] [src/frontend/screens/Settings/sections/SystemInfo/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Settings/sections/SystemInfo/index.tsx)
- [NEW] [src/frontend/components/PreferredGameCover.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/components/PreferredGameCover.tsx)
- [NEW] [src/frontend/hooks/useExternalGameCover.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/hooks/useExternalGameCover.ts)
- [NEW] [src/frontend/hooks/useGameStoreSources.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/hooks/useGameStoreSources.ts)
- [NEW] [src/frontend/screens/ExternalGames/GameDetailsPanel.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/ExternalGames/GameDetailsPanel.tsx)
- [NEW] [src/frontend/screens/ExternalGames/InstallDestination.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/ExternalGames/InstallDestination.tsx)
- [NEW] [src/frontend/screens/ExternalGames/StoreSourceCards.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/ExternalGames/StoreSourceCards.tsx)
- [NEW] [src/frontend/screens/ExternalGames/gameDetails.css](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/ExternalGames/gameDetails.css)
- [NEW] [src/frontend/screens/ExternalGames/gameDetailsMetadata.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/ExternalGames/gameDetailsMetadata.ts)
- [NEW] [src/frontend/screens/Library/components/InlineGameSettings/MoveGameModal.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Library/components/InlineGameSettings/MoveGameModal.tsx)
- [MODIFY] [src/frontend/screens/Library/components/InlineGameSettings/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Library/components/InlineGameSettings/index.tsx)
- [NEW] [src/frontend/screens/Alazterflix/toastUtils.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Alazterflix/toastUtils.ts)
- [MODIFY] [src/frontend/screens/Alazterflix/index.scss](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Alazterflix/index.scss)

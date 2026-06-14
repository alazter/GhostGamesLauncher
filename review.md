# Review das Alterações - 14/06/2026

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

---

## 🛠️ Arquivos Modificados e Criados

### Configuração e Build
- [MODIFY] [package.json](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/package.json)
- [MODIFY] [electron-builder.yml](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/electron-builder.yml)
- [MODIFY] [review.md](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/review.md)

### Backend
- [MODIFY] [updater.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/updater.ts)
- [MODIFY] [main.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/backend/main.ts)
- [MODIFY] [types.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/common/types.ts)
- [MODIFY] [ipc.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/common/types/ipc.ts)

### Preload & API
- [MODIFY] [misc.ts](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/preload/api/misc.ts)

### Frontend
- [MODIFY] [Personalization/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Personalization/index.tsx)
- [MODIFY] [StoreLogos/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/components/UI/StoreLogos/index.tsx)
- [MODIFY] [HeroicVersion/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/components/UI/Sidebar/components/HeroicVersion/index.tsx)
- [MODIFY] [HeroicVersion/index.scss](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/components/UI/Sidebar/components/HeroicVersion/index.scss)
- [MODIFY] [HeroPanel/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Library/components/HeroPanel/index.tsx)
- [NEW] [update-ghost.png](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/assets/update-ghost.png)
- [NEW] [UpdatePopupModal/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/components/UI/UpdatePopupModal/index.tsx)
- [NEW] [UpdatePopupModal/index.scss](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/components/UI/UpdatePopupModal/index.scss)
